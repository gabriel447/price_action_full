require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const config = require('./config');
const brokerService = require('./services/brokerService');
const marketMonitor = require('./engine/marketMonitor');
const strategy = require('./engine/strategy');

const app = express();
const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', symbol: config.trading.symbol, uptime: process.uptime() });
});

app.get('/snapshot', (_req, res) => {
  res.json(strategy.getSnapshot());
});

app.get('/candles', (_req, res) => {
  res.json(strategy.getCandlesWithIndicators());
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Cliente conectado: ${socket.id}`);

  socket.emit('snapshot', { ...strategy.getSnapshot(), interval: config.trading.interval });

  brokerService.getWalletBalance(config.trading.symbol)
    .then((balance) => socket.emit('walletBalance', balance))
    .catch((err) => console.error('[Server] Erro ao buscar saldo inicial:', err.message));

  socket.on('cancelAllOrders', async () => {
    console.log(`[Socket.io] cancelAllOrders solicitado por: ${socket.id}`);
    try {
      await brokerService.cancelAllOpenOrders(config.trading.symbol);
      if (strategy.state.isAssetOpen) {
        await handleClosePosition('Panic — cancelAllOrders pelo usuário');
      }
      broadcast('cancelAllOrders', { success: true, time: Date.now() });
    } catch (err) {
      console.error('[Server] Erro ao cancelar ordens:', err.message);
      socket.emit('error', { message: err.message, time: Date.now() });
    }
  });

  socket.on('changeTimeframe', async (interval) => {
    const allowed = ['1m', '3m', '5m', '15m', '30m', '1h', '4h'];
    if (!allowed.includes(interval)) {
      socket.emit('error', { message: `Timeframe inválido: ${interval}`, time: Date.now() });
      return;
    }
    console.log(`[Socket.io] changeTimeframe → ${interval}`);
    config.trading.interval = interval;
    try {
      const candles = await brokerService.getHistoricalCandles(config.trading.symbol, interval, 500);
      strategy.loadHistory(candles);
      marketMonitor.reconnectWithInterval(interval);
      broadcast('timeframeChanged', { interval, time: Date.now() });
      broadcast('snapshot', { ...strategy.getSnapshot(), interval: config.trading.interval });
    } catch (err) {
      console.error('[Server] Erro ao trocar timeframe:', err.message);
      socket.emit('error', { message: err.message, time: Date.now() });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

function broadcast(event, data) {
  io.emit(event, data);
}

function broadcastLog(message, type = 'info') {
  io.emit('log', { message, type, timestamp: Date.now() });
}

strategy.setLogger(broadcastLog);

async function calculatePositionSize(entryPrice, stopLossPrice) {
  try {
    const balance    = await brokerService.getWalletBalance(config.trading.symbol);
    const usdtFree   = parseFloat(balance.quote.free);
    const riskAmount = usdtFree * (config.trading.riskPercent / 100);

    const stopDistance = entryPrice - stopLossPrice;
    if (stopDistance <= 0) return config.trading.quantity;

    const rawQty    = riskAmount / stopDistance;
    const cappedQty = Math.min(rawQty, config.trading.quantity);

    console.log(
      `[Server] Sizing: saldo ${usdtFree.toFixed(2)} USDT | risco ${config.trading.riskPercent}% = ` +
      `${riskAmount.toFixed(2)} USDT | stop ${stopDistance.toFixed(2)} | qty: ${cappedQty.toFixed(6)}`
    );

    broadcastLog(`Calculando lote: Risco de ${config.trading.riskPercent}% do saldo (${usdtFree.toFixed(2)} USDT). Tamanho da ordem: ${cappedQty.toFixed(5)}.`, 'info');

    return cappedQty;
  } catch (err) {
    console.warn('[Server] Falha no cálculo de posição, usando quantity padrão:', err.message);
    return config.trading.quantity;
  }
}

async function handleBuySignal(currentPrice, entryResult) {
  try {
    console.log(
      `[Server] Setup "${entryResult.setup}" @ ${currentPrice} | R:R ${entryResult.riskReward}:1 | ${entryResult.reason}`
    );

    const quantity = await calculatePositionSize(currentPrice, entryResult.stopLossPrice);

    const order = await brokerService.placeMarketOrder(
      'BUY',
      config.trading.symbol,
      quantity
    );

    const entryPrice = parseFloat(order.fills?.[0]?.price ?? order.price ?? currentPrice);

    strategy.openPosition({
      side:            'BUY',
      entryPrice,
      quantity,
      orderId:         order.orderId,
      stopLossPrice:   entryResult.stopLossPrice,
      takeProfitPrice: entryResult.takeProfitPrice,
      setup:           entryResult.setup,
    });

    broadcast('order', {
      type:       'OPEN',
      side:       'BUY',
      price:      entryPrice,
      quantity,
      orderId:    order.orderId,
      setup:      entryResult.setup,
      riskReward: entryResult.riskReward,
      stopLoss:   entryResult.stopLossPrice,
      takeProfit: entryResult.takeProfitPrice,
      time:       Date.now(),
    });

    broadcast('snapshot', { ...strategy.getSnapshot(), interval: config.trading.interval });

    brokerService.getWalletBalance(config.trading.symbol)
      .then((balance) => broadcast('walletBalance', balance))
      .catch((err) => console.error('[Server] Erro ao buscar saldo:', err.message));
  } catch (err) {
    console.error('[Server] Falha ao enviar ordem de compra:', err.message);
    broadcast('error', { message: err.message, time: Date.now() });
  }
}

async function handleClosePosition(reason) {
  const position = strategy.state.currentPosition;
  if (!position) return;

  try {
    console.log(`[Server] Fechando posição: ${reason}`);

    const order = await brokerService.placeMarketOrder(
      'SELL',
      config.trading.symbol,
      position.quantity
    );

    strategy.closePosition();

    broadcast('order', {
      type:     'CLOSE',
      side:     'SELL',
      reason,
      quantity: position.quantity,
      orderId:  order.orderId,
      time:     Date.now(),
    });

    broadcast('snapshot', { ...strategy.getSnapshot(), interval: config.trading.interval });

    brokerService.getWalletBalance(config.trading.symbol)
      .then((balance) => broadcast('walletBalance', balance))
      .catch((err) => console.error('[Server] Erro ao buscar saldo:', err.message));
  } catch (err) {
    console.error('[Server] Falha ao fechar posição:', err.message);
    broadcast('error', { message: err.message, time: Date.now() });
  }
}

marketMonitor.onTick((tick) => {
  broadcast('tick', tick);

  const currentPrice = tick.price;

  if (strategy.state.isAssetOpen) {
    const exit = strategy.evaluateExit(currentPrice);
    if (exit.shouldClose) {
      handleClosePosition(exit.reason);
      return;
    }
  }

  const entry = strategy.evaluateEntry(currentPrice, config.trading.minOrderCooldownMs);
  if (entry.signal === 'BUY') {
    handleBuySignal(currentPrice, entry);
  }
});

marketMonitor.onCandle((candle, isClosed) => {
  strategy.updateCandle(candle, isClosed);

  broadcast('liveCandle', candle);

  if (isClosed) {
    broadcast('candleClosed', candle);
    broadcast('snapshot', { ...strategy.getSnapshot(), interval: config.trading.interval });
  }
});

marketMonitor.onStatus((status) => {
  console.log(`[MarketMonitor] Status: ${status}`);
  broadcast('wsStatus', { status, time: Date.now() });
});

async function bootstrap() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║    Price Action Trading Bot           ║');
  console.log(`║    ${config.trading.symbol.padEnd(8)} | ${config.trading.interval.padEnd(4)} | ${config.binance.useTestnet ? 'TESTNET' : 'MAINNET'.padEnd(7)}       ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  await brokerService.validateConnection();

  console.log('[Server] Buscando filtros do par e saldo inicial...');
  await brokerService.getSymbolFilters(config.trading.symbol);
  const initialBalance = await brokerService.getWalletBalance(config.trading.symbol);
  console.log(`[Server] ✓ Par validado | ${initialBalance.quote.asset}: ${parseFloat(initialBalance.quote.free).toFixed(2)} livre`);

  console.log('[Server] Buscando histórico de velas...');
  const candles = await brokerService.getHistoricalCandles(
    config.trading.symbol,
    config.trading.interval,
    500
  );
  strategy.loadHistory(candles);

  marketMonitor.connect();

  httpServer.listen(config.server.port, () => {
    console.log('');
    console.log(`[Server] ✓ Servidor rodando na porta ${config.server.port}`);
    console.log(`[Server] ✓ Frontend: http://localhost:${config.server.port}`);
    console.log('[Server] Aguardando conexão do frontend...');
    console.log('');
  });
}

process.on('SIGINT', async () => {
  console.log('\n[Server] Encerrando robô...');
  marketMonitor.disconnect();

  if (strategy.state.isAssetOpen) {
    console.log('[Server] Fechando posição aberta antes de sair...');
    await handleClosePosition('Shutdown do servidor');
  }

  process.exit(0);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Exceção não tratada:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Promise rejeitada não tratada:', reason);
});

bootstrap().catch((err) => {
  console.error('[Server] Erro fatal na inicialização:', err.message);
  process.exit(1);
});

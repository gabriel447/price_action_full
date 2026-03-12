const Binance = require('binance-api-node').default;
const config  = require('../config');

const client = Binance({
  apiKey:    config.binance.apiKey,
  apiSecret: config.binance.apiSecret,
  httpBase:  config.binance.httpBase,
});

const MODE = config.binance.useTestnet ? '⚠  TESTNET' : '✓  MAINNET';
console.log(`[BrokerService] Binance API inicializada — ${MODE}`);

async function validateConnection() {
  const mode = config.binance.useTestnet ? 'TESTNET' : 'MAINNET';
  console.log(`[BrokerService] Verificando conexão com Binance ${mode}...`);

  await client.ping();
  console.log('[BrokerService] ✓ Ping OK');

  const serverTime = await client.time();
  const localTime  = Date.now();
  const skewMs     = Math.abs(serverTime - localTime);
  if (skewMs > 5000) {
    console.warn(`[BrokerService] ⚠ Clock desviado ${skewMs}ms — isso pode causar erros de assinatura.`);
  } else {
    console.log(`[BrokerService] ✓ Sincronização de tempo OK (skew: ${skewMs}ms)`);
  }

  let account;
  try {
    account = await client.accountInfo();
  } catch (err) {
    const code = err.code || err.status;
    if (code === -2014 || code === 401) {
      throw new Error('[BrokerService] API Key inválida. Verifique BINANCE_API_KEY no .env.');
    }
    if (code === -1022) {
      throw new Error('[BrokerService] Assinatura inválida. Verifique BINANCE_API_SECRET no .env.');
    }
    throw new Error(`[BrokerService] Falha na autenticação (código ${code}): ${err.message}`);
  }

  console.log(`[BrokerService] ✓ Autenticação OK`);
  console.log(`[BrokerService]   Tipo de conta : ${account.accountType}`);
  console.log(`[BrokerService]   Pode operar   : ${account.canTrade}`);
  console.log(`[BrokerService]   Pode depositar: ${account.canDeposit}`);
  console.log(`[BrokerService]   Pode sacar    : ${account.canWithdraw}`);

  const usdt = account.balances.find((b) => b.asset === 'USDT');
  if (usdt) {
    console.log(`[BrokerService]   Saldo USDT    : ${parseFloat(usdt.free).toFixed(2)} livre | ${parseFloat(usdt.locked).toFixed(2)} bloqueado`);
  }

  return {
    accountType: account.accountType,
    canTrade:    account.canTrade,
    usdtFree:    usdt ? parseFloat(usdt.free) : 0,
  };
}

const filtersCache = new Map();

async function getSymbolFilters(symbol) {
  if (filtersCache.has(symbol)) return filtersCache.get(symbol);

  const info   = await client.exchangeInfo();
  const symInfo = info.symbols.find((s) => s.symbol === symbol);
  if (!symInfo) throw new Error(`[BrokerService] Símbolo ${symbol} não encontrado.`);

  const lotSize     = symInfo.filters.find((f) => f.filterType === 'LOT_SIZE');
  const priceFilter = symInfo.filters.find((f) => f.filterType === 'PRICE_FILTER');
  const notional    = symInfo.filters.find(
    (f) => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL'
  );

  const filters = {
    stepSize:            parseFloat(lotSize?.stepSize    || '0.00001'),
    tickSize:            parseFloat(priceFilter?.tickSize || '0.01'),
    minQty:              parseFloat(lotSize?.minQty       || '0.00001'),
    minNotional:         parseFloat(notional?.minNotional || notional?.notional || '5'),
    baseAsset:           symInfo.baseAsset,
    quoteAsset:          symInfo.quoteAsset,
    baseAssetPrecision:  symInfo.baseAssetPrecision,
    quoteAssetPrecision: symInfo.quoteAssetPrecision,
  };

  filtersCache.set(symbol, filters);
  console.log(
    `[BrokerService] Filtros de ${symbol}: stepSize=${filters.stepSize}, tickSize=${filters.tickSize}`
  );
  return filters;
}

function countDecimals(num) {
  const str = num.toString();
  const dot = str.indexOf('.');
  return dot === -1 ? 0 : str.length - dot - 1;
}

function floorToStep(value, step) {
  if (!step) return value;
  const precision = countDecimals(step);
  const factor    = Math.pow(10, precision);
  return Math.floor(value * factor) / factor;
}

function roundToTick(value, tick) {
  if (!tick) return value;
  const precision = countDecimals(tick);
  const factor    = Math.pow(10, precision);
  return Math.round(value * factor) / factor;
}

async function getHistoricalCandles(symbol, interval, limit = 200) {
  const candles = await client.candles({ symbol, interval, limit });

  return candles.map((k) => ({
    time:   k.openTime,
    open:   parseFloat(k.open),
    high:   parseFloat(k.high),
    low:    parseFloat(k.low),
    close:  parseFloat(k.close),
    volume: parseFloat(k.volume),
  }));
}

async function placeMarketOrder(side, symbol, quantity) {
  const filters = await getSymbolFilters(symbol);
  const safeQty = floorToStep(quantity, filters.stepSize);

  if (safeQty < filters.minQty) {
    throw new Error(
      `[BrokerService] Quantidade ${safeQty} abaixo do mínimo ${filters.minQty} para ${symbol}.`
    );
  }

  const qtyStr = safeQty.toFixed(countDecimals(filters.stepSize));

  console.log(`[BrokerService] → Enviando ordem MARKET ${side} | ${symbol} | qty: ${qtyStr}`);

  const order = await client.order({
    symbol,
    side,
    type:     'MARKET',
    quantity: qtyStr,
  });

  const fillPrice = order.fills?.[0]?.price ?? order.price ?? 'N/A';
  const fillQty   = order.executedQty ?? qtyStr;
  console.log('┌─────────────────────────────────────────');
  console.log(`│ [Ordem TESTNET${config.binance.useTestnet ? '' : ' MAINNET'}] ${new Date().toISOString()}`);
  console.log(`│ Símbolo   : ${order.symbol}`);
  console.log(`│ Lado      : ${order.side}`);
  console.log(`│ Tipo      : ${order.type}`);
  console.log(`│ Quantidade: ${fillQty}`);
  console.log(`│ Preço fill: ${fillPrice}`);
  console.log(`│ Order ID  : ${order.orderId}`);
  console.log(`│ Status    : ${order.status}`);
  console.log(`│ Client OID: ${order.clientOrderId}`);
  console.log('└─────────────────────────────────────────');

  return order;
}

async function cancelAllOpenOrders(symbol) {
  try {
    const result = await client.cancelOpenOrders({ symbol });
    console.log(`[BrokerService] Todas as ordens de ${symbol} canceladas.`);
    return result;
  } catch (err) {
    if (err.code === -2011) {
      console.log(`[BrokerService] Nenhuma ordem aberta encontrada para ${symbol}.`);
      return [];
    }
    throw err;
  }
}

async function getWalletBalance(symbol) {
  const sym  = symbol || config.trading.symbol;
  const filters = await getSymbolFilters(sym);
  const info    = await client.accountInfo();

  const find = (asset) =>
    info.balances.find((b) => b.asset === asset) || { asset, free: '0', locked: '0' };

  return {
    base:    find(filters.baseAsset),
    quote:   find(filters.quoteAsset),
    testnet: config.binance.useTestnet,
  };
}

module.exports = {
  validateConnection,
  getHistoricalCandles,
  placeMarketOrder,
  cancelAllOpenOrders,
  getWalletBalance,
  getSymbolFilters,
  floorToStep,
  roundToTick,
};

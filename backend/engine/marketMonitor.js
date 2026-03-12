const WebSocket = require('ws');
const config = require('../config');

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

class MarketMonitor {
  constructor() {
    this._ws = null;
    this._reconnectAttempts = 0;
    this._intentionalClose = false;

    this._onTickCallback = null;
    this._onCandleCallback = null;
    this._onStatusCallback = null;
  }

  onTick(fn) { this._onTickCallback = fn; }

  onCandle(fn) { this._onCandleCallback = fn; }

  onStatus(fn) { this._onStatusCallback = fn; }

  connect(intervalOverride) {
    this._intentionalClose = false;

    const symbol   = config.trading.symbol.toLowerCase();
    const interval = intervalOverride || config.trading.interval;
    const streamUrl = `${config.binance.wsBase}/${symbol}@kline_${interval}`;

    console.log(`[MarketMonitor] Conectando ao stream: ${streamUrl}`);
    this._ws = new WebSocket(streamUrl);

    this._ws.on('open', () => this._handleOpen());
    this._ws.on('message', (data) => this._handleMessage(data));
    this._ws.on('error', (err) => this._handleError(err));
    this._ws.on('close', (code, reason) => this._handleClose(code, reason));
  }

  disconnect() {
    this._intentionalClose = true;
    if (this._ws) {
      this._ws.terminate();
      this._ws = null;
    }
    console.log('[MarketMonitor] WebSocket encerrado intencionalmente.');
  }

  reconnectWithInterval(interval) {
    console.log(`[MarketMonitor] Trocando timeframe para ${interval}...`);
    this.disconnect();
    setTimeout(() => this.connect(interval), 300);
  }

  _handleOpen() {
    this._reconnectAttempts = 0;
    console.log('[MarketMonitor] Conexão WebSocket estabelecida.');
    this._emitStatus('connected');
  }

  _handleMessage(rawData) {
    try {
      const msg = JSON.parse(rawData.toString());
      const parsed = this._parseMessage(msg);
      if (!parsed) return;

      const { tick, candle, isClosed } = parsed;

      if (this._onTickCallback) {
        this._onTickCallback(tick);
      }

      if (this._onCandleCallback) {
        this._onCandleCallback(candle, isClosed);
      }
    } catch (err) {
      console.error('[MarketMonitor] Erro ao processar mensagem WS:', err.message);
    }
  }

  _handleError(err) {
    console.error('[MarketMonitor] Erro WebSocket:', err.message);
    this._emitStatus('error');
  }

  _handleClose(code, reason) {
    console.warn(`[MarketMonitor] Conexão fechada. Código: ${code} | Motivo: ${reason}`);
    this._emitStatus('disconnected');

    if (!this._intentionalClose) {
      this._scheduleReconnect();
    }
  }

  _parseMessage(msg) {
    if (msg.e === 'kline' && msg.k) {
      const k = msg.k;
      const candle = {
        time: k.t,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };
      const tick = {
        symbol: msg.s,
        price: parseFloat(k.c),
        time: msg.E,
      };
      return { tick, candle, isClosed: k.x };
    }

    return null;
  }

  _scheduleReconnect() {
    if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[MarketMonitor] Número máximo de tentativas de reconexão atingido. Abortando.');
      return;
    }

    this._reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this._reconnectAttempts;
    console.log(`[MarketMonitor] Reconectando em ${delay / 1000}s... (tentativa ${this._reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    setTimeout(() => this.connect(), delay);
  }

  _emitStatus(status) {
    if (this._onStatusCallback) {
      this._onStatusCallback(status);
    }
  }
}

module.exports = new MarketMonitor();

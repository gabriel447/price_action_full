const { EMA, SMA, RSI } = require('technicalindicators');

const MAX_CANDLE_HISTORY = 500;

class PriceActionEngine {
  constructor() {
    this.candles = [];

    this.state = {
      isAssetOpen:       false,
      currentPosition:   null,
      lastOrderTime:     null,
      lastDetectedSetup: null,
      lastLogTime:       0,
      currentCandleTime: 0,
    };

    this.logger = null;
  }

  setLogger(fn) {
    this.logger = fn;
  }

  log(message, type = 'info') {
    if (this.logger) this.logger(message, type);
  }

  loadHistory(candles) {
    this.candles = candles.slice(-MAX_CANDLE_HISTORY);
    console.log(`[Strategy] Histórico carregado: ${this.candles.length} velas.`);
  }

  getCandlesWithIndicators() {
    const closes = this.candles.map((c) => c.close);

    const calc = (Method, period) => {
      if (closes.length < period) return [];
      return Method.calculate({ period, values: closes });
    };

    const sma9Values   = calc(SMA, 9);
    const ema21Values  = calc(EMA, 21);
    const ema200Values = calc(EMA, 200);

    return this.candles.map((c, i) => ({
      ...c,
      sma9:   sma9Values[i - 8]     ?? null,
      ema21:  ema21Values[i - 20]   ?? null,
      ema200: ema200Values[i - 199] ?? null,
    }));
  }

  updateCandle(kline, isClosed) {
    const candle = {
      time:   kline.time,
      open:   kline.open,
      high:   kline.high,
      low:    kline.low,
      close:  kline.close,
      volume: kline.volume,
    };

    const last = this.candles[this.candles.length - 1];

    if (last && last.time === candle.time) {
      this.candles[this.candles.length - 1] = candle;
    } else {
      this.candles.push(candle);
      this.state.currentCandleTime = candle.time;
      this.state.scanLogged = false;
    }

    if (isClosed && this.candles.length > MAX_CANDLE_HISTORY) {
      this.candles.shift();
    }
  }

  getEMA(period) {
    const closes = this.candles.map((c) => c.close);
    if (closes.length < period) return null;
    const results = EMA.calculate({ period, values: closes });
    return results[results.length - 1] ?? null;
  }

  getSMA(period) {
    const closes = this.candles.map((c) => c.close);
    if (closes.length < period) return null;
    const results = SMA.calculate({ period, values: closes });
    return results[results.length - 1] ?? null;
  }

  getRSI(period = 14) {
    const closes = this.candles.map((c) => c.close);
    if (closes.length < period + 1) return null;
    const results = RSI.calculate({ period, values: closes });
    return results[results.length - 1] ?? null;
  }

  _amp(c) { return c.high - c.low; }

  _body(c) { return Math.abs(c.close - c.open); }

  _bodyRatio(c) {
    const a = this._amp(c);
    return a === 0 ? 0 : this._body(c) / a;
  }

  _upperShadow(c) { return c.high - Math.max(c.open, c.close); }

  _lowerShadow(c) { return Math.min(c.open, c.close) - c.low; }

  _isBullish(c) { return c.close >= c.open; }

  _isIgnitionBar(candle, history, lookback = 20) {
    if (this._bodyRatio(candle) < 0.80) return false;
    const amp    = this._amp(candle);
    const window = history.slice(-lookback);
    if (window.length < Math.min(lookback, 10)) return false;
    return window.every((c) => this._amp(c) < amp);
  }

  _isHammer(c) {
    const a = this._amp(c);
    if (a === 0) return false;
    return this._lowerShadow(c) >= (a * 2 / 3) && this._body(c) <= (a / 3);
  }

  _isShootingStar(c) {
    const a = this._amp(c);
    if (a === 0) return false;
    return this._upperShadow(c) >= (a * 2 / 3) && this._body(c) <= (a / 3);
  }

  _trendBias() {
    const lastClose = this.candles[this.candles.length - 1]?.close;
    const ema21     = this.getEMA(21);

    if (!lastClose || !ema21) return 'NEUTRAL';
    return lastClose > ema21 ? 'UP' : 'DOWN';
  }

  _isRestingNearSMA9(price, thresholdPct = 1.5) {
    const sma9 = this.getSMA(9);
    if (!sma9) return false;
    return Math.abs((price - sma9) / sma9) * 100 <= thresholdPct;
  }

  _checkIgnition(price, closed) {
    if (closed.length < 21) return null;

    const signal  = closed[closed.length - 1];
    const history = closed.slice(0, -1);

    if (!this._isIgnitionBar(signal, history)) return null;
    if (!this._isBullish(signal)) return null;

    const vol20 = history.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
    const volP  = ((signal.volume - vol20) / vol20) * 100;

    if (price <= signal.high) return null;

    const sl        = signal.low;
    const barAmp    = this._amp(signal);
    const riskCheck = price - sl;
    if (riskCheck <= 0 || barAmp <= 0) return null;

    this.log(`Barra de Ignição detectada! Volume ${volP.toFixed(1)}% acima da média. Monitorando gatilho em ${signal.high.toFixed(2)}.`, 'info');

    return {
      signal:          'BUY',
      setup:           'ignition',
      reason:          `Barra de Ignição — rompimento @ ${signal.high.toFixed(2)} | corpo ${(this._bodyRatio(signal) * 100).toFixed(0)}% | amp ${barAmp.toFixed(2)}`,
      stopLossPrice:   sl,
      takeProfitPrice: price + (barAmp * 2),
      riskReward:      (barAmp * 2) / riskCheck,
    };
  }

  _checkRLE(price, closed) {
    if (closed.length < 12) return null;

    const breakout      = closed[closed.length - 1];
    const consolidation = closed.slice(-9, -1);

    if (consolidation.length < 8) return null;

    const window20 = closed.slice(-20);
    const avgAmp   = window20.reduce((s, c) => s + this._amp(c), 0) / window20.length;

    const allNarrow = consolidation.every((c) => this._amp(c) < avgAmp * 0.8);
    if (!allNarrow) return null;

    if (this._bodyRatio(breakout) < 0.60) return null;
    if (this._amp(breakout) < avgAmp * 1.3) return null;
    if (!this._isBullish(breakout)) return null;

    if (price <= breakout.high) return null;

    const sl   = breakout.low;
    const risk = price - sl;
    if (risk <= 0) return null;

    this.log(`RLE detectado. Aguardando rompimento em ${breakout.high.toFixed(2)}.`, 'info');

    return {
      signal:          'BUY',
      setup:           'rle',
      reason:          `RLE — rompimento de ${consolidation.length} candles estreitos`,
      stopLossPrice:   sl,
      takeProfitPrice: price + (risk * 2),
      riskReward:      2.0,
    };
  }

  _check123(price, closed) {
    if (closed.length < 6) return null;

    const sma9  = this.getSMA(9);
    const ema21 = this.getEMA(21);
    if (!sma9 || !ema21) return null;

    const recent = closed.slice(-5);

    let c2Idx = -1;
    for (let i = 1; i < recent.length - 1; i++) {
      if (c2Idx === -1 || recent[i].low < recent[c2Idx].low) c2Idx = i;
    }
    if (c2Idx <= 0) return null;

    const c2 = recent[c2Idx];
    const c3 = recent[recent.length - 1];

    if (c3.low <= c2.low)     return null;
    if (!this._isBullish(c3)) return null;

    const nearSMA9  = Math.abs((c3.close - sma9)  / sma9)  * 100 <= 2.5;
    const nearEMA21 = Math.abs((c3.close - ema21) / ema21) * 100 <= 2.5;
    if (!nearSMA9 && !nearEMA21) return null;

    if (price <= c3.high) return null;

    this.log(`Padrão 123 de Compra identificado! Aguardando rompimento da máxima do Candle 3 em ${c3.high.toFixed(2)}.`, 'info');

    const sl   = c2.low;
    const risk = price - sl;
    if (risk <= 0) return null;

    return {
      signal:          'BUY',
      setup:           '123',
      reason:          `Setup 123 — SMA 9(${sma9.toFixed(2)}) / EMA 21(${ema21.toFixed(2)}) | descanso ${nearSMA9 ? 'SMA 9' : 'EMA 21'} ✓`,
      stopLossPrice:   sl,
      takeProfitPrice: price + (risk * 1.5),
      riskReward:      1.5,
    };
  }

  _checkContraBar(price, closed) {
    if (closed.length < 10) return null;

    const sma9  = this.getSMA(9);
    const ema21 = this.getEMA(21);
    if (!sma9 || !ema21) return null;

    const signal = closed[closed.length - 1];
    const prev   = closed[closed.length - 2];

    if (this._isBullish(signal)) return null;
    if (!this._isBullish(prev))  return null;

    const avgAmp10 = closed.slice(-10).reduce((s, c) => s + this._amp(c), 0) / 10;
    if (this._amp(signal) >= avgAmp10) return null;

    if (!this._isRestingNearSMA9(signal.close)) return null;

    if (price <= signal.high) return null;

    const sl     = signal.low;
    const barAmp = this._amp(signal);
    const risk   = price - sl;
    if (risk <= 0 || barAmp <= 0) return null;

    this.log(`Barra Contrária (scalp) detectada em ${signal.high.toFixed(2)}.`, 'info');

    return {
      signal:          'BUY',
      setup:           'contrabar',
      reason:          `Barra Contrária (scalp) — SMA 9(${sma9.toFixed(2)}) | amp ${barAmp.toFixed(2)} < média ${avgAmp10.toFixed(2)}`,
      stopLossPrice:   sl,
      takeProfitPrice: price + barAmp,
      riskReward:      barAmp / risk,
    };
  }

  _checkEngulfing(price, closed) {
    if (closed.length < 3) return null;

    const c2 = closed[closed.length - 1];
    const c1 = closed[closed.length - 2];

    if (this._body(c1) === 0 || this._body(c2) === 0) return null;

    const isBullishEngulf =
      this._isBullish(c2)  &&
      !this._isBullish(c1) &&
      c2.close > c1.open   &&
      c2.open  < c1.close;

    if (!isBullishEngulf) return null;

    const bias = this._trendBias();
    if (bias === 'DOWN') return null;

    if (price <= c2.high) return null;

    const sl   = c2.low;
    const risk = price - sl;
    if (risk <= 0) return null;

    this.log(`Engolfo de Alta detectado. Gatilho em ${c2.high.toFixed(2)}.`, 'info');

    return {
      signal:          'BUY',
      setup:           'engulfing',
      reason:          `Engolfo de Alta — C2 engolfa C1 completamente`,
      stopLossPrice:   sl,
      takeProfitPrice: price + (risk * 1.5),
      riskReward:      1.5,
    };
  }

  evaluateEntry(currentPrice, minCooldownMs) {
    const none = (reason) => ({ signal: null, reason, setup: null });

    if (this.candles.length < 22) return none('Histórico insuficiente (mín. 22 velas)');
    if (this.state.isAssetOpen)   return none('Posição já aberta — entradas bloqueadas');

    if (this.state.lastOrderTime) {
      const elapsed = Date.now() - this.state.lastOrderTime;
      if (elapsed < minCooldownMs) {
        const remaining = Math.round((minCooldownMs - elapsed) / 1000);
        return none(`Cooldown ativo (${remaining}s restantes)`);
      }
    }

    const closedCandles = this.candles.slice(0, -1);
    if (closedCandles.length < 5) return none('Poucos candles fechados');

    const ema21  = this.getEMA(21);
    const ema200 = this.getEMA(200);

    if (!this.state.scanLogged && ema21) {
      const rel = currentPrice > ema21 ? 'ACIMA' : 'ABAIXO';
      const dir = currentPrice > ema21 ? 'COMPRA' : 'VENDA';
      this.log(`Preço ${currentPrice.toFixed(2)} vs EMA 21: ${rel}. Procurando setups de ${dir}.`, 'info');
      this.state.scanLogged = true;
    }

    if (ema21 && currentPrice <= ema21) {
      return none(`Preço abaixo da EMA 21 (${ema21.toFixed(2)}) — somente vendas permitidas`);
    }

    const result =
      this._checkIgnition(currentPrice, closedCandles)  ||
      this._checkRLE(currentPrice, closedCandles)        ||
      this._check123(currentPrice, closedCandles)        ||
      this._checkContraBar(currentPrice, closedCandles)  ||
      this._checkEngulfing(currentPrice, closedCandles);

    if (!result) return none('Nenhum setup detectado');

    if (ema200 && ema200 > currentPrice) {
      const distPct = ((ema200 - currentPrice) / currentPrice) * 100;
      if (distPct <= 1.5) {
        this.log(`${result.setup.toUpperCase()} detectado, mas EMA 200 atua como barreira próxima (${distPct.toFixed(2)}%). Operação abortada.`, 'warning');
        return none(`EMA 200 (${ema200.toFixed(2)}) atuando como barreira — distância ${distPct.toFixed(2)}%`);
      }
    }

    if (result.riskReward < 1.0) {
      return none(`Payoff insuficiente (${result.riskReward.toFixed(1)}:1 < 1.0:1)`);
    }

    this.state.lastDetectedSetup = result;
    return result;
  }

  evaluateExit(currentPrice) {
    if (!this.state.isAssetOpen || !this.state.currentPosition) {
      return { shouldClose: false, reason: 'Nenhuma posição aberta' };
    }

    const { stopLoss, takeProfit } = this.state.currentPosition;

    if (currentPrice <= stopLoss) {
      return { shouldClose: true, reason: `Stop Loss atingido: ${currentPrice.toFixed(2)} ≤ ${stopLoss.toFixed(2)}` };
    }

    if (currentPrice >= takeProfit) {
      return { shouldClose: true, reason: `Take Profit atingido: ${currentPrice.toFixed(2)} ≥ ${takeProfit.toFixed(2)}` };
    }

    return { shouldClose: false, reason: 'Posição dentro dos limites' };
  }

  openPosition({ side, entryPrice, quantity, orderId, stopLossPrice, takeProfitPrice, stopLossPercent, takeProfitPercent, setup }) {
    const sl = stopLossPrice   ?? entryPrice * (1 - (stopLossPercent  ?? 0.5) / 100);
    const tp = takeProfitPrice ?? entryPrice * (1 + (takeProfitPercent ?? 1.0) / 100);

    this.state.isAssetOpen = true;
    this.state.currentPosition = {
      side, entryPrice, quantity, orderId,
      stopLoss:   sl,
      takeProfit: tp,
      setup:      setup ?? 'manual',
    };
    this.state.lastOrderTime = Date.now();

    console.log(
      `[Strategy] Posição aberta | Setup: ${setup} | Entrada: ${entryPrice} | SL: ${sl.toFixed(2)} | TP: ${tp.toFixed(2)} | R:R ${((tp - entryPrice) / (entryPrice - sl)).toFixed(2)}:1`
    );
  }

  closePosition() {
    console.log(`[Strategy] Posição fechada (setup: ${this.state.currentPosition?.setup ?? '—'}).`);
    this.state.isAssetOpen     = false;
    this.state.currentPosition = null;
  }

  getSnapshot() {
    const lastCandle = this.candles[this.candles.length - 1] ?? null;
    return {
      state: this.state,
      lastCandle,
      candleCount: this.candles.length,
      indicators: {
        sma9:   this.getSMA(9),
        ema21:  this.getEMA(21),
        ema200: this.getEMA(200),
        rsi14:  this.getRSI(14),
        trend:  this._trendBias(),
      },
    };
  }
}

module.exports = new PriceActionEngine();

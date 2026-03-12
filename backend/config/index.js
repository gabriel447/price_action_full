require('dotenv').config();

const useTestnet = process.env.BINANCE_USE_TESTNET
  ? String(process.env.BINANCE_USE_TESTNET).toLowerCase().trim() === 'true'
  : true;

console.log(`[Config] Modo de operação: ${useTestnet ? 'TESTNET (Dinheiro Fictício)' : 'MAINNET (Dinheiro Real)'}`);

const config = {
  binance: {
    apiKey:     process.env.BINANCE_API_KEY,
    apiSecret:  process.env.BINANCE_API_SECRET,
    useTestnet,
    httpBase: useTestnet
      ? 'https://testnet.binance.vision'
      : 'https://api.binance.com',
    wsBase: useTestnet
      ? 'wss://stream.testnet.binance.vision:9443/ws'
      : 'wss://stream.binance.com:9443/ws',
  },
  trading: {
    symbol:             process.env.SYMBOL || 'BTCUSDT',
    interval:           process.env.CANDLE_INTERVAL || '1m',
    riskPercent:        parseFloat(process.env.RISK_PERCENT) || 1.0,
    quantity:           parseFloat(process.env.MAX_ORDER_QUANTITY) || 0.001,
    stopLossPercent:    parseFloat(process.env.STOP_LOSS_PERCENT) || 0.5,
    takeProfitPercent:  parseFloat(process.env.TAKE_PROFIT_PERCENT) || 1.0,
    minOrderCooldownMs: parseInt(process.env.MIN_ORDER_COOLDOWN_MS) || 60000,
  },
  server: {
    port: parseInt(process.env.PORT) || 3001,
  },
};

function validateConfig() {
  const required = ['BINANCE_API_KEY', 'BINANCE_API_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`[Config] Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  }
}

validateConfig();

module.exports = config;

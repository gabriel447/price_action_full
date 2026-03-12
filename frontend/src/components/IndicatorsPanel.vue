<template>
  <div class="indicators" :class="{ 'flash-success': store.orderFlash }">
    <div class="indicators__header">
      <span class="indicators__title">Indicadores</span>
      <!-- Trend bias badge -->
      <span class="trend-badge" :class="trendBadgeClass">{{ trendLabel }}</span>
    </div>

    <!-- Active setup badge -->
    <div v-if="activeSetup" class="setup-badge">
      <span class="setup-badge__dot"></span>
      <span class="setup-badge__name">{{ setupLabel }}</span>
      <span class="setup-badge__rr">R:R {{ activeSetup.riskReward }}:1</span>
    </div>

    <div class="indicators__grid">
      <!-- SMA 9 -->
      <div class="ind">
        <span class="ind__label">SMA 9</span>
        <span class="ind__value mono" :style="{ color: '#9C27B0' }"><!-- Púrpura -->
          {{ fmt(store.indicators.sma9) }}
        </span>
      </div>

      <!-- EMA 21 -->
      <div class="ind">
        <span class="ind__label">EMA 21</span>
        <span class="ind__value mono" :style="{ color: '#3F51B5' }"><!-- Indigo -->
          {{ fmt(store.indicators.ema21) }}
        </span>
      </div>

      <!-- EMA 200 -->
      <div class="ind">
        <span class="ind__label">EMA 200</span>
        <span class="ind__value mono" :style="{ color: '#FF9800' }"><!-- Laranja -->
          {{ fmt(store.indicators.ema200) }}
        </span>
      </div>

      <!-- RSI 14 with bar -->
      <div class="ind ind--wide">
        <span class="ind__label">RSI 14</span>
        <span class="ind__value mono" :class="rsiClass">
          {{ fmtRsi(store.indicators.rsi14) }}
        </span>
        <div class="ind__bar">
          <div class="ind__bar-fill" :style="rsiBarStyle"></div>
          <div class="ind__bar-ob"></div>
          <div class="ind__bar-os"></div>
        </div>
      </div>
    </div>

    <!-- MA alignment summary -->
    <div class="ma-align">
      <div class="ma-align__row" :class="ema9AboveEma21Class">
        <span class="ma-align__dot"></span>
        <span>SMA 9 {{ ema9AboveEma21 ? '>' : '<' }} EMA 21</span>
            <span class="ma-align__tag">{{ ema9AboveEma21 ? 'Alta' : 'Baixa' }}</span>
      </div>
      <div v-if="store.indicators.ema200" class="ma-align__row" :class="ema21AboveEma200Class">
        <span class="ma-align__dot"></span>
        <span>EMA 21 {{ ema21AboveEma200 ? '>' : '<' }} EMA 200</span>
            <span class="ma-align__tag">{{ ema21AboveEma200 ? 'Alta' : 'Baixa' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(val) {
  if (val === null || val === undefined) return '—'
  const p = parseFloat(val)
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1) return p.toFixed(4)
  return p.toFixed(8)
}

function fmtRsi(val) {
  if (val === null || val === undefined) return '—'
  return val.toFixed(1)
}

// ── Trend bias ────────────────────────────────────────────────────────────────

const trendLabel = computed(() => {
  const t = store.indicators.trend
  if (t === 'UP') return '↑ ALTA'
  if (t === 'DOWN') return '↓ BAIXA'
  return '— NEUTRO'
})

const trendBadgeClass = computed(() => ({
  'trend-badge--up': store.indicators.trend === 'UP',
  'trend-badge--down': store.indicators.trend === 'DOWN',
  'trend-badge--neutral': store.indicators.trend === 'NEUTRAL' || !store.indicators.trend,
}))

// ── EMA comparisons ───────────────────────────────────────────────────────────

const ema9AboveEma21 = computed(() => {
  const { sma9, ema21 } = store.indicators
  return sma9 !== null && ema21 !== null && sma9 > ema21
})

const ema21AboveEma200 = computed(() => {
  const { ema21, ema200 } = store.indicators
  return ema21 !== null && ema200 !== null && ema21 > ema200
})

const ema9AboveEma21Class = computed(() => ({
  'ma-align__row--up': ema9AboveEma21.value,
  'ma-align__row--down': !ema9AboveEma21.value,
}))

const ema21AboveEma200Class = computed(() => ({
  'ma-align__row--up': ema21AboveEma200.value,
  'ma-align__row--down': !ema21AboveEma200.value,
}))

// ── Active setup ──────────────────────────────────────────────────────────────

const activeSetup = computed(() => store.position?.setup
  ? { setup: store.position.setup, riskReward: '?' }
  : store.indicators?.lastSetup ?? null
)

const SETUP_NAMES = {
  ignition: 'Barra de Ignição',
  rle: 'Rompimento Lateral',
  '123': 'Setup 123',
  contrabar: 'Barra Contrária',
  engulfing: 'Engolfo de Alta',
  manual: 'Manual',
}

const setupLabel = computed(() => {
  const s = store.position?.setup ?? store.state?.lastDetectedSetup?.setup
  return SETUP_NAMES[s] ?? s
})

// ── RSI ───────────────────────────────────────────────────────────────────────

const rsiClass = computed(() => {
  const v = store.indicators.rsi14
  if (v === null) return ''
  if (v >= 70) return 'text-down'
  if (v <= 30) return 'text-up'
  return ''
})

const rsiBarStyle = computed(() => {
  const v = store.indicators.rsi14
  if (v === null) return { width: '0%', background: 'var(--neutral)' }
  const pct = Math.min(Math.max(v, 0), 100)
  let color = 'var(--text-secondary)'
  if (v >= 70) color = 'var(--down-color)'
  else if (v <= 30) color = 'var(--up-color)'
  return { width: `${pct}%`, background: color }
})
</script>

<style scoped>
.indicators {
  background: var(--bg-card);
  padding: 14px 18px;
  transition: background-color 0.2s ease;
}

.indicators__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.indicators__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* ── Trend badge ──────────────────────────────────────────────────────────── */
.trend-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 3px;
  border: 1px solid transparent;
}

.trend-badge--up {
  background: var(--up-color-dim);
  border-color: var(--up-color);
  color: var(--up-color);
}

.trend-badge--down {
  background: var(--down-color-dim);
  border-color: var(--down-color);
  color: var(--down-color);
}

.trend-badge--neutral {
  background: var(--bg-card-alt);
  border-color: var(--border);
  color: var(--text-muted);
}

/* ── Active setup badge ───────────────────────────────────────────────────── */
.setup-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--accent-dim);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  margin-bottom: 12px;
  font-size: 11px;
}

.setup-badge__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
  animation: pulse-ok 1.5s infinite;
}

.setup-badge__name {
  flex: 1;
  font-weight: 600;
  color: var(--accent);
}

.setup-badge__rr {
  font-weight: 700;
  color: var(--up-color);
  font-size: 10px;
}

/* ── Indicator rows ───────────────────────────────────────────────────────── */
.indicators__grid {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-bottom: 12px;
}

.ind {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ind--wide {
  flex-wrap: wrap;
}

.ind__label {
  font-size: 12px;
  color: var(--text-secondary);
  min-width: 55px;
}

.ind__value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: right;
  flex: 1;
}

/* RSI bar */
.ind__bar {
  position: relative;
  width: 100%;
  height: 3px;
  background: var(--bg-card-alt);
  border-radius: 2px;
  margin-top: 4px;
  overflow: visible;
}

.ind__bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease, background 0.4s ease;
}

.ind__bar-ob {
  position: absolute;
  left: 70%;
  top: -2px;
  width: 1px;
  height: 7px;
  background: var(--down-color);
  opacity: 0.5;
}

.ind__bar-os {
  position: absolute;
  left: 30%;
  top: -2px;
  width: 1px;
  height: 7px;
  background: var(--up-color);
  opacity: 0.5;
}

/* ── MA alignment summary ─────────────────────────────────────────────────── */
.ma-align {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-top: 1px solid var(--border-dim);
  padding-top: 10px;
}

.ma-align__row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.ma-align__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ma-align__row--up .ma-align__dot {
  background: var(--up-color);
}

.ma-align__row--down .ma-align__dot {
  background: var(--down-color);
}

.ma-align__tag {
  margin-left: auto;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.ma-align__row--up .ma-align__tag {
  color: var(--up-color);
}

.ma-align__row--down .ma-align__tag {
  color: var(--down-color);
}

@keyframes pulse-ok {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }
}

/* Flash visual para execução de ordem */
.flash-success {
  background-color: rgba(0, 230, 118, 0.15) !important;
  box-shadow: 0 0 15px rgba(0, 230, 118, 0.2) inset;
}
</style>

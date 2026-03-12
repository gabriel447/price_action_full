<template>
  <div class="chart-wrapper">
    <div class="chart-header">
      <div class="chart-header__left">
        <span class="chart-header__title">{{ symbol }}</span>

        <!-- Timeframe switcher -->
        <div class="tf-switcher">
          <button
            v-for="tf in timeframes"
            :key="tf"
            class="tf-btn"
            :class="{
              'tf-btn--active':    store.currentTimeframe === tf,
              'tf-btn--switching': store.timeframeSwitching && store.currentTimeframe !== tf,
            }"
            :disabled="store.timeframeSwitching"
            @click="onChangeTimeframe(tf)"
          >
            {{ tf }}
          </button>
        </div>
      </div>

      <div class="chart-header__right">
        <span v-if="store.timeframeSwitching" class="chart-header__status">
          Carregando...
        </span>
        <span class="chart-header__count text-muted mono">{{ store.candles.length }} velas</span>
        <span class="chart-header__tz text-muted">UTC</span>
      </div>
    </div>

    <div ref="chartEl" class="chart-canvas"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, inject } from 'vue'
import { createChart } from 'lightweight-charts'
import { useTradingStore } from '../stores/trading'

const props = defineProps({
  onChangeTimeframe: {
    type: Function,
    required: true,
  },
})

const store = useTradingStore()
const chartEl = ref(null)

const symbol    = import.meta.env.VITE_SYMBOL   ?? 'BTC/USDT'
const timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '4h']

let chart        = null
let candleSeries = null
let ema9Series   = null
let ema21Series  = null
let rafId        = null

let pendingCandle = null
let pendingEma    = null

// ─────────────────────────────────────────────────────────────────────────────
// Chart init
// ─────────────────────────────────────────────────────────────────────────────

function initChart() {
  if (!chartEl.value) return

  chart = createChart(chartEl.value, {
    width:  chartEl.value.clientWidth,
    height: chartEl.value.clientHeight,
    layout: {
      background: { color: '#131315' },
      textColor:  '#8888a0',
    },
    grid: {
      vertLines: { color: '#2a2a2f' },
      horzLines: { color: '#2a2a2f' },
    },
    crosshair: { mode: 1 },
    rightPriceScale: { borderColor: '#2a2a2f' },
    timeScale: {
      borderColor:     '#2a2a2f',
      timeVisible:     true,
      secondsVisible:  false,
      // Force UTC display via custom tick formatter
      tickMarkFormatter: (timeAsUnixSeconds) => {
        const d = new Date(timeAsUnixSeconds * 1000)
        const hh = String(d.getUTCHours()).padStart(2, '0')
        const mm = String(d.getUTCMinutes()).padStart(2, '0')
        return `${hh}:${mm}`
      },
    },
    localization: {
      // Full datetime in UTC shown in the crosshair label
      timeFormatter: (timeAsUnixSeconds) => {
        const d = new Date(timeAsUnixSeconds * 1000)
        return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
      },
      // Price formatter — crypto precision (up to 8 decimals, strip trailing zeros)
      priceFormatter: (price) => {
        if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        if (price >= 1)    return price.toFixed(4)
        return price.toFixed(8)
      },
    },
  })

  candleSeries = chart.addCandlestickSeries({
    upColor:         '#00e676',
    downColor:       '#ff3d5a',
    borderUpColor:   '#00e676',
    borderDownColor: '#ff3d5a',
    wickUpColor:     '#00e676',
    wickDownColor:   '#ff3d5a',
  })

  ema9Series = chart.addLineSeries({
    color:            '#7c4dff',
    lineWidth:        1,
    priceLineVisible: false,
    lastValueVisible: true,
    title:            'EMA9',
  })

  ema21Series = chart.addLineSeries({
    color:            '#ffab00',
    lineWidth:        1,
    priceLineVisible: false,
    lastValueVisible: true,
    title:            'EMA21',
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Data helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Binance timestamps are in ms; lightweight-charts needs seconds. */
function toChartCandle(c) {
  return {
    time:  Math.floor(c.time / 1000),
    open:  c.open,
    high:  c.high,
    low:   c.low,
    close: c.close,
  }
}

function loadInitialData(candles) {
  if (!candleSeries || candles.length === 0) return

  const chartData = [...candles].map(toChartCandle).sort((a, b) => a.time - b.time)
  candleSeries.setData(chartData)

  const ema9Data  = store.emaHistory.filter((e) => e.ema9  !== null).map((e) => ({ time: Math.floor(e.time / 1000), value: e.ema9  }))
  const ema21Data = store.emaHistory.filter((e) => e.ema21 !== null).map((e) => ({ time: Math.floor(e.time / 1000), value: e.ema21 }))
  if (ema9Data.length)  ema9Series.setData(ema9Data)
  if (ema21Data.length) ema21Series.setData(ema21Data)

  chart.timeScale().fitContent()
}

/** Clears all chart series — called when timeframe switches. */
function clearChart() {
  if (!candleSeries) return
  candleSeries.setData([])
  ema9Series.setData([])
  ema21Series.setData([])
}

// ─────────────────────────────────────────────────────────────────────────────
// rAF-batched updates
// ─────────────────────────────────────────────────────────────────────────────

function scheduleUpdate(candle, ema) {
  if (candle) pendingCandle = candle
  if (ema)    pendingEma    = ema
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    flushUpdates()
  })
}

function flushUpdates() {
  if (!candleSeries) return
  if (pendingCandle) {
    candleSeries.update(toChartCandle(pendingCandle))
    pendingCandle = null
  }
  if (pendingEma) {
    const t = Math.floor(pendingEma.time / 1000)
    if (pendingEma.ema9  !== null) ema9Series.update({ time: t, value: pendingEma.ema9  })
    if (pendingEma.ema21 !== null) ema21Series.update({ time: t, value: pendingEma.ema21 })
    pendingEma = null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Watchers
// ─────────────────────────────────────────────────────────────────────────────

// One-time initial load
const stopWatchCandles = watch(
  () => store.candles.length,
  (len, prevLen) => {
    if (len > 0 && prevLen === 0) {
      loadInitialData(store.candles)
      stopWatchCandles()
    }
  }
)

// Reload when timeframe changes (candles array is reset by store)
watch(
  () => store.timeframeSwitching,
  (switching) => {
    if (switching) clearChart()
  }
)

// Reload when new candle batch arrives after timeframe switch
watch(
  () => store.candles.length,
  (len) => {
    if (len > 0 && !store.timeframeSwitching && candleSeries) {
      const seriesData = candleSeries.data ? null : null // check if empty — reload
      loadInitialData(store.candles)
    }
  }
)

// New closed candle
watch(
  () => store.candles[store.candles.length - 1],
  (newCandle) => {
    if (!newCandle || !candleSeries || store.timeframeSwitching) return
    scheduleUpdate(newCandle, null)
  }
)

// New EMA data
watch(
  () => store.emaHistory.length,
  () => {
    const last = store.emaHistory[store.emaHistory.length - 1]
    if (!last || store.timeframeSwitching) return
    scheduleUpdate(null, last)
  }
)

// Live price tick updates open candle
watch(
  () => store.currentPrice,
  (price) => {
    if (!price || store.candles.length === 0 || !candleSeries || store.timeframeSwitching) return
    const last = store.candles[store.candles.length - 1]
    if (!last) return
    scheduleUpdate({ ...last, close: price }, null)
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// Resize
// ─────────────────────────────────────────────────────────────────────────────

let resizeObserver = null

function handleResize(entries) {
  if (!chart) return
  const { width, height } = entries[0].contentRect
  chart.applyOptions({ width, height })
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

onMounted(() => {
  initChart()
  if (store.candles.length > 0) loadInitialData(store.candles)

  resizeObserver = new ResizeObserver(handleResize)
  resizeObserver.observe(chartEl.value)
})

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId)
  if (resizeObserver) resizeObserver.disconnect()
  if (chart) { chart.remove(); chart = null }
})
</script>

<style scoped>
.chart-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-secondary);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-dim);
  flex-shrink: 0;
  gap: 12px;
}

.chart-header__left,
.chart-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chart-header__title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text-primary);
}

.chart-header__count,
.chart-header__tz {
  font-size: 11px;
}

.chart-header__tz {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

.chart-header__status {
  font-size: 11px;
  color: var(--warning);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}

/* ── Timeframe switcher ──────────────────────────────────────────────────── */
.tf-switcher {
  display: flex;
  align-items: center;
  gap: 2px;
}

.tf-btn {
  padding: 3px 8px;
  border-radius: 3px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s ease;
  letter-spacing: 0.04em;
}

.tf-btn:hover:not(:disabled) {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border);
}

.tf-btn--active {
  background: var(--accent-dim) !important;
  border-color: var(--accent) !important;
  color: var(--accent) !important;
}

.tf-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chart-canvas {
  flex: 1;
  width: 100%;
  min-height: 0;
}
</style>

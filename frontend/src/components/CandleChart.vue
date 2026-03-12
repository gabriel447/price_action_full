<template>
  <div class="chart-wrapper">
    <div class="chart-header">
      <div class="chart-header__left">
        <span class="chart-header__title">{{ symbol }}</span>
        <span class="chart-header__tf">{{ store.currentTimeframe }}</span>
      </div>

      <div class="chart-header__right">
        <span class="chart-header__count text-muted mono">{{ store.candles.length }} velas</span>
        <span class="chart-header__tz text-muted">UTC</span>
      </div>
    </div>

    <div ref="chartEl" class="chart-canvas"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { createChart } from 'lightweight-charts'
import { useTradingStore } from '../stores/trading'

defineProps({
  onChangeTimeframe: { type: Function, required: true },
})

const store = useTradingStore()
const chartEl = ref(null)

const symbol = import.meta.env.VITE_SYMBOL ?? 'BTC/USDT'

let chart        = null
let candleSeries = null
let ema9Series   = null
let ema21Series  = null
let ema200Series = null
let rafId        = null

let pendingCandle = null
let pendingEma    = null

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
      borderColor:    '#2a2a2f',
      timeVisible:    true,
      secondsVisible: false,
      barSpacing:     10,
      tickMarkFormatter: (timeAsUnixSeconds) => {
        const d = new Date(timeAsUnixSeconds * 1000)
        const hh = String(d.getUTCHours()).padStart(2, '0')
        const mm = String(d.getUTCMinutes()).padStart(2, '0')
        return `${hh}:${mm}`
      },
    },
    localization: {
      timeFormatter: (timeAsUnixSeconds) => {
        const d = new Date(timeAsUnixSeconds * 1000)
        return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
      },
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
    wickUpColor:     '#4CAF50',
    wickDownColor:   '#e53935',
  })

  ema9Series = chart.addLineSeries({
    color:            '#E040FB',
    lineWidth:        2,
    priceLineVisible: false,
    lastValueVisible: true,
    title:            'SMA9',
  })

  ema21Series = chart.addLineSeries({
    color:            '#26C6DA',
    lineWidth:        2,
    priceLineVisible: false,
    lastValueVisible: true,
    title:            'EMA21',
  })

  ema200Series = chart.addLineSeries({
    color:            '#FFA726',
    lineWidth:        2,
    priceLineVisible: false,
    lastValueVisible: true,
    title:            'EMA200',
  })
}

function toChartCandle(c) {
  const bodyLow  = Math.min(c.open, c.close)
  const bodyHigh = Math.max(c.open, c.close)
  const maxWick  = bodyLow * 0.08
  return {
    time:  Math.floor(c.time / 1000),
    open:  c.open,
    high:  Math.min(c.high, bodyHigh + maxWick),
    low:   Math.max(c.low,  bodyLow  - maxWick),
    close: c.close,
  }
}

function loadInitialData(candles) {
  if (!candleSeries || candles.length === 0) return

  const chartData = [...candles].map(toChartCandle).sort((a, b) => a.time - b.time)
  candleSeries.setData(chartData)

  const ema9Data   = store.emaHistory.filter((e) => e.sma9   != null).map((e) => ({ time: Math.floor(e.time / 1000), value: e.sma9   }))
  const ema21Data  = store.emaHistory.filter((e) => e.ema21  != null).map((e) => ({ time: Math.floor(e.time / 1000), value: e.ema21  }))
  const ema200Data = store.emaHistory.filter((e) => e.ema200 != null).map((e) => ({ time: Math.floor(e.time / 1000), value: e.ema200 }))
  if (ema9Data.length)   ema9Series.setData(ema9Data)
  if (ema21Data.length)  ema21Series.setData(ema21Data)
  if (ema200Data.length) ema200Series.setData(ema200Data)

  chart.timeScale().scrollToRealTime()
}

function clearChart() {
  if (!candleSeries) return
  candleSeries.setData([])
  ema9Series.setData([])
  ema21Series.setData([])
  ema200Series.setData([])
}

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
    if (pendingEma.sma9   != null) ema9Series.update({ time: t, value: pendingEma.sma9   })
    if (pendingEma.ema21  != null) ema21Series.update({ time: t, value: pendingEma.ema21  })
    if (pendingEma.ema200 != null) ema200Series.update({ time: t, value: pendingEma.ema200 })
    pendingEma = null
  }
}

watch(
  () => store.candles.length,
  (len, prevLen) => {
    if (len > 0 && prevLen === 0 && candleSeries) {
      loadInitialData(store.candles)
    }
  }
)

watch(
  () => store.timeframeSwitching,
  (switching) => {
    if (switching) clearChart()
  }
)

watch(
  () => store.candles[store.candles.length - 1],
  (newCandle, prevCandle) => {
    if (!newCandle || !candleSeries || store.timeframeSwitching) return
    if (prevCandle && newCandle.time === prevCandle.time) return
    scheduleUpdate(newCandle, null)
  }
)

watch(
  () => store.emaHistory.length,
  () => {
    const last = store.emaHistory[store.emaHistory.length - 1]
    if (!last || store.timeframeSwitching) return
    scheduleUpdate(null, last)
  }
)

watch(
  () => store.liveCandle,
  (candle) => {
    if (!candle || !candleSeries || store.timeframeSwitching) return
    scheduleUpdate(candle, null)
  }
)

let resizeObserver = null

function handleResize(entries) {
  if (!chart) return
  const { width, height } = entries[0].contentRect
  chart.applyOptions({ width, height })
}

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

.chart-header__tf {
  background: var(--accent-dim, rgba(124, 77, 255, 0.15));
  border: 1px solid var(--accent, #7c4dff);
  border-radius: 3px;
  padding: 1px 7px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--accent, #7c4dff);
}

.chart-canvas {
  flex: 1;
  width: 100%;
  min-height: 0;
}
</style>

<template>
    <div class="chart-container" ref="chartContainer"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { createChart } from 'lightweight-charts'
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()
const chartContainer = ref(null)
let chart = null
let candleSeries = null
let sma9Series = null
let ema21Series = null
let ema200Series = null

// Colors requested
const COLOR_SMA9 = '#9C27B0'   // Púrpura (SMA 9)
const COLOR_EMA21 = '#3F51B5'  // Indigo (EMA 21)
const COLOR_EMA200 = '#FF9800' // Laranja (EMA 200)

onMounted(() => {
    if (!chartContainer.value) return

    chart = createChart(chartContainer.value, {
        layout: { background: { color: '#0a0a0a' }, textColor: '#888' },
        grid: { vertLines: { color: '#1a1a1a' }, horzLines: { color: '#1a1a1a' } },
        timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#333' },
        rightPriceScale: { borderColor: '#333' },
    })

    candleSeries = chart.addCandlestickSeries({
        upColor: '#00e676',
        downColor: '#ff5252',
        borderVisible: false,
        wickUpColor: '#00e676',
        wickDownColor: '#ff5252'
    })

    // 1. Desenhar as Linhas das Médias
    sma9Series = chart.addLineSeries({ color: COLOR_SMA9, lineWidth: 1, title: 'SMA 9' })
    ema21Series = chart.addLineSeries({ color: COLOR_EMA21, lineWidth: 1, title: 'EMA 21' })
    ema200Series = chart.addLineSeries({ color: COLOR_EMA200, lineWidth: 1, title: 'EMA 200' })

    // Carregamento inicial
    syncData()

    // Resize automático
    const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || !entries[0].contentRect) return
        const { width, height } = entries[0].contentRect
        chart.applyOptions({ width, height })
    })
    resizeObserver.observe(chartContainer.value)

    onUnmounted(() => {
        resizeObserver.disconnect()
        if (chart) {
            chart.remove()
            chart = null
        }
    })
})

// Atualização de Candles (Histórico ou Timeframe change)
watch([() => store.candles, () => store.emaHistory], () => {
    syncData()
}, { deep: true })

// Atualização em Tempo Real (Tick a Tick)
watch(() => store.currentPrice, () => {
    if (!chart || store.candles.length === 0) return

    const last = store.candles[store.candles.length - 1]
    const time = last.time / 1000 // Lightweight charts usa segundos

    candleSeries.update({
        time, open: last.open, high: last.high, low: last.low, close: last.close
    })

    // Atualiza a ponta das linhas com o valor mais recente do store
    if (store.indicators) {
        if (store.indicators.sma9) sma9Series.update({ time, value: store.indicators.sma9 })
        if (store.indicators.ema21) ema21Series.update({ time, value: store.indicators.ema21 })
        if (store.indicators.ema200) ema200Series.update({ time, value: store.indicators.ema200 })
    }
})

function syncData() {
    if (!chart || !store.candles.length) return

    const candleData = store.candles.map(c => ({
        time: c.time / 1000,
        open: c.open, high: c.high, low: c.low, close: c.close
    }))
    candleSeries.setData(candleData)

    // Mapeia emaHistory para as linhas
    const mapInd = (key) => store.emaHistory
        .filter(e => e[key] !== null && e[key] !== undefined)
        .map(e => ({ time: e.time / 1000, value: e[key] }))

    sma9Series.setData(mapInd('sma9'))
    ema21Series.setData(mapInd('ema21'))
    ema200Series.setData(mapInd('ema200'))
}
</script>

<style scoped>
.chart-container {
    width: 100%;
    height: 450px;
    position: relative;
    background: #0a0a0a;
}
</style>
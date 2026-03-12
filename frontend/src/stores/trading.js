import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useTradingStore = defineStore('trading', () => {
  const socketConnected = ref(false)
  const marketWsStatus = ref('disconnected')

  const currentPrice = ref(null)
  const prevPrice = ref(null)
  const priceDirection = ref('neutral')
  let priceFlashTimer = null

  const isPositionOpen = ref(false)
  const position = ref(null)
  const lastOrderTime = ref(null)

  const candles = ref([])
  const indicators = ref({ sma9: null, ema21: null, ema200: null, rsi14: null, trend: 'NEUTRAL' })

  const emaHistory = ref([])
  const liveCandle = ref(null)

  const consoleLogs = ref([])
  const tradeHistory = ref([])

  const soundEnabled = ref(false)
  const lastAudioEvent = ref(null)
  const orderFlash = ref(false)

  const walletBalance = ref(null)

  const currentTimeframe = ref('1m')
  const timeframeSwitching = ref(false)

  const lastError = ref(null)

  const canOpenOrder = computed(() => !isPositionOpen.value && socketConnected.value)

  const unrealizedPnl = computed(() => {
    if (!isPositionOpen.value || !position.value || currentPrice.value === null) return null
    const { entryPrice, quantity } = position.value
    return ((currentPrice.value - entryPrice) * quantity).toFixed(4)
  })

  const unrealizedPnlPercent = computed(() => {
    if (!isPositionOpen.value || !position.value || currentPrice.value === null) return null
    const { entryPrice } = position.value
    return (((currentPrice.value - entryPrice) / entryPrice) * 100).toFixed(2)
  })

  function handleSnapshot(data) {
    const { state, indicators: ind, interval } = data
    if (interval) currentTimeframe.value = interval

    isPositionOpen.value = state.isAssetOpen
    position.value = state.currentPosition
    lastOrderTime.value = state.lastOrderTime

    if (ind) {
      indicators.value = { ...indicators.value, ...ind }
      if (candles.value.length > 0) {
        const lastTime = candles.value[candles.value.length - 1].time
        const existing = emaHistory.value.findIndex((e) => e.time === lastTime)
        const entry = { time: lastTime, sma9: ind.sma9, ema21: ind.ema21, ema200: ind.ema200 }
        if (existing >= 0) emaHistory.value[existing] = entry
        else emaHistory.value.push(entry)
      }
    }
  }

  function handleTick(tick) {
    const newPrice = tick.price
    if (currentPrice.value !== null && newPrice !== currentPrice.value) {
      prevPrice.value = currentPrice.value
      priceDirection.value = newPrice > currentPrice.value ? 'up' : 'down'

      if (priceFlashTimer) clearTimeout(priceFlashTimer)
      priceFlashTimer = setTimeout(() => {
        priceDirection.value = 'neutral'
      }, 600)
    }
    currentPrice.value = newPrice
  }

  function handleCandleClosed(candle) {
    candles.value.push(candle)
    if (candles.value.length > 500) candles.value.shift()
  }

  async function loadHistoricalCandles() {
    try {
      const res = await fetch(`/candles?_t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      candles.value = data.map(c => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume
      }))

      emaHistory.value = data.map(c => ({
        time: c.time,
        sma9: c.sma9,
        ema21: c.ema21,
        ema200: c.ema200
      }))
    } catch (err) {
      console.error('[Store] Failed to load historical candles:', err.message)
    }
  }

  function handleOrder(order) {
    tradeHistory.value.unshift({ ...order, id: `${order.orderId}-${order.time}` })
    if (tradeHistory.value.length > 200) tradeHistory.value.pop()

    triggerSound('execution')
    triggerOrderFlash()
  }

  function handleLiveCandle(candle) {
    liveCandle.value = candle
  }

  function handleWsStatus(data) {
    marketWsStatus.value = data.status
  }

  function setSocketConnected(val) {
    socketConnected.value = val
  }

  function handleWalletBalance(data) {
    walletBalance.value = data
  }

  function handleTimeframeChanged(data) {
    currentTimeframe.value = data.interval
    timeframeSwitching.value = false
    candles.value = []
    emaHistory.value = []
    loadHistoricalCandles()
  }

  function requestTimeframeChange() {
    timeframeSwitching.value = true
  }

  function handleError(data) {
    lastError.value = { message: data.message, time: data.time }
    timeframeSwitching.value = false
    console.error('[Store] Bot error:', data.message)
    triggerSound('alert')
  }

  function handleLog(log) {
    consoleLogs.value.push(log)
    if (consoleLogs.value.length > 20) consoleLogs.value.shift()

    if (log.type === 'success' || (log.type === 'info' && (log.message.includes('detectado') || log.message.includes('identificado')))) {
      triggerSound('setup')
    }
  }

  function toggleSound() {
    soundEnabled.value = !soundEnabled.value
  }

  function triggerSound(type) {
    if (soundEnabled.value) {
      lastAudioEvent.value = { type, id: Date.now() }
    }
  }

  function triggerOrderFlash() {
    orderFlash.value = true
    setTimeout(() => { orderFlash.value = false }, 800)
  }

  return {
    socketConnected,
    marketWsStatus,
    currentPrice,
    priceDirection,
    isPositionOpen,
    position,
    lastOrderTime,
    candles,
    indicators,
    emaHistory,
    liveCandle,
    consoleLogs,
    tradeHistory,
    soundEnabled,
    lastAudioEvent,
    orderFlash,
    lastError,
    canOpenOrder,
    unrealizedPnl,
    unrealizedPnlPercent,
    walletBalance,
    currentTimeframe,
    timeframeSwitching,
    handleSnapshot,
    handleTick,
    handleCandleClosed,
    loadHistoricalCandles,
    handleOrder,
    handleLiveCandle,
    handleWsStatus,
    setSocketConnected,
    handleWalletBalance,
    handleTimeframeChanged,
    requestTimeframeChange,
    handleError,
    handleLog,
    toggleSound,
  }
})

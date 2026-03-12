import { onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import { useTradingStore } from '../stores/trading'

let socket = null

export function useSocket() {
  const store = useTradingStore()

  onMounted(async () => {
    await store.loadHistoricalCandles()

    socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => {
      console.log('[Socket.io] Conectado:', socket.id)
      store.setSocketConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.warn('[Socket.io] Desconectado:', reason)
      store.setSocketConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket.io] Erro de conexão:', err.message)
      store.setSocketConnected(false)
    })

    socket.on('snapshot',         (data)   => store.handleSnapshot(data))
    socket.on('tick',             (data)   => store.handleTick(data))
    socket.on('liveCandle',       (candle) => store.handleLiveCandle(candle))
    socket.on('candleClosed',     (candle) => store.handleCandleClosed(candle))
    socket.on('order',            (order)  => store.handleOrder(order))
    socket.on('wsStatus',         (data)   => store.handleWsStatus(data))
    socket.on('walletBalance',    (data)   => store.handleWalletBalance(data))
    socket.on('timeframeChanged', (data)   => store.handleTimeframeChanged(data))
    socket.on('cancelAllOrders',  ()       => { })
    socket.on('error',            (data)   => store.handleError(data))
    socket.on('log',              (data)   => store.handleLog(data))
  })

  onUnmounted(() => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  })

  function panicClose() {
    if (socket?.connected) {
      socket.emit('cancelAllOrders')
    }
  }

  function changeTimeframe(interval) {
    if (!socket?.connected) return
    store.requestTimeframeChange()
    socket.emit('changeTimeframe', interval)
  }

  return { panicClose, changeTimeframe }
}

export function getSocket() {
  return socket
}

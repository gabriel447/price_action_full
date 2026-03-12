<template>
  <div class="conn">
    <!-- Socket.io connection to our backend -->
    <div class="conn__item" :class="socketClass">
      <span class="conn__dot"></span>
      <span class="conn__label">API</span>
    </div>

    <!-- Broker WebSocket status (relayed from backend) -->
    <div class="conn__item" :class="wsClass">
      <span class="conn__dot"></span>
      <span class="conn__label">Broker WS</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()

const socketClass = computed(() => ({
  'conn__item--ok':    store.socketConnected,
  'conn__item--error': !store.socketConnected,
}))

const wsClass = computed(() => ({
  'conn__item--ok':      store.marketWsStatus === 'connected',
  'conn__item--warning': store.marketWsStatus === 'disconnected',
  'conn__item--error':   store.marketWsStatus === 'error',
}))
</script>

<style scoped>
.conn {
  display: flex;
  align-items: center;
  gap: 14px;
}

.conn__item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.conn__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--neutral);
  flex-shrink: 0;
}

.conn__item--ok .conn__dot {
  background: var(--up-color);
  box-shadow: 0 0 6px var(--up-color);
  animation: pulse-ok 2s infinite;
}

.conn__item--ok .conn__label { color: var(--up-color); }

.conn__item--warning .conn__dot {
  background: var(--warning);
}

.conn__item--warning .conn__label { color: var(--warning); }

.conn__item--error .conn__dot {
  background: var(--down-color);
}

.conn__item--error .conn__label { color: var(--down-color); }

@keyframes pulse-ok {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
</style>

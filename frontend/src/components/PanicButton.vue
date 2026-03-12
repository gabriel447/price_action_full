<template>
  <div class="panic-wrap">
    <button
      class="panic-btn"
      :class="{ 'panic-btn--active': store.isPositionOpen, 'panic-btn--disabled': !store.isPositionOpen }"
      :disabled="!store.isPositionOpen || confirming"
      @click="handleClick"
      :title="store.isPositionOpen
        ? 'Cancel ALL orders na Binance + fecha posição rastreada'
        : 'Nenhuma posição aberta'"
    >
      <span class="panic-btn__icon">⚡</span>
      <span class="panic-btn__label">{{ label }}</span>
    </button>

    <!-- Confirm overlay -->
    <Transition name="confirm-fade">
      <div v-if="confirming" class="confirm-overlay">
        <span class="confirm-overlay__msg">Confirmar CANCEL ALL ORDERS?</span>
        <button class="confirm-btn confirm-btn--yes" @click="executeClose">Confirmar</button>
        <button class="confirm-btn confirm-btn--no"  @click="cancel">Cancelar</button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTradingStore } from '../stores/trading'

const props = defineProps({
  onPanic: {
    type: Function,
    required: true,
  },
})

const store = useTradingStore()
const confirming = ref(false)

const label = computed(() => {
  if (confirming.value) return '...'
  return store.isPositionOpen ? 'PANIC CLOSE' : 'PANIC CLOSE'
})

function handleClick() {
  if (!store.isPositionOpen) return
  confirming.value = true
}

function executeClose() {
  confirming.value = false
  props.onPanic()
}

function cancel() {
  confirming.value = false
}
</script>

<style scoped>
.panic-wrap {
  position: relative;
}

.panic-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.panic-btn--active {
  background: var(--down-color-dim);
  border-color: var(--down-color);
  color: var(--down-color);
  animation: panic-pulse 1.8s infinite;
}

.panic-btn--active:hover {
  background: var(--down-color);
  color: #fff;
}

.panic-btn--disabled {
  background: var(--bg-card);
  border-color: var(--border);
  color: var(--text-muted);
  cursor: not-allowed;
}

.panic-btn__icon { font-size: 14px; }

@keyframes panic-pulse {
  0%, 100% { box-shadow: none; }
  50%       { box-shadow: 0 0 10px rgba(255, 61, 90, 0.4); }
}

/* Confirm overlay */
.confirm-overlay {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
  border: 1px solid var(--down-color);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  white-space: nowrap;
  z-index: 200;
  box-shadow: var(--shadow);
}

.confirm-overlay__msg {
  font-size: 12px;
  color: var(--text-secondary);
  margin-right: 4px;
}

.confirm-btn {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.12s ease;
}

.confirm-btn--yes {
  background: var(--down-color);
  border-color: var(--down-color);
  color: #fff;
}

.confirm-btn--yes:hover { opacity: 0.85; }

.confirm-btn--no {
  background: var(--bg-card-alt);
  border-color: var(--border);
  color: var(--text-secondary);
}

.confirm-btn--no:hover { border-color: var(--text-secondary); color: var(--text-primary); }

/* Transition */
.confirm-fade-enter-active, .confirm-fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.confirm-fade-enter-from, .confirm-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

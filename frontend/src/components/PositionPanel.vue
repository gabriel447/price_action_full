<template>
  <div class="position">
    <div class="position__title">Posição Atual</div>

    <!-- No position -->
    <div v-if="!store.isPositionOpen" class="position__empty text-muted">
      Sem posição aberta
    </div>

    <!-- Open position -->
    <div v-else class="position__data">
      <div class="position__badge" :class="sideBadgeClass">
        {{ store.position.side }}
      </div>

      <div class="position__rows">
        <div class="position__row">
          <span class="position__key">Entrada</span>
          <span class="position__val mono">{{ fmt(store.position.entryPrice) }}</span>
        </div>
        <div class="position__row">
          <span class="position__key">Qtd.</span>
          <span class="position__val mono">{{ store.position.quantity }}</span>
        </div>
        <div class="position__row">
          <span class="position__key">Stop Loss</span>
          <span class="position__val mono text-down">{{ fmt(store.position.stopLoss) }}</span>
        </div>
        <div class="position__row">
          <span class="position__key">Take Profit</span>
          <span class="position__val mono text-up">{{ fmt(store.position.takeProfit) }}</span>
        </div>
        <div class="position__row position__row--pnl">
          <span class="position__key">PnL não realiz.</span>
          <span
            class="position__val mono"
            :class="pnlClass"
          >
            {{ pnlDisplay }}
          </span>
        </div>
      </div>

      <!-- Progress bar between SL and TP -->
      <div class="position__progress-label">
        <span class="text-down">SL</span>
        <span class="text-secondary mono" style="font-size:11px">Preço atual</span>
        <span class="text-up">TP</span>
      </div>
      <div class="position__bar">
        <div class="position__bar-fill" :style="progressStyle"></div>
        <div class="position__bar-cursor" :style="cursorStyle"></div>
      </div>

      <!-- Order guard notice -->
      <div class="position__guard">
        <span class="position__guard-dot"></span>
        Novas ordens bloqueadas — posição ativa
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()

/** Crypto-aware price formatter — same logic as PriceTicker */
function fmt(val) {
  if (val === null || val === undefined) return '—'
  const p = parseFloat(val)
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1)    return p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return p.toFixed(8)
}

const sideBadgeClass = computed(() => ({
  'position__badge--buy':  store.position?.side === 'BUY',
  'position__badge--sell': store.position?.side === 'SELL',
}))

const pnlClass = computed(() => {
  const v = store.unrealizedPnl
  if (v === null) return ''
  return parseFloat(v) >= 0 ? 'text-up' : 'text-down'
})

const pnlDisplay = computed(() => {
  if (store.unrealizedPnl === null) return '—'
  const sign = parseFloat(store.unrealizedPnl) >= 0 ? '+' : ''
  return `${sign}${store.unrealizedPnl} (${store.unrealizedPnlPercent}%)`
})

/**
 * Normalize current price between SL and TP to a 0–100% range.
 */
const progressPercent = computed(() => {
  if (!store.isPositionOpen || !store.position || store.currentPrice === null) return 0
  const { stopLoss, takeProfit } = store.position
  const range = takeProfit - stopLoss
  if (range <= 0) return 0
  const pos = ((store.currentPrice - stopLoss) / range) * 100
  return Math.min(Math.max(pos, 0), 100)
})

const progressStyle = computed(() => ({
  width: `${progressPercent.value}%`,
  background: progressPercent.value >= 50 ? 'var(--up-color)' : 'var(--down-color)',
}))

const cursorStyle = computed(() => ({
  left: `${progressPercent.value}%`,
}))
</script>

<style scoped>
.position {
  background: var(--bg-card);
  padding: 14px 18px;
  flex: 1;
}

.position__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.position__empty {
  font-size: 12px;
  padding: 8px 0;
}

.position__badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
}

.position__badge--buy  { background: var(--up-color-dim);   color: var(--up-color);   }
.position__badge--sell { background: var(--down-color-dim);  color: var(--down-color); }

.position__rows {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin-bottom: 14px;
}

.position__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.position__row--pnl {
  margin-top: 4px;
  padding-top: 7px;
  border-top: 1px solid var(--border-dim);
}

.position__key {
  font-size: 12px;
  color: var(--text-secondary);
}

.position__val {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Progress bar */
.position__progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  font-weight: 600;
  margin-bottom: 5px;
}

.position__bar {
  position: relative;
  height: 4px;
  background: var(--bg-card-alt);
  border-radius: 2px;
  margin-bottom: 10px;
  overflow: visible;
}

.position__bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.position__bar-cursor {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-primary);
  border: 2px solid var(--bg-primary);
  transition: left 0.3s ease;
}

/* Guard notice */
.position__guard {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--warning);
  background: var(--warning-dim);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
}

.position__guard-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning);
  flex-shrink: 0;
}
</style>

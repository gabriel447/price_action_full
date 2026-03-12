<template>
  <div class="ticker">
    <div class="ticker__label">{{ symbol }}</div>
    <div
      class="ticker__price mono"
      :class="{
        'ticker__price--up':   store.priceDirection === 'up',
        'ticker__price--down': store.priceDirection === 'down',
      }"
    >
      {{ formattedPrice }}
    </div>
    <div class="ticker__sub">
      <span
        class="ticker__dir"
        :class="{
          'text-up':   store.priceDirection === 'up',
          'text-down': store.priceDirection === 'down',
          'text-muted': store.priceDirection === 'neutral',
        }"
      >
        {{ directionLabel }}
      </span>
      <span class="ticker__time text-muted mono">
        {{ lastUpdate }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()

const symbol = import.meta.env.VITE_SYMBOL ?? 'BTCUSDT'

/**
 * Crypto-aware price formatter.
 * BTC/ETH (>= $1000) → 2 decimals   e.g. 96,543.12
 * Mid-price ($1–$999) → 4 decimals  e.g. 45.3210
 * Low-price (< $1)    → 8 decimals  e.g. 0.00002341
 */
const formattedPrice = computed(() => {
  const p = store.currentPrice
  if (p === null) return '—'
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1)    return p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return p.toFixed(8)
})

const directionLabel = computed(() => {
  if (store.priceDirection === 'up') return '▲'
  if (store.priceDirection === 'down') return '▼'
  return '—'
})

const lastUpdate = computed(() => {
  return new Date().toLocaleTimeString('pt-BR', { hour12: false })
})
</script>

<style scoped>
.ticker {
  background: var(--bg-card);
  padding: 20px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ticker__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.ticker__price {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  transition: color 0.15s ease;
  line-height: 1.1;
}

/* Flash transitions — brief color change on price movement */
.ticker__price--up {
  color: var(--up-color);
  text-shadow: 0 0 16px rgba(0, 230, 118, 0.35);
}

.ticker__price--down {
  color: var(--down-color);
  text-shadow: 0 0 16px rgba(255, 61, 90, 0.35);
}

.ticker__sub {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
}

.ticker__dir {
  font-size: 13px;
  font-weight: 600;
  transition: color 0.15s ease;
}

.ticker__time {
  font-size: 11px;
}
</style>

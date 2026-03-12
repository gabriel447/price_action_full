<template>
  <div class="wallet">
    <div class="wallet__title">
      Carteira
      <span v-if="store.walletBalance?.testnet" class="wallet__testnet">TESTNET</span>
    </div>

    <div v-if="!store.walletBalance" class="wallet__empty text-muted">—</div>

    <div v-else class="wallet__balances">
      <!-- Quote asset (USDT) -->
      <div class="wallet__row">
        <span class="wallet__asset">{{ store.walletBalance.quote.asset }}</span>
        <div class="wallet__amounts">
          <span class="wallet__free mono">{{ fmtQuote(store.walletBalance.quote.free) }}</span>
          <span v-if="lockedQuote > 0" class="wallet__locked mono text-muted">
            + {{ fmtQuote(store.walletBalance.quote.locked) }} lck
          </span>
        </div>
      </div>

      <!-- Base asset (BTC) -->
      <div class="wallet__row">
        <span class="wallet__asset">{{ store.walletBalance.base.asset }}</span>
        <div class="wallet__amounts">
          <span class="wallet__free mono">{{ fmtBase(store.walletBalance.base.free) }}</span>
          <span v-if="lockedBase > 0" class="wallet__locked mono text-muted">
            + {{ fmtBase(store.walletBalance.base.locked) }} lck
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()

const lockedQuote = computed(() => parseFloat(store.walletBalance?.quote.locked ?? 0))
const lockedBase  = computed(() => parseFloat(store.walletBalance?.base.locked  ?? 0))

/** Quote (USDT) — always 2 decimal places */
function fmtQuote(val) {
  const n = parseFloat(val ?? 0)
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Base (BTC) — up to 8 decimal places, strip trailing zeros */
function fmtBase(val) {
  const n = parseFloat(val ?? 0)
  if (n === 0) return '0'
  // Show up to 8 decimals, remove trailing zeros
  return n.toFixed(8).replace(/\.?0+$/, '')
}
</script>

<style scoped>
.wallet {
  background: var(--bg-card);
  padding: 14px 18px;
}

.wallet__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.wallet__testnet {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: var(--warning-dim);
  color: var(--warning);
  border: 1px solid var(--warning);
  border-radius: 3px;
  padding: 1px 5px;
}

.wallet__empty { font-size: 12px; }

.wallet__balances {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wallet__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.wallet__asset {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  min-width: 36px;
}

.wallet__amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.wallet__free {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.wallet__locked { font-size: 10px; }
</style>

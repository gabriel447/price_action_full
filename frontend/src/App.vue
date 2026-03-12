<template>
  <div class="app">
    <!-- ── Top Bar ──────────────────────────────────────────────────── -->
    <header class="topbar">
      <div class="topbar__brand">
        <span class="topbar__icon">📈</span>
        <span class="topbar__title">Price Action Bot</span>
      </div>
      <div class="topbar__controls">
        <ConnectionStatus />
        <PanicButton :on-panic="panicClose" />
      </div>
    </header>

    <!-- ── Main Content ────────────────────────────────────────────── -->
    <main class="main">
      <!-- Left column: ticker + wallet + position + indicators -->
      <aside class="sidebar">
        <PriceTicker />
        <WalletBalance />
        <IndicatorsPanel />
        <PositionPanel />
      </aside>

      <!-- Center column: chart -->
      <section class="chart-area">
        <CandleChart :on-change-timeframe="changeTimeframe" />
      </section>
    </main>

    <!-- ── History ─────────────────────────────────────────────────── -->
    <footer class="history-bar">
      <TradeHistory />
    </footer>

    <!-- ── Error Toast ─────────────────────────────────────────────── -->
    <Transition name="toast">
      <div v-if="store.lastError" class="toast toast--error">
        <span class="toast__icon">⚠</span>
        <span class="toast__msg">{{ store.lastError.message }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { useSocket } from './composables/useSocket'
import { useTradingStore } from './stores/trading'
import ConnectionStatus from './components/ConnectionStatus.vue'
import PriceTicker from './components/PriceTicker.vue'
import WalletBalance from './components/WalletBalance.vue'
import IndicatorsPanel from './components/IndicatorsPanel.vue'
import PositionPanel from './components/PositionPanel.vue'
import CandleChart from './components/CandleChart.vue'
import TradeHistory from './components/TradeHistory.vue'
import PanicButton from './components/PanicButton.vue'

const store = useTradingStore()
const { panicClose, changeTimeframe } = useSocket()
</script>

<style scoped>
.app {
  display: grid;
  grid-template-rows: 48px 1fr auto;
  min-height: 100vh;
  background: var(--bg-primary);
}

/* ── Top Bar ──────────────────────────────────────────────────────────── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.topbar__brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar__icon {
  font-size: 18px;
  line-height: 1;
}

.topbar__title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-primary);
}

.topbar__controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* ── Main ─────────────────────────────────────────────────────────────── */
.main {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1px;
  background: var(--border-dim);
  overflow: hidden;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--border-dim);
  overflow-y: auto;
}

.chart-area {
  background: var(--bg-secondary);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── History ──────────────────────────────────────────────────────────── */
.history-bar {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  max-height: 220px;
  overflow-y: auto;
}

/* ── Error Toast ──────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: var(--radius-md);
  font-size: 13px;
  z-index: 999;
  box-shadow: var(--shadow);
}

.toast--error {
  background: var(--bg-card-alt);
  border: 1px solid var(--down-color);
  color: var(--down-color);
}

.toast__icon { font-size: 16px; }

/* ── Toast transition ──────────────────────────────────────────────────── */
.toast-enter-active, .toast-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>

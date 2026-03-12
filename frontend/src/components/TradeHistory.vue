<template>
  <div class="history">
    <div class="history__header">
      <span class="history__title">Histórico de Trades</span>
      <span class="history__count text-muted">({{ store.tradeHistory.length }})</span>
    </div>

    <div v-if="store.tradeHistory.length === 0" class="history__empty text-muted">
      Nenhum trade registrado ainda.
    </div>

    <table v-else class="history__table">
      <thead>
        <tr>
          <th>Hora</th>
          <th>Tipo</th>
          <th>Lado</th>
          <th>Preço</th>
          <th>Qtd.</th>
          <th>Motivo</th>
          <th>Order ID</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="order in store.tradeHistory"
          :key="order.id"
          :class="rowClass(order)"
        >
          <td class="mono">{{ formatTime(order.time) }}</td>
          <td>
            <span class="badge" :class="typeBadge(order.type)">{{ order.type }}</span>
          </td>
          <td>
            <span class="badge" :class="sideBadge(order.side)">{{ order.side }}</span>
          </td>
          <td class="mono">{{ fmtPrice(order.price) }}</td>
          <td class="mono">{{ order.quantity ?? '—' }}</td>
          <td class="reason text-secondary">{{ order.reason ?? '—' }}</td>
          <td class="mono text-muted" style="font-size:11px">{{ order.orderId ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()

function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false })
}

/** Crypto-aware price formatter */
function fmtPrice(val) {
  if (val === null || val === undefined) return '—'
  const p = parseFloat(val)
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1)    return p.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  return p.toFixed(8)
}

function rowClass(order) {
  return {
    'row--open':  order.type === 'OPEN',
    'row--close': order.type === 'CLOSE',
  }
}

function typeBadge(type) {
  return type === 'OPEN' ? 'badge--open' : 'badge--close'
}

function sideBadge(side) {
  return side === 'BUY' ? 'badge--buy' : 'badge--sell'
}
</script>

<style scoped>
.history {
  padding: 10px 16px 12px;
}

.history__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.history__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.history__count { font-size: 11px; }

.history__empty {
  font-size: 12px;
  padding: 8px 0;
}

.history__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.history__table th {
  text-align: left;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0 8px 6px 0;
  white-space: nowrap;
}

.history__table td {
  padding: 5px 8px 5px 0;
  border-top: 1px solid var(--border-dim);
  color: var(--text-primary);
  vertical-align: middle;
}

.row--open  td { opacity: 1; }
.row--close td { opacity: 0.7; }

.reason {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Badges */
.badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 3px;
}

.badge--open  { background: var(--accent-dim);     color: var(--accent);    }
.badge--close { background: var(--bg-card-alt);    color: var(--text-secondary); }
.badge--buy   { background: var(--up-color-dim);   color: var(--up-color);   }
.badge--sell  { background: var(--down-color-dim); color: var(--down-color); }
</style>

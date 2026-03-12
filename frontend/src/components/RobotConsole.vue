<template>
    <div class="console">
        <div class="console__header">
            <span>Terminal de Estratégia</span>
            <button class="sound-btn" @click="store.toggleSound"
                :title="store.soundEnabled ? 'Silenciar' : 'Ativar Som'">
                {{ store.soundEnabled ? '🔊' : '🔇' }}
            </button>
        </div>
        <div class="console__body" ref="bodyRef">
            <div v-if="store.consoleLogs.length === 0" class="console__empty">
                Aguardando logs do servidor...
            </div>
            <div v-for="(log, i) in store.consoleLogs" :key="log.timestamp + i" class="log-line"
                :class="`log-line--${log.type}`">
                <span class="log-time">[{{ fmtTime(log.timestamp) }}]</span>
                <span class="log-msg">{{ log.message }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useTradingStore } from '../stores/trading'

const store = useTradingStore()
const bodyRef = ref(null)

function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour12: false })
}

watch(() => store.consoleLogs.length, async () => {
    await nextTick()
    if (bodyRef.value) {
        bodyRef.value.scrollTop = bodyRef.value.scrollHeight
    }
})

const AudioContext = window.AudioContext || window.webkitAudioContext
const audioCtx = new AudioContext()

function playTone(freq, type, duration, delay = 0) {
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.type = type
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(audioCtx.destination)

    const now = audioCtx.currentTime + delay
    osc.start(now)
    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.stop(now + duration)
}

watch(() => store.lastAudioEvent, (evt) => {
    if (!evt) return

    if (evt.type === 'setup') {
        playTone(880, 'sine', 0.1, 0)
        playTone(880, 'sine', 0.1, 0.15)
    } else if (evt.type === 'execution') {
        playTone(523.25, 'triangle', 0.1, 0)
        playTone(659.25, 'triangle', 0.1, 0.1)
        playTone(783.99, 'triangle', 0.3, 0.2)
    } else if (evt.type === 'alert') {
        playTone(150, 'sawtooth', 0.4, 0)
    }
})
</script>

<style scoped>
.console {
    background: #0a0a0a;
    border: 1px solid #333;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    font-family: 'Courier New', Courier, monospace;
    margin-top: 10px;
}

.console__header {
    background: #1a1a1a;
    color: #888;
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 8px;
    border-bottom: 1px solid #333;
    text-transform: uppercase;
}

.console__body {
    height: 140px;
    overflow-y: auto;
    padding: 8px;
}

.console__empty {
    color: #444;
    font-size: 12px;
    font-style: italic;
}

.log-line {
    font-size: 12px;
    margin-bottom: 4px;
    line-height: 1.4;
}

.log-time {
    color: #555;
    margin-right: 8px;
}

.log-line--info {
    color: #e0e0e0;
}

.log-line--warning {
    color: #ffb74d;
}

.log-line--success {
    color: #00e676;
}

.log-line--error {
    color: #ff5252;
}

.sound-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
}
</style>

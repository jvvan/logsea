<template>
    <div ref="term" class="terminal"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, onUpdated } from 'vue';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '../../node_modules/@xterm/xterm/css/xterm.css';

function useTerminal(containerRef) {
    const terminal = ref(null);
    const fitAddon = ref(null);
    const isInitialized = ref(false);

    onMounted(() => {
        const terminalProps = {
            disableStdin: true,
            cursorStyle: 'underline',
            fontSize: 16,
            fontFamily: 'Fira Code, Consolas, monospace',
            allowProposedApi: true,
            convertEol: true,
        };

        terminal.value = new Terminal(terminalProps);
        fitAddon.value = new FitAddon();

        terminal.value.loadAddon(fitAddon.value);
        terminal.value.open(containerRef.value);
        fitAddon.value.fit();
        isInitialized.value = true;

        window.addEventListener('resize', fitTerminal);
    });

    onBeforeUnmount(() => {
        window.removeEventListener('resize', fitTerminal);
        try {
            if (isInitialized.value && terminal.value) {
                terminal.value.dispose();
                isInitialized.value = false;
            }
        } catch (error) {
            console.warn('Terminal disposal warning:', error.message);
        }
    });

    onUpdated(() => {
        if (isInitialized.value && fitAddon.value) {
            fitAddon.value.fit();
        }
    });

    const writeData = (data) => {
        if (isInitialized.value && terminal.value) {
            terminal.value.write(data);
        }
    };

    const clear = () => {
        if (isInitialized.value && terminal.value) {
            terminal.value.clear();
        }
    };

    const zoomIn = () => adjustFontSize(3);

    const zoomOut = () => adjustFontSize(-3);

    const adjustFontSize = (change) => {
        if (isInitialized.value && terminal.value) {
            const newFontSize = terminal.value.options.fontSize + change;
            terminal.value.options.fontSize = Math.min(Math.max(newFontSize, 12), 36);
            fitTerminal();
        }
    };

    const fitTerminal = () => {
        if (isInitialized.value && fitAddon.value) {
            fitAddon.value.fit();
        }
    };

    return { writeData, zoomIn, zoomOut, clear };
}

const term = ref(null);
const { writeData, zoomIn, zoomOut, clear } = useTerminal(term);


defineExpose({ writeData, zoomIn, zoomOut, clear });
</script>

<style scoped>
.terminal {
    width: 100%;
    height: 100%;
}
</style>
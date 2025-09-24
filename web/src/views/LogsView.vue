<script setup>
import TerminalComponent from '@/components/TerminalComponent.vue';
import { useRoute } from 'vue-router'
import { ref, onMounted, onUnmounted } from 'vue'
import socketService from '@/services/socket.js';

const route = useRoute();
const containerId = ref(route.params.id);
const terminalRef = ref(null);

async function fetchAndDisplayLogs() {
  socketService.connect();
  terminalRef.value.clear();

  socketService.subscribeToLogs(containerId.value, (logData) => {
    if (logData.containerId === containerId.value) {
      terminalRef.value.writeData(logData.data);
    }
  });

  socketService.onLogsEnded((data) => {
    if (data.containerId === containerId.value) {
      console.log('Logs ended for container:', containerId.value);
    }
  });
}

function handleZoom(event) {
  if (event.ctrlKey) {
    event.preventDefault();
    if (event.deltaY < 0) {
      terminalRef.value.zoomIn();
    } else {
      terminalRef.value.zoomOut();
    }
  }
}

onMounted(() => {
  if (document.title === "Logsea" && window.location.hash) {
    document.title = `docker logs ${window.location.hash.substring(1)}`;
  }

  fetchAndDisplayLogs();
});

onUnmounted(() => {
  socketService.unsubscribeFromLogs();
  socketService.offLogsEnded();
});
</script>

<template>
  <div id="terminal-container" @wheel.prevent="handleZoom">
    <TerminalComponent ref="terminalRef" />
  </div>
</template>

<style scoped>
#terminal-container {
  width: 100vw;
  height: 100vh;
}
</style>
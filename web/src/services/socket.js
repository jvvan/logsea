import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect() {
    if (this.socket && this.connected) {
      return this.socket;
    }

    const serverUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    
    this.socket = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Socket connected:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  isConnected() {
    return this.connected && this.socket?.connected;
  }

  getSocket() {
    return this.socket;
  }

  subscribeToContainerEvents(callback) {
    if (!this.socket) return;
    
    this.socket.emit('subscribe-events');
    this.socket.on('container-event', callback);
  }

  unsubscribeFromContainerEvents() {
    if (!this.socket) return;
    
    this.socket.off('container-event');
  }

  subscribeToLogs(containerId, callback) {
    if (!this.socket) return;
    
    this.socket.emit('subscribe-logs', containerId);
    this.socket.on('container-log', callback);
  }

  unsubscribeFromLogs() {
    if (!this.socket) return;
    
    this.socket.emit('unsubscribe-logs');
    this.socket.off('container-log');
  }

  onLogsEnded(callback) {
    if (!this.socket) return;
    
    this.socket.on('logs-ended', callback);
  }

  offLogsEnded() {
    if (!this.socket) return;
    
    this.socket.off('logs-ended');
  }

  onEventsEnded(callback) {
    if (!this.socket) return;
    
    this.socket.on('events-ended', callback);
  }

  offEventsEnded() {
    if (!this.socket) return;
    
    this.socket.off('events-ended');
  }
}

const socketService = new SocketService();

export default socketService;

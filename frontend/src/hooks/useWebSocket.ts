import { useEffect, useState } from 'react';

interface ProblemStatus {
  frontend_id: string;
  slug: string;
  title: string;
  online_count: number;
  online_count_cn: number;
  online_count_com: number;
  online_count_total: number;
  last_updated: number;
}

interface WSMessage {
  type: 'status_update' | 'batch_update';
  slug?: string;
  online_count?: number;
  total_online?: number;
  problems?: ProblemStatus[];
  timestamp: number;
}

type MessageHandler = (data: WSMessage) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private messageHandlers: Set<MessageHandler> = new Set();
  private isConnected = false;

  connect() {
    const host = window.location.hostname;
    const wsUrl = `ws://${host}:52106/ws`;
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WSMessage = JSON.parse(event.data);
          this.messageHandlers.forEach(handler => handler(data));
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  disconnect() {
    this.isConnected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getIsConnected() {
    return this.isConnected;
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

export const getWebSocketClient = () => {
  if (!wsClient) {
    wsClient = new WebSocketClient();
  }
  return wsClient;
};

// React hook for WebSocket
export const useWebSocket = (onMessage: MessageHandler) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const client = getWebSocketClient();
    
    if (!client.getIsConnected()) {
      client.connect();
    }

    const checkConnection = setInterval(() => {
      setIsConnected(client.getIsConnected());
    }, 1000);

    const unsubscribe = client.onMessage(onMessage);

    return () => {
      clearInterval(checkConnection);
      unsubscribe();
    };
  }, [onMessage]);

  return { isConnected };
};

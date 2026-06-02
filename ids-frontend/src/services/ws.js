const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/live";

export class IDSWebSocket {
  constructor(onMessage, onStatusChange) {
    this.onMessage      = onMessage;
    this.onStatusChange = onStatusChange;
    this.ws             = null;
    this.reconnectDelay = 2000;
    this.maxDelay       = 30000;
    this._destroyed     = false;
  }

  connect() {
    if (this._destroyed) return;
    this.onStatusChange("connecting");

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.reconnectDelay = 2000;
        this.onStatusChange("connected");
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.onMessage(data);
        } catch (_) {}
      };

      this.ws.onclose = () => {
        if (!this._destroyed) {
          this.onStatusChange("disconnected");
          setTimeout(() => this.connect(), this.reconnectDelay);
          this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxDelay);
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (_) {
      this.onStatusChange("disconnected");
    }
  }

  disconnect() {
    this._destroyed = true;
    this.ws?.close();
  }

  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

import { authApi } from '@/lib/api/endpoints';
import { env } from '@/lib/env';
import type { ClientSendEvent, ConnectionStatus, ServerEvent } from '@/types';

type EventListener = (event: ServerEvent) => void;
type StatusListener = (status: ConnectionStatus) => void;

const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Single WebSocket with ticket auth, exponential backoff + full jitter,
 * and a tiny event bus. The ticket is one-time, so each (re)connect fetches a new one.
 */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly events = new Set<EventListener>();
  private readonly statuses = new Set<StatusListener>();

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stopHeartbeat();
    this.socket?.close(1000);
    this.socket = null;
    this.emitStatus('idle');
  }

  onEvent(fn: EventListener): () => void {
    this.events.add(fn);
    return () => this.events.delete(fn);
  }

  onStatus(fn: StatusListener): () => void {
    this.statuses.add(fn);
    return () => this.statuses.delete(fn);
  }

  send(event: ClientSendEvent): boolean {
    if (env.mock) {
      if (event.t === 'conversation.read') return true;
      void import('@/lib/api/mock').then(({ mockSend }) => {
        const msg = mockSend(event);
        if (msg) setTimeout(() => this.events.forEach((fn) => fn({ t: 'message.new', ...msg })), 60);
      });
      return true;
    }
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(event));
    return true;
  }

  private emitStatus(status: ConnectionStatus) {
    this.statuses.forEach((fn) => fn(status));
  }

  private async connect(): Promise<void> {
    if (!this.running) return;
    if (env.mock) return this.emitStatus('open');
    this.emitStatus('connecting');
    try {
      const { ticket } = await authApi.wsTicket();
      if (!this.running) return;
      const socket = new WebSocket(`${env.wsUrl}?ticket=${encodeURIComponent(ticket)}`);
      this.socket = socket;
      socket.onopen = () => {
        if (!this.running || this.socket !== socket) {
          socket.close(1000);
          return;
        }
        this.attempts = 0;
        this.emitStatus('open');
        this.heartbeat = setInterval(() => {
          if (socket.readyState !== WebSocket.OPEN) return;
          try {
            socket.send(JSON.stringify({ t: 'ping' }));
          } catch {
            socket.close();
          }
        }, HEARTBEAT_INTERVAL_MS);
      };
      socket.onmessage = (msg: MessageEvent<string>) => {
        try {
          const event = JSON.parse(msg.data) as ServerEvent;
          this.events.forEach((fn) => fn(event));
        } catch {
          /* ignore malformed frame */
        }
      };
      socket.onclose = () => {
        if (this.socket !== socket) return;
        this.socket = null;
        this.stopHeartbeat();
        this.emitStatus('closed');
        this.scheduleReconnect();
      };
      socket.onerror = () => socket.close();
    } catch {
      this.emitStatus('closed');
      this.scheduleReconnect();
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private scheduleReconnect(): void {
    if (!this.running || this.timer) return;
    const ceiling = Math.min(30_000, 500 * 2 ** this.attempts++);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.connect();
    }, Math.random() * ceiling);
  }
}

export const realtime = new RealtimeClient();

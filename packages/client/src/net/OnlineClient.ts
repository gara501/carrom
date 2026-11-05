import { io, type Socket } from 'socket.io-client';
import type { CoinSpawn, MatchState, PlayerId, ShotOutcome, Vec2 } from '@carrom/core';

/** Servidor por defecto (Cloud Run). Se puede cambiar al compilar con VITE_SERVER_URL. */
const DEFAULT_URL = 'https://carrom-server-883660449973.us-east1.run.app';
export const SERVER_URL: string = (import.meta.env.VITE_SERVER_URL as string | undefined) || DEFAULT_URL;

export interface Snapshot { seat: PlayerId; match: MatchState; layout: CoinSpawn[]; peer: boolean }
export interface ShotMsg { seat: PlayerId; t: number; v: Vec2; outcome: ShotOutcome }

export interface NetHandlers {
  start?: (s: Snapshot) => void;
  sync?: (s: Snapshot) => void;
  shot?: (m: ShotMsg) => void;
  board?: (m: { match: MatchState; layout: CoinSpawn[] }) => void;
  peer?: (connected: boolean) => void;
  closed?: (reason: string) => void;
  link?: (up: boolean) => void;
  reject?: () => void;
}

type JoinAck = { ok: boolean; error?: string; code?: string; seat?: PlayerId; token?: string };

/**
 * Conexión con el servidor. Una sola instancia (`net`) compartida entre el lobby y la partida.
 * Cloud Run corta cada WebSocket a los 60 min y puede reiniciar: al reconectar se hace `rejoin`.
 */
class OnlineClient {
  private socket: Socket | null = null;
  code = '';
  seat: PlayerId = 0;
  private token = '';
  h: NetHandlers = {};

  get connected() { return !!this.socket?.connected; }

  /** Abre la conexión (la primera vez puede tardar unos segundos por el arranque en frío). */
  connect(timeoutMs = 25_000): Promise<void> {
    if (this.socket?.connected) return Promise.resolve();
    if (!this.socket) this.open();
    const s = this.socket!;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { cleanup(); reject(new Error('No se pudo conectar al servidor.')); }, timeoutMs);
      const ok = () => { cleanup(); resolve(); };
      const cleanup = () => { clearTimeout(t); s.off('connect', ok); };
      s.on('connect', ok);
      if (s.connected) ok();
    });
  }

  private open() {
    const s = io(SERVER_URL, { transports: ['websocket'], reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 4000 });
    this.socket = s;
    s.on('connect', () => {
      if (this.code && this.token) {
        s.emit('rejoin', { code: this.code, token: this.token }, (r: { ok: boolean } & Partial<Snapshot>) => {
          if (r.ok) { this.h.link?.(true); this.h.sync?.(r as Snapshot); }
          else { this.forget(); this.h.closed?.('La sala ya no existe.'); }
        });
      } else this.h.link?.(true);
    });
    s.on('disconnect', () => this.h.link?.(false));
    s.on('start', (m: Snapshot) => this.h.start?.(m));
    s.on('sync', (m: Snapshot) => this.h.sync?.(m));
    s.on('shot', (m: ShotMsg) => this.h.shot?.(m));
    s.on('board', (m) => this.h.board?.(m));
    s.on('peer', (m: { connected: boolean }) => this.h.peer?.(m.connected));
    s.on('reject', () => this.h.reject?.());
    s.on('closed', (m: { reason: string }) => { this.forget(); this.h.closed?.(m.reason); });
  }

  private ask(ev: string, payload?: object): Promise<JoinAck> {
    return new Promise((resolve, reject) => {
      const s = this.socket;
      if (!s?.connected) return reject(new Error('Sin conexión con el servidor.'));
      const t = setTimeout(() => reject(new Error('El servidor no respondió.')), 10_000);
      const cb = (r: JoinAck) => { clearTimeout(t); resolve(r); };
      if (payload) s.emit(ev, payload, cb); else s.emit(ev, cb);
    });
  }

  private adopt(r: JoinAck): string {
    if (!r.ok) throw new Error(r.error ?? 'Error del servidor.');
    this.code = r.code!; this.seat = r.seat!; this.token = r.token!;
    return this.code;
  }

  async create(blitz = false): Promise<string> { return this.adopt(await this.ask('create', { blitz })); }
  async join(code: string): Promise<string> { return this.adopt(await this.ask('join', { code })); }

  shoot(t: number, v: Vec2) { this.socket?.emit('shot', { t, v }); }
  resign() { this.socket?.emit('resign'); }
  continueMatch() { this.socket?.emit('continue'); }
  requestSync() { this.socket?.emit('sync'); }

  /** Sale de la sala (la cierra para el rival) y olvida la sesión. */
  leave() { this.socket?.emit('leave'); this.forget(); }
  private forget() { this.code = ''; this.token = ''; }

  /** Cierra del todo la conexión (al volver al menú). */
  close() {
    this.h = {};
    this.forget();
    this.socket?.removeAllListeners();
    this.socket?.close();
    this.socket = null;
  }
}

export const net = new OnlineClient();

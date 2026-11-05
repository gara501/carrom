import { randomBytes } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import { MatchController, type PlayerId, type Vec2 } from '@carrom/core';

const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ'; // sin vocales: no forma palabras
const MAX_ROOMS = 200;
const GRACE_MS = 120_000; // tiempo para reconectar antes de cerrar la sala

interface Seat { token: string; socketId: string | null; timer?: NodeJS.Timeout }

class Room {
  readonly ctl = new MatchController();
  readonly seats: [Seat | null, Seat | null] = [null, null];
  constructor(readonly code: string, readonly blitz: boolean) { this.ctl.blitz = blitz; this.ctl.newGame(0); }
  get full() { return !!this.seats[0] && !!this.seats[1]; }
  seatOf(socketId: string): PlayerId | null {
    if (this.seats[0]?.socketId === socketId) return 0;
    if (this.seats[1]?.socketId === socketId) return 1;
    return null;
  }
}

type Ack = (r: Record<string, unknown>) => void;
const bad = (ack: Ack | undefined, error: string) => ack?.({ ok: false, error });

/** Salas de dos jugadores. El servidor simula cada tiro con @carrom/core y manda el resultado oficial. */
export function attachRooms(io: Server) {
  const rooms = new Map<string, Room>();
  const roomOf = new Map<string, Room>(); // socket.id -> sala

  const newCode = () => {
    for (;;) {
      let c = '';
      for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!rooms.has(c)) return c;
    }
  };
  const close = (room: Room, reason: string) => {
    io.to(room.code).emit('closed', { reason });
    for (const s of room.seats) { if (s?.timer) clearTimeout(s.timer); if (s?.socketId) roomOf.delete(s.socketId); }
    io.in(room.code).socketsLeave(room.code);
    rooms.delete(room.code);
    console.log(`sala ${room.code} cerrada (${reason}); ${rooms.size} activas`);
  };
  const snapshot = (room: Room, seat: PlayerId) => {
    const o = room.ctl.outcome();
    const other = room.seats[seat === 0 ? 1 : 0];
    return { seat, match: o.match, layout: o.layout, peer: !!other?.socketId };
  };
  const attach = (room: Room, seat: PlayerId, socket: Socket) => {
    const st = room.seats[seat]!;
    if (st.timer) { clearTimeout(st.timer); st.timer = undefined; }
    st.socketId = socket.id;
    roomOf.set(socket.id, room);
    void socket.join(room.code);
  };

  io.on('connection', (socket) => {
    socket.on('create', (msg: { blitz?: boolean } | Ack, maybeAck?: Ack) => {
      const ack = typeof msg === 'function' ? msg : maybeAck;
      const blitz = typeof msg === 'object' && !!msg?.blitz;
      if (rooms.size >= MAX_ROOMS) return bad(ack, 'Servidor lleno, inténtalo en un rato.');
      leave(socket);
      const room = new Room(newCode(), blitz);
      room.seats[0] = { token: randomBytes(12).toString('hex'), socketId: null };
      rooms.set(room.code, room);
      attach(room, 0, socket);
      console.log(`sala ${room.code} creada; ${rooms.size} activas`);
      ack?.({ ok: true, code: room.code, seat: 0, token: room.seats[0].token });
    });

    socket.on('join', (msg: { code?: string }, ack?: Ack) => {
      const room = rooms.get(String(msg?.code ?? '').toUpperCase().trim());
      if (!room) return bad(ack, 'No existe esa sala.');
      if (room.full) return bad(ack, 'La sala ya está llena.');
      leave(socket);
      room.seats[1] = { token: randomBytes(12).toString('hex'), socketId: null };
      attach(room, 1, socket);
      ack?.({ ok: true, code: room.code, seat: 1, token: room.seats[1].token });
      // Parte desde cero: el anfitrión espera en el lobby.
      room.ctl.newGame(0);
      for (const seat of [0, 1] as const) {
        const id = room.seats[seat]!.socketId;
        if (id) io.to(id).emit('start', snapshot(room, seat));
      }
    });

    socket.on('rejoin', (msg: { code?: string; token?: string }, ack?: Ack) => {
      const room = rooms.get(String(msg?.code ?? '').toUpperCase());
      const seat = room?.seats[0]?.token === msg?.token ? 0 : room?.seats[1]?.token === msg?.token ? 1 : null;
      if (!room || seat === null) return bad(ack, 'La sala ya no existe.');
      const old = room.seats[seat]!.socketId;
      if (old && old !== socket.id) roomOf.delete(old);
      attach(room, seat, socket);
      ack?.({ ok: true, ...snapshot(room, seat), code: room.code });
      const other = room.seats[seat === 0 ? 1 : 0]?.socketId;
      if (other) io.to(other).emit('peer', { connected: true });
    });

    socket.on('sync', () => {
      const room = roomOf.get(socket.id);
      const seat = room?.seatOf(socket.id);
      if (room && seat != null) socket.emit('sync', snapshot(room, seat));
    });

    socket.on('shot', (msg: { t: number; v: Vec2 }) => {
      const room = roomOf.get(socket.id);
      const seat = room?.seatOf(socket.id);
      if (!room || seat == null || !room.full) return;
      const ok = room.ctl.phase === 'board' && room.ctl.current === seat && msg?.v;
      const out = ok ? room.ctl.playShot(Number(msg.t), { x: Number(msg.v.x), y: Number(msg.v.y) }) : null;
      if (!out) { socket.emit('reject'); return; }
      io.to(room.code).emit('shot', { seat, t: Math.min(1, Math.max(0, Number(msg.t))), v: msg.v, outcome: out });
    });

    // Tras terminar un tablero ('between') o la partida ('over'), cualquiera puede continuar.
    socket.on('continue', () => {
      const room = roomOf.get(socket.id);
      if (!room || !room.full) return;
      const ph = room.ctl.phase;
      if (ph === 'between') room.ctl.nextBoard();
      else if (ph === 'over') room.ctl.newGame(0);
      else return;
      const o = room.ctl.outcome();
      io.to(room.code).emit('board', { match: o.match, layout: o.layout });
    });

    // Rendirse: gana el rival y la partida termina.
    socket.on('resign', () => {
      const room = roomOf.get(socket.id);
      const seat = room?.seatOf(socket.id);
      if (!room || seat == null || !room.full || room.ctl.phase === 'over') return;
      room.ctl.resign(seat);
      const o = room.ctl.outcome();
      io.to(room.code).emit('board', { match: o.match, layout: o.layout });
    });

    socket.on('leave', () => leave(socket));
    socket.on('ping', (ack?: (r: { pong: number }) => void) => ack?.({ pong: Date.now() }));
    socket.on('disconnect', (reason) => {
      console.log(`desconectado ${socket.id}: ${reason}`);
      const room = roomOf.get(socket.id);
      if (!room) return;
      roomOf.delete(socket.id);
      const seat = room.seatOf(socket.id);
      if (seat === null) return;
      const st = room.seats[seat]!;
      st.socketId = null;
      const other = room.seats[seat === 0 ? 1 : 0]?.socketId;
      if (other) io.to(other).emit('peer', { connected: false });
      st.timer = setTimeout(() => { if (rooms.has(room.code)) close(room, 'El rival se desconectó.'); }, GRACE_MS);
    });
  });

  function leave(socket: Socket) {
    const room = roomOf.get(socket.id);
    if (!room) return;
    roomOf.delete(socket.id);
    void socket.leave(room.code);
    close(room, 'El rival salió de la sala.');
  }
}

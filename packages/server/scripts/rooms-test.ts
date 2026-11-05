import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as connect, type Socket } from 'socket.io-client';
import assert from 'node:assert/strict';
import { attachRooms } from '../src/rooms';

const http = createServer();
const srv = new Server(http, { cors: { origin: true } });
attachRooms(srv);
await new Promise<void>((r) => http.listen(0, r));
const url = `http://localhost:${(http.address() as { port: number }).port}`;
const mk = () => connect(url, { transports: ['websocket'] });
const emit = <T>(s: Socket, ev: string, ...a: unknown[]) => new Promise<T>((r) => s.emit(ev, ...a, r));
const once = <T>(s: Socket, ev: string) => new Promise<T>((r) => s.once(ev, r));

const a = mk(), b = mk();
await Promise.all([once(a, 'connect'), once(b, 'connect')]);

const bad = await emit<{ ok: boolean }>(b, 'join', { code: 'ZZZZ' });
assert.equal(bad.ok, false);

const c = await emit<{ ok: boolean; code: string; seat: number; token: string }>(a, 'create');
assert.ok(c.ok && /^[BCDFGHJKLMNPQRSTVWXZ]{4}$/.test(c.code));
const startA = once<{ seat: number; layout: unknown[] }>(a, 'start');
const startB = once<{ seat: number }>(b, 'start');
const j = await emit<{ ok: boolean; seat: number }>(b, 'join', { code: c.code.toLowerCase() });
assert.ok(j.ok && j.seat === 1);
const [sa, sb] = await Promise.all([startA, startB]);
assert.equal(sa.seat, 0); assert.equal(sb.seat, 1); assert.equal(sa.layout.length, 19);

// Tiro fuera de turno -> rechazado
const rej = once(b, 'reject');
b.emit('shot', { t: 0.5, v: { x: 0, y: -2000 } });
await rej;

// Tiro legal del jugador 0
const shotA = once<{ seat: number; outcome: { match: { board: { current: number } }; layout: unknown[] } }>(a, 'shot');
const shotB = once<{ seat: number }>(b, 'shot');
a.emit('shot', { t: 0.5, v: { x: 0, y: -2500 } });
const [ra, rb] = await Promise.all([shotA, shotB]);
assert.equal(ra.seat, 0); assert.equal(rb.seat, 0);
assert.ok(ra.outcome.layout.length <= 19);
console.log('tiro ok; turno ahora:', ra.outcome.match.board.current, 'piezas:', ra.outcome.layout.length);

// Reconexión con token
const peer = once<{ connected: boolean }>(b, 'peer');
a.disconnect();
assert.equal((await peer).connected, false);
const a2 = mk(); await once(a2, 'connect');
const peer2 = once<{ connected: boolean }>(b, 'peer');
const rj = await emit<{ ok: boolean; seat: number; match: unknown }>(a2, 'rejoin', { code: c.code, token: c.token });
assert.ok(rj.ok && rj.seat === 0 && rj.match);
assert.equal((await peer2).connected, true);
assert.equal((await emit<{ ok: boolean }>(mk(), 'rejoin', { code: c.code, token: 'x' })).ok, false);

// Salir cierra la sala
const closed = once(b, 'closed');
a2.emit('leave');
await closed;
assert.equal((await emit<{ ok: boolean }>(b, 'join', { code: c.code })).ok, false);

console.log('OK: salas');
process.exit(0);

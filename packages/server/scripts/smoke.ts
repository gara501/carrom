import { io } from 'socket.io-client';

// Uso: npm run smoke -w @carrom/server -- https://TU-SERVICIO.run.app   (por defecto, http://localhost:8080)
const url = process.argv[2] ?? 'http://localhost:8080';
const health = await fetch(`${url}/health`).then((r) => r.json());
console.log('health:', health);

const socket = io(url, { transports: ['websocket'], timeout: 15_000 });
const t0 = Date.now();
socket.on('connect_error', (e) => { console.error('FALLO de conexión:', e.message); process.exit(1); });
socket.on('connect', () => {
  socket.emit('ping', (r: { pong: number }) => {
    console.log(`OK: WebSocket conectado y respondió en ${Date.now() - t0} ms`, r);
    socket.close();
    process.exit(0);
  });
});

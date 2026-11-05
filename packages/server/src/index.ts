import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { attachRooms } from './rooms';

/**
 * Servidor de Carrom en línea (Socket.IO).
 * /health para comprobar la infraestructura y salas de dos jugadores (ver rooms.ts).
 */
const PORT = Number(process.env.PORT ?? 8080);
// Orígenes permitidos separados por comas (p. ej. la URL de itch.io). Vacío = cualquiera (solo para pruebas).
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const http = createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'carrom-server', uptime: Math.round(process.uptime()) }));
    return;
  }
  res.writeHead(404).end();
});

const io = new Server(http, {
  cors: { origin: ORIGINS.length ? ORIGINS : true },
  pingInterval: 20_000, // mantiene viva la conexión a través de los balanceadores
  pingTimeout: 20_000,
});

attachRooms(io);

http.listen(PORT, () => console.log(`carrom-server escuchando en :${PORT}`));

// Cloud Run envía SIGTERM al apagar la instancia: cerramos limpio.
process.on('SIGTERM', () => {
  console.log('SIGTERM: cerrando');
  io.close(() => process.exit(0));
});

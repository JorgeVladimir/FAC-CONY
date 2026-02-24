import net from 'net';

const isPortListening = (port, host = '127.0.0.1') =>
  new Promise((resolve) => {
    const socket = net.createConnection({ port, host });

    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });

    socket.once('error', () => {
      resolve(false);
    });
  });

if (!process.env.API_PORT) {
  process.env.API_PORT = '3000';
}

const apiPort = Number(process.env.API_PORT);
if (Number.isFinite(apiPort) && await isPortListening(apiPort)) {
  console.log(`API ya está activa en el puerto ${apiPort}. Se omite nuevo arranque.`);
  process.exit(0);
}

process.env.SERVE_STATIC = 'false';
process.env.ALLOW_PORT_IN_USE = 'true';

await import('./server.js');

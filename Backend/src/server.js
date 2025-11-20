import 'dotenv/config';
import app from './app.js';
import { getPool } from './config/db.js';

const port = Number.parseInt(process.env.PORT ?? '4000', 10);

async function start() {
  try {
    await getPool();
    app.listen(port, () => {
      console.log(`EcoMind API escuchando en http://localhost:${port}`);
    });
  } catch (error) {
    console.error('No se pudo iniciar el servidor', error);
    process.exit(1);
  }
}

start();

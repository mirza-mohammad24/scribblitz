import { config } from 'dotenv';
import { resolve } from 'path';

//Explicitly specify the path to the .env file located at the root of the monorepo
config({ path: resolve(process.cwd(), '../../.env') });

import { GAME_CONSTANTS } from '@scribblitz/shared';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Redis } from 'ioredis';

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not defined in the environment variables at root level');
  process.exit(1);
}

//Inject the connection string using the new Prisma 7 Adapter API
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function startWorker() {
  console.log('Background worker initializing');
  console.log(`Batch interval set to: ${GAME_CONSTANTS.CANVAS_BATCH_INTERVAL_MS} ms`);

  try {
    await prisma.$connect();
    console.log('Worker successfully connected to the database');

    setInterval(() => {
      console.log('[Worker Heartbeat] listening for Redis streams');
    }, 5000);
  } catch (error) {
    console.error('Error in background worker: ', error);
    process.exit(1);
  }
}

startWorker();

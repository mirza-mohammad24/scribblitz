/**
 * This file sets up a BullMQ queue and its associated events for handling AI theme jobs in the game server.
 * It connects to a Redis server specified by the REDIS_URL environment variable. The queue is used to push jobs to
 * a worker, while the queue events are used to listen for job completion events from the worker.
 * Both the queue and the events use separate Redis connections, to avoid blocking issues.
 */

import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

if (!process.env.REDIS_URL) {
  throw new Error('FATAL: REDIS_URL is not defined in the environment variables');
}

//BullMQ STRICTLY requires maxRetriesPerRequest to be null
//We must use a separate connections because QueueEvents blocks the connection(BullMQ documentation recommendation)
const queueConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
const eventsConnection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const QUEUE_NAME = 'ai-theme-queue';

//1. The Queue: Used by the game server to push jobs TO the worker
export const aiThemeQueue = new Queue(QUEUE_NAME, {
  connection: queueConnection,
});

//2. The QueueEvents: Used by the game server to listen for completion events FROM the worker
export const aiThemeQueueEvents = new QueueEvents(QUEUE_NAME, {
  connection: eventsConnection,
});

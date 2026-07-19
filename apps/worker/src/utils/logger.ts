/**
 * This utility file is used to create a logger instance for the worker. It uses the
 * pino library to log messages to both standard output and a rotating log file. The log
 * file is stored in the /app/logs directory and is rotated daily, with a maximum size of
 * 20MB and a limit of 7 files to keep disk usage safe.
 */

import pino from 'pino';

const logger = pino(
  {
    timestamp: pino.stdTimeFunctions.isoTime, //human-readable ISO timestamps instead of raw epoch ms
  },
  pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: { destination: 1 }, //standard output for docker logs
      },
      {
        target: 'pino-roll',
        options: {
          file: '/app/logs/worker.log',
          mkdir: true,
          frequency: 'daily',
          size: '20m',
          limit: { count: 7 }, //Keeps disk usage perfectly safe
        },
      },
    ],
  }),
);

export default logger;

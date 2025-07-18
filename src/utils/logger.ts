/**
 * Logger utility
 */
import pino from 'pino';
import config from '../config';

const logger = pino({
  level: config.logging.level,
  transport: config.logging.prettyPrint
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
        },
      }
    : undefined,
});

export default logger;
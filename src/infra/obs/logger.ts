import pino, { type LoggerOptions } from 'pino';

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'warn' : 'info');

const usePrettyTransport = process.env.PINO_PRETTY === 'true';

const transport = usePrettyTransport
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
      },
    }
  : undefined;

export const loggerConfig: LoggerOptions = {
  level,
  base: undefined,
  transport,
};

export const logger = pino(loggerConfig);


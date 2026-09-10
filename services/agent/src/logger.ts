/**
 * Structured logging via pino.
 *
 * - Plain JSON to stdout in production (or whenever stdout is not a TTY).
 * - Human-readable `pino-pretty` transport when NODE_ENV !== 'production' AND
 *   stdout is a TTY (interactive local dev).
 * - Every logger carries a `service: 'agent-runtime'` base field.
 */
import pino, { type Logger } from 'pino';

const isProd = process.env.NODE_ENV === 'production';
const usepretty = !isProd && process.stdout.isTTY;

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isProd ? 'info' : 'debug'),
  base: { service: 'agent-runtime' },
  ...(usepretty
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

/**
 * Create a child logger bound to per-message identifiers so every line for a
 * given message carries its `messageId` / `ticketId`.
 */
export function child(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}

export type { Logger };

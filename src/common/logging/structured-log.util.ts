import { Logger } from '@nestjs/common';

type LogLevel = 'log' | 'debug' | 'warn' | 'error';

export function structuredLog(
  logger: Logger,
  level: LogLevel,
  event: string,
  context: Record<string, unknown> = {},
) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...context,
  };

  const message = JSON.stringify(payload);
  if (level === 'error') {
    logger.error(message);
    return;
  }
  if (level === 'warn') {
    logger.warn(message);
    return;
  }
  if (level === 'debug') {
    logger.debug(message);
    return;
  }
  logger.log(message);
}

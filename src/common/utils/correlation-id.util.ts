import { randomUUID } from 'crypto';

export function createCorrelationId(): string {
  return randomUUID
    ? randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getCorrelationIdFromHeaders(
  headers?: Record<string, unknown>,
): string {
  const candidates = [
    headers?.['x-correlation-id'],
    headers?.['x-request-id'],
    headers?.['x-correlationid'],
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === 'string'
    ) {
      const first = value[0].trim();
      if (first) return first;
    }
  }

  return createCorrelationId();
}

export function getCorrelationIdFromReq(req: any): string {
  return getCorrelationIdFromHeaders(req?.headers || {});
}

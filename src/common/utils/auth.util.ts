export function getUserIdFromReq(req: any): string | undefined {
  if (!req) return undefined;
  const id = req.user?.id ?? req.user?.sub ?? undefined;
  return typeof id === 'string' ? id : undefined;
}

export function getUserIdFromAuthHeader(authHeader?: string): string | undefined {
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }
  const token = authHeader.slice(7);
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return undefined;
    const json = Buffer.from(payloadPart, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    const id = payload?.sub ?? payload?.id ?? undefined;
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
}

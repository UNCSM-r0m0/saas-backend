export interface UsageHealthResponseV1 {
  service: 'usage';
  status: 'ok';
}

export interface UsageResponseEnvelopeV1<T> {
  version: 'v1';
  data: T;
}

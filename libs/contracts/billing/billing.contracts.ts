export interface BillingHealthResponseV1 {
  service: 'billing';
  status: 'ok';
}

export interface BillingResponseEnvelopeV1<T> {
  version: 'v1';
  data: T;
}

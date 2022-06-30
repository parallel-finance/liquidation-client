import { BN } from '@polkadot/util';

export const RATE_DECIMAL = new BN(10).pow(new BN(18));
export const PERCENTAGE_DECIMAL = new BN(10).pow(new BN(6));
export const PRICE_DECIMAL = new BN(10).pow(new BN(18));
export enum Metrics {
  Heartbeat = 'heartbeat'
}

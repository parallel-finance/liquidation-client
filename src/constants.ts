import { BN } from '@polkadot/util';

export const RATE_DECIMAL = new BN(10).pow(new BN(18));
export const PERCENTAGE_DECIMAL = new BN(10).pow(new BN(6));
export const PRICE_DECIMAL = new BN(10).pow(new BN(18));
export const MERTRIC_NAMESPACE = 'liquidation-client';
export enum Metrics {
  Heartbeat = 'heartbeat', //FIXME(alannotnerd): remove it
  ScannerNewRound = 'scanner-new-round',
  LiquidateNewRound = 'liquidate-new-round'
}

export enum Topics {
  Liquidate = 'liquidate',
  Scanner = 'scanner',
  Client = 'client'
}

export enum ScannerPhrase {
  ScanShortfallBorrowers = 'scan-shortfall-borrowers',
  StoreShortfallBorrowers = 'store-shortfall-borrowers',
  ScanShortfallBorrowersOver = 'scan-shortfall-borrowers-over',
  IgnoreLowRepayBorrower = 'ignore-low-repay-borrowers'
}

export enum LiquidationPhrase {
  ExtrinsicBroadcasting = 'extrinsic-broadcasting',
  ExtrinsicFailed = 'extrinsic-failed',
  ExtrinsicSuccess = 'extrinsic-success'
}

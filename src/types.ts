import { CurrencyId } from '@parallel-finance/types/interfaces';
import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { KeyringPair } from '@polkadot/keyring/types';

export type LiquidationBorrower = {
  borrower: string;
};

export type Liquidation = {
  borrower: string;
  liquidateToken: CurrencyId;
  collateralToken: CurrencyId;
  repay: BN;
  repayDecimal: BN;
};

export type LiquidationStoreFunctions = {
  insertBorrower: (borrower: string) => void;
  isEmpty: () => boolean;
  shiftBorrower: (borrower: string) => string | undefined;
  shiftLast: () => string | undefined;
};

export type LiquidationClient = {
  connect: () => Promise<ApiPromise>;
  start: (
    scan: (lowRepayThreshold: number) => Promise<void>,
    liquidate: (agent: KeyringPair, borrower?: string) => Promise<void>,
    scanInterval: number,
    liquidateInterval: number,
    lowRepayThreshold: number
  ) => Promise<void>;
};

export type OraclePrice = {
  currencyId: CurrencyId;
  price: BN;
  decimal: BN;
};

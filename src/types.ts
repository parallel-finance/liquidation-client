import { CurrencyId } from '@parallel-finance/types/interfaces';
import { BN } from '@polkadot/util';
import { createClient } from 'redis';

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

export type LiquidationInfo = {
  supplies: {
    currencyId: CurrencyId;
    value: BN;
    decimal: BN;
    price: BN;
    liquidateIncentive: BN;
  }[];
  loans: {
    currencyId: CurrencyId;
    value: BN;
    decimal: BN;
    price: BN;
    closeFactor: BN;
  }[];
};

export type LiquidationStoreFunctions = {
  insertBorrower: (borrower: string) => void;
  isEmpty: () => boolean;
  shiftBorrower: (borrower: string) => string | undefined;
  shiftLast: () => string | undefined;
};

export type LiquidationClient = {
  start: (scanInterval: number, liquidateInterval: number, lowRepayThreshold: number) => Promise<void>;
};

export type ScannerClient = {
  start: (scanInterval: number, lowRepayThreshold?: number) => Promise<void>;
};

export type OraclePrice = {
  currencyId: CurrencyId;
  price: BN;
  decimal: BN;
};

export type RedisClient = ReturnType<typeof createClient>;

export type ScanResult = {
  borrower: string;
  totalLoan: number;
  totalCollateral: number;
  shortfall: number;
};

import { EraIndex, RewardDestination } from '@polkadot/types/interfaces';
import BN from 'bn.js';
import { AnyJson } from '@polkadot/types/types';
import { AccountId } from '@parallel-finance/types/interfaces';
import type { u8 } from '@polkadot/types';
import { CurrencyId } from '@parallel-finance/types/interfaces';

export enum ParaPalletType {
  Loans = 'loans'
}

export enum ParaCallType {
  LiquidateBorrow = 'liquidateBorrow'
}

export type ApiParam = AccountId | number | string | BN | EraIndex | RewardDestination | AnyJson;

export type ApiTask = {
  pallet: ParaPalletType;
  call: ParaCallType;
  params: ApiParam[];
};

export type OraclePrice = {
  currencyId: string;
  price: BN;
  decimal: u8;
};

export type LiquidationParam = {
  borrower: AccountId;
  liquidateToken: CurrencyId;
  collateralToken: CurrencyId;
  repay: BN;
};

export interface LiquidationTask {
  borrower: string;
  liquidateToken: CurrencyId;
  collateralToken: CurrencyId;
  repay: BN;
}

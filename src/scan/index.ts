import { ApiPromise } from '@polkadot/api';
import { zipWith, sum } from 'lodash';
import { PRICE_DECIMAL } from '../constants';
import calculateLiquidationInfo from '../liquidate/calculateLiquidationInfo';
import { LiquidationStoreFunctions, RedisClient, ScanResult } from '../types';
import refreshBorrowersRedis from './refreshBorrowersRedis';
import scanLiquidationBorrowers from './scanLiquidationBorrowers';
import scanShortfallBorrowers from './scanShortfallBorrowers';
import storeLiquidationBorrowers from './storeLiquidationBorrowers';
import { logger } from '../logger';

export const scanAndStore =
  (api: ApiPromise, storeFuncs: LiquidationStoreFunctions) =>
  async (lowRepayThreshold: number): Promise<void> => {
    const borrowers = await scanLiquidationBorrowers(api)(lowRepayThreshold);
    storeLiquidationBorrowers(storeFuncs)(borrowers);
  };

export const scanAndRefreshRedis =
  (api: ApiPromise, redisClient: RedisClient) =>
  async (lowRepayThreshold: number): Promise<void> => {
    const borrowers = await scanLiquidationBorrowers(api)(lowRepayThreshold);
    await refreshBorrowersRedis(redisClient)(borrowers);
  };

export const scanAndReturn = (api: ApiPromise) => async (): Promise<ScanResult[]> => {
  const borrowers = await scanShortfallBorrowers(api);
  logger.debug(`SCAN:shortfallBorrowers count: ${borrowers.length}`);
  const liquidationInfo = await Promise.all(borrowers.map(({ borrower }) => calculateLiquidationInfo(api)(borrower)));
  return zipWith(borrowers, liquidationInfo, ({ borrower, shortfall }, { loans, supplies }) => ({
    borrower,
    shortfall: shortfall.div(PRICE_DECIMAL).toNumber(),
    totalLoan: sum(loans.map((loan) => loan.value.div(PRICE_DECIMAL).toNumber())),
    totalSupply: sum(supplies.map((loan) => loan.value.div(PRICE_DECIMAL).toNumber()))
  }));
};

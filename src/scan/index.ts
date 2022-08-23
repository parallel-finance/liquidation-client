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
import { BigNumber } from 'bignumber.js';
import { BN } from '@polkadot/util';

const b2b = (n: BN) => new BigNumber(n.toString());

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
  return zipWith(borrowers, liquidationInfo, ({ borrower, shortfall }, { loans, supplies }) => {
    const shortfallWithoutDecimal = b2b(shortfall).div(b2b(PRICE_DECIMAL)).toNumber()
    if (shortfallWithoutDecimal > 1000) {
      logger.metric([{ MetricName: 'shortfall-too-big', Value: 1 }]);
    }
    return {
      borrower,
      shortfall: shortfallWithoutDecimal,
      totalLoan: sum(loans.map((loan) => b2b(loan.value).div(b2b(PRICE_DECIMAL)).toNumber())),
      totalCollateral: sum(supplies.map((loan) => b2b(loan.value).div(b2b(PRICE_DECIMAL)).toNumber()))
    }
  });
};

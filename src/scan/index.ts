import { ApiPromise } from '@polkadot/api';
import { LiquidationStoreFunctions, RedisClient } from '../types';
import refreshBorrowersRedis from './refreshBorrowersRedis';
import scanLiquidationBorrowers from './scanLiquidationBorrowers';
import storeLiquidationBorrowers from './storeLiquidationBorrowers';

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

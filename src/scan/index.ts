import { ApiPromise } from '@polkadot/api';
import { LiquidationStoreFunctions } from '../types';
import scanLiquidationBorrowers from './scanLiquidationBorrowers';
import storeLiquidationBorrowers from './storeLiquidationBorrowers';

const scan = (api: ApiPromise, storeFuncs: LiquidationStoreFunctions) => async (): Promise<void> => {
  const borrowers = await scanLiquidationBorrowers(api)();
  storeLiquidationBorrowers(storeFuncs)(borrowers);
};

export default scan;

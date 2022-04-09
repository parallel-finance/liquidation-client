import { logger } from '../logger';
import { LiquidationStoreFunctions } from '../types';

const storeLiquidationBorrowers =
  (storeFuncs: LiquidationStoreFunctions) =>
  (borrowers: string[]): void => {
    if (borrowers.length == 0) {
      logger.debug(`SCAN:There are no borrowers to store`);
    }
    logger.debug(`SCAN:Scanned Liquidation borrowers <-> [${borrowers.length}]`);
    borrowers.forEach(storeFuncs.insertBorrower);
  };

export default storeLiquidationBorrowers;

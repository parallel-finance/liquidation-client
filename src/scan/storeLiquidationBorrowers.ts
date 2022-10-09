import { ScannerPhrase, Topics } from '../constants';
import { logger } from '../logger';
import { LiquidationStoreFunctions } from '../types';

const storeLiquidationBorrowers =
  (storeFuncs: LiquidationStoreFunctions) =>
  (borrowers: string[]): void => {
    logger.info({
      topic: Topics.Scanner,
      phrase: ScannerPhrase.StoreShortfallBorrowers,
      count: borrowers.length
    });
    borrowers.forEach(storeFuncs.insertBorrower);
  };

export default storeLiquidationBorrowers;

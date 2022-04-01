import { LiquidationBorrower } from '../types';
import { LiquidationStoreFunctions } from '../types';
import { logger } from '../logger';

const storeFunctions = (store: Loki): LiquidationStoreFunctions => {
  const getRecords = () => store.getCollection<LiquidationBorrower>('borrowers');

  const isEmpty = () => getRecords().data.length === 0;

  const insertBorrower = (borrower: string) => {
    const existing = getRecords().find({ borrower: { $eq: borrower } });
    if (existing.length > 0) {
      logger.debug(`SCAN:borrower already stored: ${borrower}`);
    } else {
      logger.debug(`SCAN:insert borrower: ${borrower}`);
      getRecords().insert({ borrower: borrower });
    }
  };

  const shiftBorrower = (borrower: string) => {
    const maybeBorrower = getRecords().findOne({ borrower: { $eq: borrower } });
    if (maybeBorrower) {
      getRecords().findAndRemove({ borrower: { $eq: borrower } });
      return maybeBorrower.borrower;
    }
    return undefined;
  };

  const shiftLast = () => getRecords().data.shift()?.borrower;

  return {
    insertBorrower,
    isEmpty,
    shiftBorrower,
    shiftLast
  };
};

export default storeFunctions;

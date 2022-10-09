import { LiquidationBorrower } from '../types';
import { LiquidationStoreFunctions } from '../types';
import { logger } from '../logger';
import { ScannerPhrase, Topics } from '../constants';

const storeFunctions = (store: Loki): LiquidationStoreFunctions => {
  const getRecords = () => store.getCollection<LiquidationBorrower>('borrowers');

  const isEmpty = () => getRecords().data.length === 0;

  const insertBorrower = (borrower: string) => {
    const existing = getRecords().find({ borrower: { $eq: borrower } });
    if (existing.length > 0) {
      logger.info({
        topic: Topics.Scanner,
        phrase: ScannerPhrase.StoreShortfallBorrowers,
        borrower,
        stored: false,
        msg: `${borrower} existed!`
      });
    } else {
      logger.info({
        topic: Topics.Scanner,
        phrase: ScannerPhrase.StoreShortfallBorrowers,
        borrower,
        stored: true,
        msg: `Insert ${borrower}`
      });
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

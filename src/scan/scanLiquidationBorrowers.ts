import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { ScannerPhrase, Topics } from '../constants';
import generateLiquidation from '../liquidate/generateLiquidation';
import { logger } from '../logger';
import scanShortfallBorrowers from './scanShortfallBorrowers';

const scanLiquidationBorrowers =
  (api: ApiPromise) =>
  async (lowRepayThreshold: number): Promise<string[]> => {
    const shortfallBorrowers = (await scanShortfallBorrowers(api)).map(({ borrower }) => borrower);
    logger.info({
      topic: Topics.Scanner,
      phrase: ScannerPhrase.ScanShortfallBorrowersOver,
      count: shortfallBorrowers.length
    });
    const liquidations = await Promise.all(shortfallBorrowers.map((borrower) => generateLiquidation(api)(borrower)));
    const validLiquidations = liquidations.filter((liquidation) =>
      liquidation.repay.div(liquidation.repayDecimal).gte(new BN(lowRepayThreshold))
    );

    const ignoredCount = liquidations.length - validLiquidations.length;
    if (ignoredCount) {
      logger.info({
        topic: Topics.Scanner,
        phrase: ScannerPhrase.IgnoreLowRepayBorrower,
        count: ignoredCount
      });
    }
    return validLiquidations.map((liquidation) => liquidation.borrower);
  };

export default scanLiquidationBorrowers;

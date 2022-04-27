import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import generateLiquidation from '../liquidate/generateLiquidation';
import { logger } from '../logger';
import scanShortfallBorrowers from './scanShortfallBorrowers';

const scanLiquidationBorrowers =
  (api: ApiPromise) =>
  async (lowRepayThreshold: number): Promise<string[]> => {
    const shortfallBorrowers = await (await scanShortfallBorrowers(api)).map(({ borrower }) => borrower);
    logger.debug(`SCAN:shortfallBorrowers count: ${shortfallBorrowers.length}`);
    const liquidations = await Promise.all(shortfallBorrowers.map((borrower) => generateLiquidation(api)(borrower)));
    const validLiquidations = liquidations.filter((liquidation) =>
      liquidation.repay.div(liquidation.repayDecimal).gte(new BN(lowRepayThreshold))
    );

    const ignoredCount = liquidations.length - validLiquidations.length;
    if (ignoredCount) {
      logger.debug(`SCAN:ignore [${ignoredCount}] liquidation with low repay amount`);
    }
    return validLiquidations.map((liquidation) => liquidation.borrower);
  };

export default scanLiquidationBorrowers;

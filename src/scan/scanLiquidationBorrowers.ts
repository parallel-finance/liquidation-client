import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { isEqual, uniqWith } from 'lodash';
import generateLiquidation from '../liquidate/generateLiquidation';
import { logger } from '../logger';

const scanLiquidationBorrowers = (api: ApiPromise) => async (): Promise<string[]> => {
  const shortfallBorrowers = await scanShortfallBorrowers(api);
  logger.debug(`SCAN:shortfallBorrowers count: ${shortfallBorrowers.length}`);
  const liquidations = await Promise.all(shortfallBorrowers.map((borrower) => generateLiquidation(api)(borrower)));
  const validLiquidations = liquidations.filter((liquidation) =>
    liquidation.repay.div(liquidation.repayDecimal).gte(new BN(1))
  );

  const ignoredCount = liquidations.length - validLiquidations.length;
  if (ignoredCount) {
    logger.debug(`SCAN:ignore [${ignoredCount}] tasks with low repay amount`);
  }
  return validLiquidations.map((liquidation) => liquidation.borrower);
};

const scanShortfallBorrowers = async (api: ApiPromise): Promise<string[]> => {
  logger.debug('SCAN:scan shortfall borrowers');
  const borrowerKeys = await api.query.loans.accountBorrows.keys();
  const borrowers = uniqWith(
    borrowerKeys.map(({ args: [, accountId] }) => accountId),
    isEqual
  );

  return (
    await Promise.all(
      borrowers.map(async (borrower) => {
        const [, shortfall] = await api.rpc.loans.getAccountLiquidity(borrower, null);
        logger.debug(`SCAN:borrower: ${borrower.toHuman()}, shortfall: ${shortfall.toHuman()}`);
        return { borrower, hasShortfall: shortfall.toBn().cmp(new BN(0)) !== 0 };
      })
    )
  )
    .filter(({ hasShortfall }) => hasShortfall)
    .map(({ borrower }) => borrower);
};

export default scanLiquidationBorrowers;

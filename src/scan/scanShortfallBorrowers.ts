import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { isEqual, uniqWith } from 'lodash';
import { PRICE_DECIMAL } from '../constants';
import { logger } from '../logger';

const scanShortfallBorrowers = async (api: ApiPromise): Promise<{ borrower: string; shortfall: BN }[]> => {
  logger.debug('SCAN:scan shortfall borrowers');
  const borrowerKeys = await api.query.loans.accountBorrows.keys();
  const borrowers = uniqWith(
    borrowerKeys.map(({ args: [, accountId] }) => accountId),
    isEqual
  );

  return (
    await Promise.all(
      borrowers.map(async (borrower) => {
        //TODO: Change to use new rpc endpoint to get shortfall value
        const [, shortfall] = await api.rpc.loans.getLiquidationThresholdLiquidity(borrower, null);
        logger.debug(`SCAN:borrower: ${borrower.toHuman()}, shortfall: ${shortfall.toBn().div(PRICE_DECIMAL)}`);
        return { borrower, shortfall: shortfall.toBn(), hasShortfall: shortfall.toBn().cmp(new BN(0)) !== 0 };
      })
    )
  ).filter(({ hasShortfall }) => hasShortfall);
};

export default scanShortfallBorrowers;

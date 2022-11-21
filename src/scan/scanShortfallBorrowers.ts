import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { isEqual, uniqWith } from 'lodash';
import { PRICE_DECIMAL, ScannerPhrase, Topics } from '../constants';
import { logger } from '../logger';

const scanShortfallBorrowers = async (api: ApiPromise): Promise<{ borrower: string; shortfall: BN }[]> => {
  logger.debug({
    topic: Topics.Scanner,
    phrase: ScannerPhrase.ScanShortfallBorrowers
  });
  const borrowerKeys = await api.query.loans.accountBorrows.keys();
  const borrowers = uniqWith(
    borrowerKeys.map(({ args: [, accountId] }) => accountId),
    isEqual
  );

  return (
    await Promise.all(
      borrowers.map(async (borrower) => {
        const [liquidity, shortfall, lfLiquidity, _] = (
          await api.rpc.loans.getLiquidationThresholdLiquidity(borrower)
        ).map((e) => e.toBn());
        // Shortfall = B_other + B_dot_over_base - T_other
        //           = B_other - T_other + max(B_dot - T_lf, 0)
        //           = B_all - T_all + max(0, T_lf - B_dot)
        //           = shortfall > 0? shortfall + lfLiquidity : lfLiquidity - liquidity
        let effectShortfall = shortfall.gtn(0)
          ? shortfall.add(lfLiquidity)
          : lfLiquidity.gt(liquidity)
          ? lfLiquidity.sub(liquidity)
          : new BN(0);
        let hasShortfall = effectShortfall.cmpn(0) !== 0;
        hasShortfall &&
          logger.info({
            topic: Topics.Scanner,
            phrase: ScannerPhrase.ScanShortfallBorrowers,
            borrower: borrower.toHuman(),
            shortfall: effectShortfall.div(PRICE_DECIMAL).toString()
          });
        return { borrower, shortfall: effectShortfall, hasShortfall };
      })
    )
  ).filter(({ hasShortfall }) => hasShortfall);
};

export default scanShortfallBorrowers;

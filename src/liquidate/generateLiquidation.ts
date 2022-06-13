import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import { maxBy } from 'lodash';
import { PERCENTAGE_DECIMAL, RATE_DECIMAL } from '../constants';
import { Liquidation } from '../types';
import calculateLiquidationInfo from './calculateLiquidationInfo';

const generateLiquidation =
  (api: ApiPromise) =>
  async (borrower: string): Promise<Liquidation> => {
    const { supplies, loans } = await calculateLiquidationInfo(api)(borrower);
    const bestCollateral = maxBy(supplies, (misc) => BigInt(misc.value.toString()));
    const bestDebt = maxBy(loans, (misc) => BigInt(misc.value.toString()));
    const liquidateIncentive: BN = bestCollateral.liquidateIncentive;
    const closeFactor: BN = bestDebt.closeFactor;
    const repayValue = BN.min(
      bestCollateral.value.mul(RATE_DECIMAL).div(liquidateIncentive),
      bestDebt.value.mul(closeFactor).div(PERCENTAGE_DECIMAL)
    );
    const repayAmount = repayValue.div(bestDebt.price);
    return {
      borrower,
      liquidateToken: bestDebt.currencyId,
      collateralToken: bestCollateral.currencyId,
      repay: repayAmount,
      repayDecimal: bestDebt.decimal
    };
  };

export default generateLiquidation;

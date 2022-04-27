import { LiquidationStoreFunctions } from '../types';
import { logger } from '../logger';
import generateLiquidation from './generateLiquidation';
import sendLiquidation from './sendLiquidation';
import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';

const liquidate =
  (api: ApiPromise, storeFuncs: LiquidationStoreFunctions) =>
  async (agent: KeyringPair, borrower?: string): Promise<void> => {
    if (borrower) {
      const liquidationBorrower = storeFuncs.shiftBorrower(borrower);
      if (!liquidationBorrower) {
        logger.debug('LIQIDATE:Cannot get target liquidation to liquidate');
      }
      const liquidation = await generateLiquidation(api)(liquidationBorrower);
      logger.debug(
        `LIQUIDATE:handling <-> [${liquidation.borrower}, ${liquidation.liquidateToken}, ${liquidation.repay}, ${liquidation.collateralToken}]`
      );
      await sendLiquidation(api)(liquidation, agent);
    } else {
      while (!storeFuncs.isEmpty()) {
        const liquidationBorrower = storeFuncs.shiftLast();
        const liquidation = await generateLiquidation(api)(liquidationBorrower);
        logger.debug(
          `LIQUIDATE:handling <-> [${liquidation.borrower}, ${liquidation.liquidateToken}, ${liquidation.repay}, ${liquidation.collateralToken}]`
        );
        await sendLiquidation(api)(liquidation, agent);
      }
    }
    logger.debug('LIQUIDATE:There are no liquidations to run');
  };

export default liquidate;

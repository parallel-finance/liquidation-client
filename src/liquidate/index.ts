import { LiquidationStoreFunctions } from '../types';
import { logger } from '../logger';
import generateLiquidation from './generateLiquidation';
import sendLiquidation from './sendLiquidation';
import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { Topics } from '../constants';

const liquidate =
  (api: ApiPromise, storeFuncs: LiquidationStoreFunctions) =>
  async (agent: KeyringPair, borrower?: string): Promise<void> => {
    if (borrower) {
      const liquidationBorrower = storeFuncs.shiftBorrower(borrower);
      if (!liquidationBorrower) {
        logger.fatal({
          topic: Topics.Liquidate,
          msg: 'Liquidate borrower is null which should never be!'
        });
        throw new Error('Unexpected null liquidation borrower');
      }
      const liquidation = await generateLiquidation(api)(liquidationBorrower);
      await sendLiquidation(api)(liquidation, agent);
    } else {
      while (!storeFuncs.isEmpty()) {
        const liquidationBorrower = storeFuncs.shiftLast();
        const liquidation = await generateLiquidation(api)(liquidationBorrower);
        await sendLiquidation(api)(liquidation, agent);
      }
    }
    logger.debug({
      topic: Topics.Liquidate,
      msg: 'There are no liquidations to run'
    });
  };

export default liquidate;

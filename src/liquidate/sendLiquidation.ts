import { Liquidation } from '../types';
import { logger } from '../logger';
import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { BN } from '@polkadot/util';
import { LiquidationPhrase, Topics } from '../constants';

const sendLiquidation =
  (api: ApiPromise) =>
  async (liquidation: Liquidation, agent: KeyringPair): Promise<void> => {
    const nonce = await api.rpc.system.accountNextIndex(agent.address);

    return new Promise<void>((resolve, reject) => {
      const tx = api.tx.loans.liquidateBorrow(
        liquidation.borrower,
        liquidation.liquidateToken,
        liquidation.repay,
        liquidation.collateralToken
      );
      tx.signAndSend(agent, { nonce }, ({ events, status }) => {
        if (status.isReady) {
          logger.debug('LIQUIDATE:tx::processing');
          logger.info({
            topic: Topics.Liquidate,
            phrase: LiquidationPhrase.ExtrinsicBroadcasting,
            hash: tx.toHex(),
            borrower: liquidation.borrower,
            liquidatetoken: liquidation.liquidateToken,
            repayAmount: liquidation.repay,
            collateralToken: liquidation.collateralToken
          });
        }
        if (status.isInBlock) {
          events.forEach(({ event: { data, method } }) => {
            if (method === 'ExtrinsicFailed') {
              logger.error({
                topic: Topics.Liquidate,
                phrase: LiquidationPhrase.ExtrinsicFailed
              });
              return reject(data);
            }

            if (method === 'ExtrinsicSuccess') {
              logger.error({
                topic: Topics.Liquidate,
                phrase: LiquidationPhrase.ExtrinsicSuccess
              });
              return resolve();
            }
          });
        }
      });
    });
  };

export default sendLiquidation;

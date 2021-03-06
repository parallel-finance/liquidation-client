import { Liquidation } from '../types';
import { logger } from '../logger';
import { ApiPromise } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { BN } from '@polkadot/util';

const sendLiquidation =
  (api: ApiPromise) =>
  async (liquidation: Liquidation, agent: KeyringPair): Promise<void> => {
    const nonce = await api.rpc.system.accountNextIndex(agent.address);

    //TODO(alan): should send emergency report and exit.
    return new Promise<void>((resolve, reject) => {
      api.tx.loans
        .liquidateBorrow(
          liquidation.borrower,
          liquidation.liquidateToken,
          liquidation.repay,
          liquidation.collateralToken
        )
        .signAndSend(agent, { nonce }, ({ events, status }) => {
          if (status.isReady) {
            logger.debug('LIQUIDATE:tx::processing');
          }
          if (status.isInBlock) {
            events.forEach(({ event: { data, method } }) => {
              if (method === 'ExtrinsicFailed') {
                logger.debug('LIQUIDATE:tx::failed');
                // TODO(alannotnerd): describe error details
                return reject(data);
              }

              if (method === 'ExtrinsicSuccess') {
                logger.debug('LIQUIDATE:tx::succeeded');
                return resolve();
              }
            });
          }
        });
    });
  };

export default sendLiquidation;

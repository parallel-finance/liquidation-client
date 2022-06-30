import { KeyringPair } from '@polkadot/keyring/types';
import { LiquidationClient } from './types';
import { logger } from './logger';
import setPromiseInterval from 'set-promise-interval';

const liquidationClient = (
  scan: (lowRepayThreshold: number) => Promise<void>,
  liquidate: (agent: KeyringPair, borrower?: string) => Promise<void>,
  agent: KeyringPair,
  target?: string
): LiquidationClient => {
  const start = async (scanInterval: number, liquidateInterval: number, lowRepayThreshold: number): Promise<void> => {
    await liquidate(agent, target);
    const scannerWork = async () => {
      logger.debug('--------------------scanner interval--------------------');
      logger.metric([{ MetricName: 'scanner-new-round', Value: 1 }]);
      await scan(lowRepayThreshold).catch(logger.error);
      logger.debug('--------------------scanner end--------------------');
    };
    const liquidateWork = async () => {
      logger.debug('--------------------liquidate interval--------------------');
      logger.metric([{ MetricName: 'liquidate-new-round', Value: 1 }]);
      await liquidate(agent).catch(logger.error);
      logger.debug('--------------------liquidate end--------------------');
    };
    setPromiseInterval(scannerWork, scanInterval);
    setPromiseInterval(liquidateWork, liquidateInterval);
  };

  return {
    start
  };
};

export default liquidationClient;

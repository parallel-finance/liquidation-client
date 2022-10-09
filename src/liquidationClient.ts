import { KeyringPair } from '@polkadot/keyring/types';
import { LiquidationClient } from './types';
import { logger } from './logger';
import setPromiseInterval from 'set-promise-interval';
import { Topics } from './constants';

const liquidationClient = (
  scan: (lowRepayThreshold: number) => Promise<void>,
  liquidate: (agent: KeyringPair, borrower?: string) => Promise<void>,
  agent: KeyringPair,
  target?: string
): LiquidationClient => {
  const start = async (scanInterval: number, liquidateInterval: number, lowRepayThreshold: number): Promise<void> => {
    await liquidate(agent, target);
    const scannerWork = async () => {
      logger.info({
        topic: Topics.Scanner,
        status: 'Start',
        metric: 'scanner-new-round'
      });
      await scan(lowRepayThreshold).catch(logger.error);
      logger.info({
        topic: Topics.Scanner,
        status: 'End',
        metric: 'scanner-new-round'
      });
    };
    const liquidateWork = async () => {
      logger.info({
        topic: Topics.Liquidate,
        status: 'Start',
        metric: 'liquidate-new-round'
      });
      await liquidate(agent).catch(logger.error);
      logger.info({
        topic: Topics.Liquidate,
        status: 'End',
        metric: 'liquidate-new-round'
      });
    };
    setPromiseInterval(scannerWork, scanInterval);
    setPromiseInterval(liquidateWork, liquidateInterval);
  };

  return {
    start
  };
};

export default liquidationClient;

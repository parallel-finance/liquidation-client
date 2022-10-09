import { ScannerClient } from './types';
import { logger } from './logger';
import setPromiseInterval from 'set-promise-interval';
import { Topics } from './constants';

const scannerClient = (scan: (lowRepayThreshold: number) => Promise<void>): ScannerClient => {
  const start = async (scanInterval: number, lowRepayThreshold?: number): Promise<void> => {
    const scannerWork = async () => {
      logger.info({
        topic: Topics.Scanner,
        state: 'start'
      });
      await scan(lowRepayThreshold || 0).catch(logger.error);
      logger.info({
        topic: Topics.Scanner,
        state: 'end'
      });
    };
    setPromiseInterval(scannerWork, scanInterval);
  };
  return {
    start
  };
};

export default scannerClient;

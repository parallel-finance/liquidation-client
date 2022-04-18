import { ScannerClient } from './types';
import { logger } from './logger';
import setPromiseInterval from 'set-promise-interval';

const scannerClient = (scan: (lowRepayThreshold: number) => Promise<void>): ScannerClient => {
  const start = async (scanInterval: number, lowRepayThreshold?: number): Promise<void> => {
    const scannerWork = async () => {
      logger.debug('--------------------scanner client interval--------------------');
      await scan(lowRepayThreshold || 0);
      logger.debug('--------------------scanner client end--------------------');
    };
    setPromiseInterval(scannerWork, scanInterval);
  };
  return {
    start
  };
};

export default scannerClient;

import { ApiPromise, WsProvider } from '@polkadot/api';
import { options } from '@parallel-finance/api';
import { typesBundle } from '@parallel-finance/type-definitions';
import { KeyringPair } from '@polkadot/keyring/types';
import { LiquidationClient } from './types';
import { logger } from './logger';
import setPromiseInterval from 'set-promise-interval';

const liquidationClient = (server: string, agent: KeyringPair, target?: string): LiquidationClient => {
  const connect = async (): Promise<ApiPromise> => {
    const api = await ApiPromise.create(
      options({
        types: {
          TAssetBalance: 'Balance'
        },
        typesBundle,
        provider: new WsProvider(server)
      })
    );
    // Retrieve the chain & node information information via rpc calls
    const [chain, nodeName, nodeVersion] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.system.name(),
      api.rpc.system.version()
    ]);
    logger.debug(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);
    return api;
  };

  const start = async (
    scan: (lowRepayThreshold: number) => Promise<void>,
    liquidate: (agent: KeyringPair, borrower?: string) => Promise<void>,
    scanInterval: number,
    liquidateInterval: number,
    lowRepayThreshold: number
  ): Promise<void> => {
    await liquidate(agent, target);
    const scannerWork = async () => {
      logger.debug('--------------------scanner interval--------------------');
      await scan(lowRepayThreshold);
      logger.debug('--------------------scanner end--------------------');
    };
    const liquidateWork = async () => {
      logger.debug('--------------------liquidate interval--------------------');
      await liquidate(agent);
      logger.debug('--------------------liquidate end--------------------');
    };
    setPromiseInterval(scannerWork, scanInterval);
    setPromiseInterval(liquidateWork, liquidateInterval);
  };

  return {
    connect,
    start
  };
};

export default liquidationClient;

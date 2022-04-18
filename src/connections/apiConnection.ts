import { ApiPromise, WsProvider } from '@polkadot/api';
import { options } from '@parallel-finance/api';
import { typesBundle } from '@parallel-finance/type-definitions';
import { logger } from '../logger';

const apiConnection = async (server: string): Promise<ApiPromise> => {
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

export default apiConnection;

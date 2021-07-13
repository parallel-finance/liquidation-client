const { ApiPromise, WsProvider } = require('@polkadot/api');
const { types, typesAlias } = require('../config/types.json');
const rpc = require('../config/rpc.json');

async function main () {
  // Initialise the provider to connect to the local node
  const provider = new WsProvider('wss://testnet-rpc.parallel.fi');

  // Create the API and wait until ready
  const api = await ApiPromise.create({ provider, types, typesAlias, rpc});

  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);

  console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);
}

main().catch(console.error).finally(() => process.exit());

import {ApiPromise, WsProvider} from '@polkadot/api';
import {options} from '@parallel-finance/api';
import '@parallel-finance/types';

const {PARALLEL} = require('../config/endpoints.json');

async function scan_accounts(api: ApiPromise) {
  console.log("scan borrowers");
  const accountBorrows = await api.query.loans.accountBorrows.entries();
  await Promise.all(
    accountBorrows.map(async (accountId) => {
      const accountLiquidity = await api.rpc.loans.getAccountLiquidity(accountId, null);
      console.log("borrower", accountId, "liquidity", accountLiquidity)
    })
  );
}

async function main() {
  // Initialise the provider to connect to the local node
  const provider = new WsProvider(PARALLEL);

  // Create the API and wait until ready
  const api = await ApiPromise.create(options({provider}));

  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);

  console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

  // const accountId = '5GBykvvrUz3vwTttgHzUEPdm7G1FND1reBfddQLdiaCbhoMd';
  // const accountLiquidity = await api.rpc.loans.getAccountLiquidity(accountId, null);
  //
  // console.log(accountLiquidity.toHuman());
  await scan_accounts(api);

  // Get all borrowers by scanning the AccountBorrows of each active market.
  // Perform every 5 minutes asynchronously.

  // Get the (liquidity, shortfall) for each borrower, and put the borrower who has a
  // positive shortfall into the liquidation message queue. Perform every 5 minutes asynchronously.
  // Message queue can adopt redis or postgreSQL.

  // Get borrower from message queue, and get the latest (liquidity, shortfall) for the borrower.

  // Scan all the debit asset of the borrower, and sort the value of borrow balance in descending order.
  // The top asset is the best liquidation token.

  // Scan all the collateral asset of the borrower, and sort the value of collateral in descending order.
  // The top asset is the best collateral token.

  // Assume that A is the liquidation token, B is the collateral token
  // Calculate the repay amount.
  // repayAmount = min(liquidator's balance of A, closeFactor * A's borrow balance of borrower, The total value of B(borrower's) / B's price)

  // Liquidate borrow.
}

main().catch(console.error).finally(() => process.exit());

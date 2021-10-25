import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import '@parallel-finance/types';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { options } from '@parallel-finance/api';
import { PARALLEL } from '../config/endpoints.json';
// import { liquidateBorrow } from './service';
import inquirer from 'inquirer';
import { Command } from 'commander';
import interval from 'interval-promise'
<<<<<<< HEAD
import { logger } from './logger'

const program = new Command();
const LISTEN_INTERVAL = 500
=======
import setPromiseInterval, { clearPromiseInterval } from 'set-promise-interval'
import { logger } from './logger';
import { ApiService } from './service';

const program = new Command();
const LISTEN_INTERVAL = 5000
>>>>>>> 447d073ce2892ab8cf50a4d1e77e0b5e8dacca6a

program
  .name('liquidation-client')
  .version('1.0.0.', '-v, --vers', 'output the current version')
  .option('-s, --server <string>', 'The Parachain API endpoint', 'ws://127.0.0.1:9944')
<<<<<<< HEAD
  .option('-s, --seed <string>', 'The account seed to use', '//Bob//stash')
=======
  .option('-s, --seed <string>', 'The account seed to use', '//Alice//stash')
>>>>>>> 447d073ce2892ab8cf50a4d1e77e0b5e8dacca6a
  .option('-i, --interactive [boolean]', 'Input seed interactively', false);

program.parse();

const { server, seed, interactive } = program.opts();

async function main() {
  // // Initialise the provider to connect to the local node
  // const provider = new WsProvider(server);

  // // Create the API and wait until ready
  // const api = await ApiPromise.create(options({ provider }));

  // // Retrieve the chain & node information information via rpc calls
  // const [chain, nodeName, nodeVersion] = await Promise.all([
  //   api.rpc.system.chain(),
  //   api.rpc.system.name(),
  //   api.rpc.system.version()
  // ]);
  // logger.debug(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);
  logger.debug(`::endpoint::> ${server}`);
  await cryptoWaitReady();

  const keyring = new Keyring({ type: 'sr25519' });
  const agent = keyring.addFromMnemonic(
    interactive
      ? await inquirer
          .prompt<{ seed: string }>([
            {
              type: 'password',
              name: 'seed',
              message: 'Input your seed'
            }
          ])
          .then(({ seed }) => seed)
      : seed
  );

<<<<<<< HEAD
  // await liquidateBorrow(api, signer);
  liquidate(liquidateBorrow, api, signer)
=======
  const service = new ApiService({ server, agent });
  await service.connect()
>>>>>>> 447d073ce2892ab8cf50a4d1e77e0b5e8dacca6a

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

<<<<<<< HEAD
async function liquidate(fn: any, api: any, signer: any): Promise<void> {
  console.log(`Start liquidating`)
  interval(
    async () => {
      console.log(`interval`)
      const tasks = await fn
      if (!tasks) {
        logger.debug(`There is no task to be liquidated <-> [${tasks}]`)
        console.log(`There is no task to be liquidated <-> [${tasks}])`)
        return
      }
      logger.debug(`Liquidation tasks <-> [${tasks}]`)
      console.log(`Liquidation tasks <-> [${tasks}]`)
    
      await Promise.all(
        tasks.map(async (task) => {
          const { borrower, liquidateToken, repay, collateralToken } = task
          logger.debug(`task::handling <-> [${task}]`)
          await api.tx.loans
            .liquidateBorrow(borrower, liquidateToken, repay, collateralToken)
            .signAndSend(signer)
            .catch(logger.error);
        })
      );
    },
    LISTEN_INTERVAL,
    {
      stopOnError: false
    }
  )
}

main()
  .catch(console.error)
  .finally(() => process.exit());
=======
main().catch((e) => {
  logger.debug(e)
  process.exit(-1)
})

process.on('unhandledRejection', (err) => logger.error(err))
>>>>>>> 447d073ce2892ab8cf50a4d1e77e0b5e8dacca6a

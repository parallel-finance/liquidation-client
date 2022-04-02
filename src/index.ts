import '@parallel-finance/types';
import { Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { logger } from './logger';
import liquidationStore from './liquidationStore';
import storeFunctions from './liquidationStore/storeFunctions';
import liquidationClient from './liquidationClient';
import scan from './scan';
import liquidate from './liquidate';

const SCAN_INTERVAL: number = 1000 * 60;
const LIQUIDATE_INTERVAL: number = 1000 * 25;
const LOW_REPAY_THRESHOLD = 1;

const program = new Command();

program
  .name('liquidation-client')
  .version('1.0.0.', '-v, --vers', 'output the current version')
  .option('-e, --endpoint <string>', 'The Parachain API endpoint', 'ws://127.0.0.1:9948')
  .option('-s, --seed <string>', 'The account seed to use', '//Alice//stash')
  .option('-i, --interactive [boolean]', 'Input seed interactively', false)
  .option('-t, --target <string>', 'Liquidate target account');

program.parse();

const { endpoint, seed, interactive, target } = program.opts();

async function main() {
  logger.debug(`::endpoint::> ${endpoint}`);
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
          .then(({ seed }) => {
            logger.debug('successful import of liquidation account');
            seed;
          })
      : seed
  );
  // Get all borrowers by scanning the AccountBorrows of each active market.
  // Perform every 1 minutes asynchronously.

  // Get the (liquidity, shortfall) for each borrower, and put the borrower who has a
  // positive shortfall into the liquidation message queue. Perform every 1 minutes asynchronously.
  // Message queue in this case is a signle file db

  // Get borrower from message queue, and get the latest (liquidity, shortfall) for the borrower.

  // Scan all the debit asset of the borrower, and sort the value of borrow balance in descending order.
  // The top asset is the best liquidation token.

  // Scan all the collateral asset of the borrower, and sort the value of collateral in descending order.
  // The top asset is the best collateral token.

  // Assume that A is the liquidation token, B is the collateral token
  // Calculate the repay amount.
  // repayAmount = min(liquidator's balance of A, closeFactor * A's borrow balance of borrower, The total value of B(borrower's) / B's price)

  // Liquidate borrow.

  const client = liquidationClient(endpoint, agent, target);
  const api = await client.connect();

  const store = liquidationStore();
  const storeFuncs = storeFunctions(store);

  const scanFunc = scan(api, storeFuncs);
  const liquidateFunc = liquidate(api, storeFuncs);

  await client.start(scanFunc, liquidateFunc, SCAN_INTERVAL, LIQUIDATE_INTERVAL, LOW_REPAY_THRESHOLD);
}

main().catch((e) => {
  logger.debug(e);
  process.exit(-1);
});

process.on('unhandledRejection', (err) => logger.error(err));

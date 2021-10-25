import { Keyring } from '@polkadot/api';
import '@parallel-finance/types';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { logger } from './logger';
import { ApiService } from './service';

const program = new Command();

program
  .name('liquidation-client')
  .version('1.0.0.', '-v, --vers', 'output the current version')
  .option('-s, --server <string>', 'The Parachain API endpoint', 'ws://127.0.0.1:9944')
  .option('-s, --seed <string>', 'The account seed to use', '//Alice//stash')
  .option('-i, --interactive [boolean]', 'Input seed interactively', false);

program.parse();

const { server, seed, interactive } = program.opts();

async function main() {
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

  const service = new ApiService({ server, agent });
  await service.connect()

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

main().catch((e) => {
  logger.debug(e)
  process.exit(-1)
})

process.on('unhandledRejection', (err) => logger.error(err))
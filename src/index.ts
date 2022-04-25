import '@parallel-finance/types';
import { Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { logger } from './logger';
import liquidationStore from './liquidationStore';
import storeFunctions from './liquidationStore/storeFunctions';
import liquidationClient from './liquidationClient';
import { scanAndStore, scanAndRefreshRedis, scanAndReturn } from './scan';
import liquidate from './liquidate';
import apiConnection from './connections/apiConnection';
import scannerClient from './scannerClient';
import redisConnection from './connections/redisConnection';

const SCAN_INTERVAL: number = 1000 * 60; // in milliseconds
const LIQUIDATE_INTERVAL: number = 1000 * 25; // in milliseconds
const LOW_REPAY_THRESHOLD = 1; //in token units
const SCANNER_INTERVAL: number = 1000 * 60 * 10; // in milliseconds

const program = new Command();

program
  .name('liquidation-client')
  .version('1.0.0.', '-v, --vers', 'output the current version')
  .option('-m, --mode <string>', 'Client mode: liquidation/scanner/print', 'liquidation')
  .option(
    '-r, --redis-endpoint <string>',
    'The Redis endpoint including host, port, db num and maybe credentials',
    'redis://127.0.0.1:6379/0'
  )
  .option('-e, --endpoint <string>', 'The Parachain API endpoint', 'ws://127.0.0.1:9948')
  .option('-s, --seed <string>', 'The account seed to use', '//Alice//stash')
  .option('-i, --interactive [boolean]', 'Input seed interactively', false)
  .option('-t, --target <string>', 'Liquidate target account');

program.parse();

const { mode, redisEndpoint, endpoint, seed, interactive, target } = program.opts();

const main = async () => {
  await cryptoWaitReady();
  switch (mode) {
    case 'liquidation': {
      logger.debug(`::endpoint::> ${endpoint}`);
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
                return seed;
              })
          : seed
      );
      const api = await apiConnection(endpoint);
      const store = liquidationStore();
      const storeFuncs = storeFunctions(store);
      const scanFunc = scanAndStore(api, storeFuncs);
      const liquidateFunc = liquidate(api, storeFuncs);

      const client = liquidationClient(scanFunc, liquidateFunc, agent, target);
      await client.start(SCAN_INTERVAL, LIQUIDATE_INTERVAL, LOW_REPAY_THRESHOLD);
      break;
    }
    case 'scanner': {
      logger.debug(`::endpoint::> ${endpoint}`);
      logger.debug(`::redis endpoint::> ${redisEndpoint}`);
      const api = await apiConnection(endpoint);
      const redisClient = await redisConnection(redisEndpoint);
      const scanFunc = scanAndRefreshRedis(api, redisClient);

      const client = scannerClient(scanFunc);
      await client.start(SCANNER_INTERVAL);
      break;
    }
    case 'print': {
      logger.debug(`::endpoint::> ${endpoint}`);
      const api = await apiConnection(endpoint);
      const scanFunc = scanAndReturn(api);
      const results = await scanFunc();
      logger.info('----------------scan result--------------');
      results.forEach((result) => {
        logger.info('----------');
        logger.info(`borrrower:    ${result.borrower}`);
        logger.info(`total loan:   $ ${result.totalLoan}`);
        logger.info(`total supply: $ ${result.totalSupply}`);
        logger.info(`shortfall:    $ ${result.shortfall}`);
      });
      logger.info('----------------end--------------');
      break;
    }
    default: {
      logger.error(`unknow mode: ${mode}`);
    }
  }
};

main().catch((e) => {
  logger.debug(e);
  process.exit(-1);
});

process.on('unhandledRejection', (err) => logger.error(err));

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

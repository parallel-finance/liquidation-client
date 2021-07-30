import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { options } from '@parallel-finance/api';
import '@parallel-finance/types';
import {
  AccountId,
  Balance,
  CurrencyId,
  FixedU128,
  Liquidity,
  Market,
  Rate,
  Shortfall,
  Deposits
} from '@parallel-finance/types/interfaces';
import { cryptoWaitReady } from '@polkadot/util-crypto';

import { BN } from '@polkadot/util';

import * as _ from 'lodash';

const { PARALLEL } = require('../config/endpoints.json');

async function scanShortfallBorrowers(api: ApiPromise): Promise<Array<AccountId>> {
  console.log('scan shortfall borrowers');

  const accountBorrows = await api.query.loans.accountBorrows.entries();
  let borrowers = accountBorrows.map(([key]) => {
    const [_, accountId] = key.args;
    return accountId;
  });
  borrowers = _.uniqWith(borrowers, _.isEqual);

  const asyncFilter = async (arr: Array<AccountId>, predicate: (a: AccountId) => Promise<boolean>) => {
    const results = await Promise.all(arr.map(predicate));
    return arr.filter((_v, index) => results[index]);
  };

  // console.log("shortfallBorrowers count", shortfallBorrowers.length);
  // console.log("borrowers count", borrowers.length);
  return await asyncFilter(borrowers, async (accountId) => {
    const accountLiquidity: [Liquidity, Shortfall] = await api.rpc.loans.getAccountLiquidity(accountId, null);
    // console.log("borrower", accountId.toHuman(), "shortfall", accountLiquidity[1].toHuman());
    return !accountLiquidity[1].toBn().isZero();
  });
}

type LiquidationParam = {
  borrower: AccountId;
  liquidateToken: CurrencyId;
  collateralToken: CurrencyId;
  repay: BN;
};

async function calcLiquidationParam(api: ApiPromise, accountId: AccountId): Promise<LiquidationParam> {
  const markets = await api.query.loans.markets.entries();
  if (markets.length == 0) {
    await Promise.reject(new Error('no markets'));
  }

  // TODO: filter the active markets
  const collateralMiscList = await Promise.all(
    markets.map(async ([key, value]) => {
      const [currencyId] = key.args;
      const market = value as unknown as Market;
      const exchangeRate = await api.query.loans.exchangeRate(currencyId);
      const price = await api.rpc.oracle.getValue('Aggregated', currencyId);
      const parsedPrices = price.unwrap();
      const deposit = await api.query.loans.accountDeposits(currencyId, accountId);
      return {
        currencyId: currencyId,
        value: deposit.voucherBalance
          .toBn()
          .mul(parsedPrices.value.toBn())
          .div(new BN('1e18'))
          .mul(exchangeRate.toBn())
          .div(new BN('1e18')),
        market: market
      };
    })
  );

  const debitMiscList = await Promise.all(
    markets.map(async ([key, value]) => {
      const [currencyId] = key.args;
      const snapshot = await api.query.loans.accountBorrows(currencyId, accountId);
      const borrowIndex = await api.query.loans.borrowIndex(currencyId);
      const price = await api.rpc.oracle.getValue('Aggregated', currencyId);
      const parsedPrices = price.unwrap();

      return {
        currencyId: currencyId,
        value: borrowIndex
          .toBn()
          .div(snapshot.borrowIndex.toBn())
          .mul(snapshot.principal)
          .div(new BN('1e18'))
          .mul(parsedPrices.value.toBn())
      };
    })
  );
  const liquidity: [Liquidity, Shortfall] = await api.rpc.loans.getAccountLiquidity(accountId, null);
  const bestCollateral = _.maxBy(collateralMiscList, (misc) => misc.value);
  if (!bestCollateral) await Promise.reject(new Error('no bestCollateral'));
  console.log('bestCollateral', JSON.stringify(bestCollateral));
  const bestDebit = _.maxBy(debitMiscList, (misc) => misc.value);
  if (!bestDebit) await Promise.reject(new Error('no bestDebit'));
  console.log('bestDebit', JSON.stringify(bestDebit));
  const repayValue = _.min([
    bestCollateral.value.mul(new BN('1e18')).div(bestCollateral.market.liquidateIncentive),
    bestDebit.value,
    liquidity[1].toBn()
  ]);
  // TODO: repay = repayValue / liquidateTokenPrice

  return {
    borrower: accountId,
    liquidateToken: bestDebit.currencyId,
    collateralToken: bestCollateral.currencyId,
    repay: repayValue
  };
}

async function main() {
  // Initialise the provider to connect to the local node
  const provider = new WsProvider(PARALLEL);

  // Create the API and wait until ready
  const api = await ApiPromise.create(options({ provider }));

  // Retrieve the chain & node information information via rpc calls
  const [chain, nodeName, nodeVersion] = await Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]);

  console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

  const shortfallBorrowers = await scanShortfallBorrowers(api);
  console.log('shortfallBorrowers count', shortfallBorrowers.length);

  const liquidationParams = await Promise.all(
    shortfallBorrowers.map(async (accountId) => {
      return await calcLiquidationParam(api, accountId);
    })
  );

  console.log('liquidationParams', liquidationParams);

  await cryptoWaitReady();

  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice', { name: 'Alice default' });
  console.log(`alice: ${alice.address}`);

  await Promise.all(
    liquidationParams.map(async (param) => {
      await api.tx.loans
        .liquidateBorrow(param.borrower, param.liquidateToken, param.repay, param.collateralToken)
        .signAndSend(alice);
    })
  );

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

main()
  .catch(console.error)
  .finally(() => process.exit());

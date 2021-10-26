import { ApiPromise, WsProvider } from '@polkadot/api';
import type { u8 } from '@polkadot/types';
import {
  AccountId,
  CurrencyId,
  Liquidity,
  Shortfall,
  Deposits,
  Market,
  Rate,
  BorrowSnapshot
} from '@parallel-finance/types/interfaces';
import { PalletAssetsAssetMetadata } from '@polkadot/types/lookup';
import { TimestampedValue } from '@open-web3/orml-types/interfaces/oracle';
import { get, maxBy, isEqual, find, uniqWith } from 'lodash';
import { BN } from '@polkadot/util';
import { KeyringPair } from '@polkadot/keyring/types';
import { options } from '@parallel-finance/api';
import { typesBundle } from '@parallel-finance/type-definitions';
import {
  ApiParam,
  ApiTask,
  LiquidationParam,
  LiquidationTask,
  OraclePrice,
  ParaCallType,
  ParaPalletType
} from './model';
import { logger } from './logger';
import setPromiseInterval from 'set-promise-interval';
import db, { Database } from './db';

const NativeCurrencyId = 0;
const BN1E18 = new BN('1000000000000000000');
const BN1E6 = new BN('1000000');

interface ApiServiceConfig {
  server: string;
  agent: KeyringPair;
}
export class ApiService {
  public paraApi!: ApiPromise;
  private server: string;
  private agent: KeyringPair;
  private LISTEN_INTERVAL: number = 1000 * 60;
  // If the repayamount is below the limit, the liquidation process will not be executed.
  private LIQUIDATE_LIMIT = 1e12;
  private db: Database;

  constructor({ server, agent }: ApiServiceConfig) {
    this.server = server;
    this.agent = agent;
    this.db = db;
  }

  public async connect(): Promise<void> {
    this.paraApi = await ApiPromise.create(
      options({
        types: {
          TAssetBalance: 'Balance'
        },
        typesBundle,
        provider: new WsProvider(this.server)
      })
    );

    // Retrieve the chain & node information information via rpc calls
    const [chain, nodeName, nodeVersion] = await Promise.all([
      this.paraApi.rpc.system.chain(),
      this.paraApi.rpc.system.name(),
      this.paraApi.rpc.system.version()
    ]);
    logger.debug(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

    await this.process();
  }

  private async signAndSendTxWithSudo(task: ApiTask) {
    const { pallet, call, params } = task;
    const api = this.paraApi;
    const tx = get(api.tx, `${pallet}.${call}`);
    if (!tx) {
      logger.error(`Invalid task: api.tx.${pallet}.${call}`);
      return;
    }

    const nonce = await api.rpc.system.accountNextIndex(this.agent.address);

    return new Promise<void>((resolve, reject) => {
      api.tx.sudo
        // eslint-disable-next-line
        .sudo((tx as any)(...params))
        .signAndSend(this.agent, { nonce }, ({ events, status }) => {
          if (status.isReady) {
            logger.debug('tx::processing');
          }
          if (status.isInBlock) {
            events.forEach(({ event: { data, method } }) => {
              if (method === 'ExtrinsicFailed') {
                api.rpc.state.getMetadata().then((metadata) => {
                  const { Module, Arithmetic } = data.toHuman()[0];
                  const { name } = Module
                    ? metadata.asV14.pallets[Module.index].errors[Module.error].toHuman()
                    : { name: Arithmetic };
                  return reject(name);
                });
                logger.debug('tx::failed');
              }

              if (method === 'ExtrinsicSuccess') {
                logger.debug('tx::succeeded');
                return resolve();
              }
            });
          }
        })
        .catch((err) => reject(err));
    });
  }

  private async sendLiquidationTx(task: LiquidationParam) {
    const apiTask = this.constructLiquidationApiTask(task);

    const { pallet, call, params } = apiTask;
    const api = this.paraApi;
    const tx = get(api.tx, `${pallet}.${call}`);
    if (!tx) {
      logger.error(`Invalid task: api.tx.${pallet}.${call}`);
      return;
    }

    const nonce = await api.rpc.system.accountNextIndex(this.agent.address);

    return new Promise<void>((resolve, reject) => {
      api.tx.loans
        .liquidateBorrow(params[0], params[1], params[2], params[3])
        .signAndSend(this.agent, { nonce }, ({ events, status }) => {
          if (status.isReady) {
            logger.debug('tx::processing');
          }
          if (status.isInBlock) {
            events.forEach(({ event: { data, method } }) => {
              if (method === 'ExtrinsicFailed') {
                logger.debug('tx::failed');
                return reject(data);
              }

              if (method === 'ExtrinsicSuccess') {
                logger.debug('tx::succeeded');
                return resolve();
              }
            });
          }
        })
        .catch(logger.error);
    });
  }

  private storeLiquidationTasks(tasks: LiquidationParam[]): void {
    if (tasks.length == 0) {
      logger.debug(`There are no tasks to store`);
      return;
    }

    logger.debug(`Scanned Liquidation tasks <-> [${tasks.length}]`);
    tasks.forEach((task) => {
      const liquidationTask: LiquidationTask = {
        borrower: task.borrower.toString(),
        liquidateToken: task.liquidateToken,
        collateralToken: task.collateralToken,
        repay: task.repay
      };
      this.db.addTask(liquidationTask);
    });
  }

  private async liquidate(borrower?: string) {
    if (this.db.enoughTask()) {
      const task = borrower ? this.db.getTaskByBorrower(borrower) : this.db.shiftLiquidationParam();
      if (!task) return;

      await this.sendLiquidationTx(task);
    } else {
      logger.debug('There are no tasks to run');
    }
  }

  public async process(): Promise<void> {
    const work = async () => {
      new Promise<LiquidationParam[]>((resolve) => {
        logger.debug(`--------------------interval--------------------`);
        const tasks = this.scanLiquidationTask();

        return resolve(tasks);
      }).then((tasks) => {
        this.storeLiquidationTasks(tasks);
        this.liquidate();
      });
    };
    setPromiseInterval(work, this.LISTEN_INTERVAL);
  }

  private constructLiquidationApiTask(task: LiquidationParam): ApiTask {
    const { borrower, liquidateToken, repay, collateralToken } = task;
    const params: ApiParam[] = [borrower, liquidateToken, repay, collateralToken];
    logger.debug(`task::handling <-> [${borrower}, ${liquidateToken}, ${repay}, ${collateralToken}]`);

    const apiTask: ApiTask = {
      pallet: ParaPalletType.Loans,
      call: ParaCallType.LiquidateBorrow,
      params: params
    };

    return apiTask;
  }

  private async getOraclePrices(api: ApiPromise): Promise<Array<OraclePrice>> {
    const marketKeys = await api.query.loans.markets.keys();
    if (marketKeys.length == 0) {
      await Promise.reject(new Error('no markets'));
    }

    return await Promise.all(
      marketKeys.map(async ({ args: [currencyId] }) => {
        const assetId = currencyId as CurrencyId;
        const price = await api.rpc.oracle.getValue('Aggregated', assetId);
        const parallelPrice = price.unwrapOrDefault() as unknown as TimestampedValue;
        const assetMeta = await api.query.assets.metadata(assetId);

        let decimal = (assetMeta as PalletAssetsAssetMetadata).decimals;
        decimal = assetId == (NativeCurrencyId as unknown as CurrencyId) ? (12 as unknown as u8) : decimal;
        return {
          currencyId: assetId.toString(),
          price: parallelPrice.value.toBn(),
          decimal
        };
      })
    );
  }

  private getUnitPrice(prices: Array<OraclePrice>, currencyId: CurrencyId): BN {
    const oraclePrice = find(prices, { currencyId: currencyId.toString() });
    return oraclePrice.price.div(new BN(10 ** +oraclePrice.decimal));
  }

  private mulPrice(value: BN, prices: Array<OraclePrice>, currencyId: CurrencyId): BN {
    const oraclePrice = find(prices, { currencyId: currencyId.toString() });
    return value.mul(new BN(10 ** +oraclePrice.decimal));
  }

  private async scanShortfallBorrowers(): Promise<Array<AccountId>> {
    logger.debug('scan shortfall borrowers');
    const borrowerKeys = await this.paraApi.query.loans.accountBorrows.keys();
    let borrowers = borrowerKeys.map(({ args: [, accountId] }) => {
      return accountId;
    });

    borrowers = uniqWith(borrowers, isEqual);

    const asyncFilter = async (arr: Array<AccountId>, predicate: (a: AccountId) => Promise<boolean>) => {
      const results = await Promise.all(arr.map(predicate));
      return arr.filter((_v, index) => results[index]);
    };

    return await asyncFilter(borrowers as AccountId[], async (accountId) => {
      const accountLiquidity: [Liquidity, Shortfall] = await this.paraApi.rpc.loans.getAccountLiquidity(
        accountId,
        null
      );
      logger.debug(`borrower: ${accountId.toHuman()}, shortfall: ${accountLiquidity[1].toHuman()}`);
      return accountLiquidity[1].toBn().cmp(new BN(0)) != 0;
    });
  }

  private async calcLiquidationParam(accountId: AccountId): Promise<LiquidationParam> {
    const api = this.paraApi;
    const markets = await api.query.loans.markets.entries();
    if (markets.length == 0) {
      await Promise.reject(new Error('no markets'));
    }

    const prices = await this.getOraclePrices(api);

    const collateralMiscList = (
      await Promise.all(
        markets.map(async ([key, market]) => {
          const [currencyId] = key.args;
          const assetId = currencyId as CurrencyId;

          const exchangeRate = await api.query.loans.exchangeRate(assetId);
          const price = this.getUnitPrice(prices, currencyId as CurrencyId);
          const deposit = (await api.query.loans.accountDeposits(assetId, accountId)) as Deposits;

          let value = new BN(0);
          if (deposit.isCollateral.isTrue) {
            value = deposit.voucherBalance
              .toBn()
              .mul(price)
              .mul(exchangeRate as Rate)
              .div(BN1E18);
          }
          return {
            currencyId: assetId,
            value,
            market: JSON.parse(market.toString()) as Market
          };
        })
      )
    ).filter((item) => {
      return item.market.state.toString() == 'Active';
    });

    const debitMiscList = (
      await Promise.all(
        markets.map(async ([key, market]) => {
          const [currencyId] = key.args;
          const assetId = currencyId as CurrencyId;

          const snapshot = (await api.query.loans.accountBorrows(currencyId, accountId)) as BorrowSnapshot;
          const borrowIndex = (await api.query.loans.borrowIndex(currencyId)) as Rate;
          const price = this.getUnitPrice(prices, assetId);

          let assetValue = new BN(0);
          if (snapshot.borrowIndex.toBn().cmp(new BN(0)) != 0) {
            assetValue = borrowIndex.div(snapshot.borrowIndex.toBn()).mul(snapshot.principal).mul(price);
          }

          return {
            currencyId: assetId,
            value: assetValue,
            market: JSON.parse(market.toString()) as Market
          };
        })
      )
    ).filter((item) => {
      return item.market.state.toString() == 'Active';
    });

    const bestCollateral: {
      currencyId: CurrencyId;
      value: BN;
      market: Market;
    } = maxBy(collateralMiscList, (misc) => misc.value.toBuffer());

    const bestDebt = maxBy(debitMiscList, (misc) => misc.value.toBuffer());
    const liquidateIncentive: BN = new BN(String(parseInt(bestCollateral.market.liquidateIncentive.toString(), 16)));
    const closeFactor: BN = new BN(bestDebt.market.closeFactor.toString());

    // Example:
    // Collateral.value = 1 KSM = 375e18
    // Debt.value = 150 HK0 * price(2) * = 300e12 * 1e18
    // repayValue = min(1.1 * Collateral, Debt * 0.5)
    const repayValue = BN.min(
      bestCollateral.value.mul(BN1E18).div(liquidateIncentive).div(BN1E6),
      bestDebt.value.mul(closeFactor).div(BN1E6).div(BN1E6)
    );
    const debtPrice = this.getUnitPrice(prices, bestDebt.currencyId).div(BN1E6);
    const repayAmount = repayValue.div(debtPrice);
    return {
      borrower: accountId,
      liquidateToken: bestDebt.currencyId,
      collateralToken: bestCollateral.currencyId,
      repay: repayAmount
    };
  }

  private async scanLiquidationTask(): Promise<LiquidationParam[]> {
    const shortfallBorrowers = await this.scanShortfallBorrowers();
    logger.debug(`shortfallBorrowers count: ${shortfallBorrowers ? shortfallBorrowers.length : 0}`);

    const liquidationParams = await Promise.all(
      shortfallBorrowers.map(async (accountId) => {
        return await this.calcLiquidationParam(accountId);
      })
    );

    const validTasks = liquidationParams.filter((param) => {
      return param.repay.cmp(new BN(this.LIQUIDATE_LIMIT)) >= 0;
    });

    const ignoreTasks = liquidationParams.length - validTasks.length;
    if (ignoreTasks) {
      logger.debug(`ignore [${ignoreTasks}] tasks with low repay amount`);
    }

    return validTasks;
  }
}

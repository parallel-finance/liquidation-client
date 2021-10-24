import { ApiPromise, Keyring, WsProvider } from '@polkadot/api';
import type { u8 } from '@polkadot/types';
import '@parallel-finance/types';
import { AccountId, CurrencyId, Liquidity, Shortfall, Deposits, Market, Rate, Ratio, BorrowSnapshot } from '@parallel-finance/types/interfaces';
import { PalletAssetsAssetMetadata } from '@polkadot/types/lookup'
import { TimestampedValue } from '@open-web3/orml-types/interfaces/oracle';
// import * as _ from 'lodash';
import { get, sum, maxBy, isEqual, find, uniqWith } from 'lodash';
import { BN } from '@polkadot/util';
import { KeyringPair } from '@polkadot/keyring/types';
import { options } from '@parallel-finance/api'
import { typesBundle } from '@parallel-finance/type-definitions'
import { ApiTask, ApiType } from './model';
import { logger } from './logger'
import setPromiseInterval from 'set-promise-interval'

const BN1E18 = new BN('1000000000000000000');
const BN1E6 = new BN('1000000');

type OraclePrice = {
  currencyId: string;
  price: BN;
  decimal: u8;
};

type LiquidationParam = {
  borrower: AccountId;
  liquidateToken: CurrencyId;
  collateralToken: CurrencyId;
  repay: BN;
};

interface ApiServiceConfig {
  server: string
  agent: KeyringPair
}
export class ApiService {
  public paraApi!: ApiPromise
  private server: string
  private agent: KeyringPair
  private LISTEN_INTERVAL: number = 5
  private killDelay: number = 1000 * 60
  private killTimer: NodeJS.Timeout | null

  constructor({ server, agent }: ApiServiceConfig) {
    this.server = server
    this.agent = agent
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
    )

    await this.process()
  }

  private async signAndSendTx(task: ApiTask) {
    const { type, pallet, call, params } = task
    const api = this.paraApi;
    const tx = get(api.tx, `${pallet}.${call}`)
    if (!tx) {
      logger.error(`Invalid task: api.tx.${pallet}.${call}`)
      return
    }

    const nonce = await api.rpc.system.accountNextIndex(this.agent.address)

    return new Promise<void>((resolve, reject) => {
      api.tx.sudo
        // eslint-disable-next-line
        .sudo((tx as any)(...params))
        .signAndSend(this.agent, { nonce }, ({ events, status }) => {
          if (status.isReady) {
            logger.debug('tx::processing')
          }
          if (status.isInBlock) {
            events.forEach(({ event: { data, method } }) => {
              if (method === 'ExtrinsicFailed') {
                api.rpc.state.getMetadata().then((metadata) => {
                  const { Module, Arithmetic } = data.toHuman()[0]
                  const { name } = Module
                    ? metadata.asV14.pallets[Module.index].errors[
                      Module.error
                    ].toHuman()
                    : { name: Arithmetic }
                  return reject(name)
                })
              }

              if (method === 'ExtrinsicSuccess') {
                logger.debug('tx::succeeded')
                return resolve()
              }
            })
          }
        })
        .catch((err) => reject(err))
    })
  }

  public async process(): Promise<void> {
    setPromiseInterval(
      async () => {
        logger.debug(`interval`)
        const tasks = await this.liquidateBorrow();
        if (tasks.length == 0) {
          logger.debug(`There is no task to be liquidated <-> [${tasks}]`)
          return
        }
        logger.debug(`Liquidation tasks <-> [${tasks}]`)

        await Promise.all(
          tasks.map(async (task) => {
            const { borrower, liquidateToken, repay, collateralToken } = task
            logger.debug(`task::handling <-> [${task}]`)
            // await api.tx.loans
            //   .liquidateBorrow(borrower, liquidateToken, repay, collateralToken)
            //   .signAndSend(signer)
            //   .catch(logger.error);
          })
        );
      },
      this.LISTEN_INTERVAL
    )
  }

  private async getOraclePrices(api: ApiPromise): Promise<Array<OraclePrice>> {
    const marketKeys = await api.query.loans.markets.keys();
    if (marketKeys.length == 0) {
      await Promise.reject(new Error('no markets'));
    }

    return await Promise.all(
      marketKeys.map(async ({ args: [currencyId] }) => {
        let assetId = currencyId as CurrencyId;
        const price = await api.rpc.oracle.getValue('Aggregated', assetId);
        const parallelPrice = price.unwrapOrDefault() as unknown as TimestampedValue;
        const assetMeta = await api.query.assets.metadata(assetId);

        let decimal = (assetMeta as PalletAssetsAssetMetadata).decimals;
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
    return oraclePrice.price.mul(BN1E18).div(new BN(10 ** + oraclePrice.decimal));
  }

  private async scanShortfallBorrowers(): Promise<Array<AccountId>> {
    console.log('scan shortfall borrowers');

    // Retrieve the chain & node information information via rpc calls
    const [chain, nodeName, nodeVersion] = await Promise.all([
      this.paraApi.rpc.system.chain(),
      this.paraApi.rpc.system.name(),
      this.paraApi.rpc.system.version()
    ]);
    console.log(`You are connected to chain ${chain} using ${nodeName} v${nodeVersion}`);

    // console.log(this.server)
    const borrowerKeys = await this.paraApi.query.loans.accountBorrows.keys();
    let borrowers = borrowerKeys.map(({ args: [_, accountId] }) => {
      return accountId;
    });

    borrowers = uniqWith(borrowers, isEqual);

    const asyncFilter = async (arr: Array<AccountId>, predicate: (a: AccountId) => Promise<boolean>) => {
      const results = await Promise.all(arr.map(predicate));
      return arr.filter((_v, index) => results[index]);
    };

    console.log("shortfallBorrowers count", borrowers.length);
    console.log("borrowers count", borrowers.length);
    return await asyncFilter(borrowers as AccountId[], async (accountId) => {
      const accountLiquidity: [Liquidity, Shortfall] = await this.paraApi.rpc.loans.getAccountLiquidity(accountId, null);
      console.log("borrower", accountId.toHuman(), "shortfall", accountLiquidity[1].toHuman());
      return !((accountLiquidity[1] as unknown as BN).isZero());
    });
  }

  private async calcLiquidationParam(accountId: AccountId): Promise<LiquidationParam> {
    const api = this.paraApi
    const markets = await api.query.loans.markets.entries();
    if (markets.length == 0) {
      await Promise.reject(new Error('no markets'));
    }

    const prices = await this.getOraclePrices(api);
    // console.log('prices', JSON.stringify(prices));

    // TODO: filter the active markets
    const collateralMiscList = await Promise.all(
      markets.map(async ([key, market], a, c) => {
        const [currencyId] = key.args;
        let assetId = currencyId as CurrencyId;
        let marketValue = market as Market;
        const exchangeRate = await api.query.loans.exchangeRate(assetId);
        const price = this.getUnitPrice(prices, currencyId as CurrencyId);
        const deposit = (await api.query.loans.accountDeposits(assetId, accountId)) as Deposits;

        let value = new BN(0);
        if (deposit.isCollateral.isTrue) {
          value = deposit.voucherBalance.toBn().mul(price).div(BN1E18).mul(exchangeRate as Rate).div(BN1E18);
        }
        return {
          currencyId: assetId,
          value,
          market: marketValue
        };
      })
    );

    const debitMiscList = await Promise.all(
      markets.map(async ([key, market]) => {
        const [currencyId] = key.args;
        let assetId = currencyId as CurrencyId;
        let marketValue = market as Market;

        const snapshot = (await api.query.loans.accountBorrows(currencyId, accountId)) as BorrowSnapshot;
        const borrowIndex = (await api.query.loans.borrowIndex(currencyId)) as Rate;
        const price = this.getUnitPrice(prices, assetId);

        let assetValue = new BN(0);
        console.log('type: ', typeof(snapshot))
        console.log('type: ', typeof(snapshot.borrowIndex))
        console.log('type: ', typeof(snapshot.borrowIndex.toBn()))
        console.log('type: ', typeof(snapshot.borrowIndex.toBn() as unknown as BN))
        if (!((snapshot.borrowIndex.toBn() as unknown as BN).isZero())) {
          assetValue = borrowIndex.div(snapshot.borrowIndex.toBn()).mul(snapshot.principal).mul(price).div(BN1E18);
          console.log(assetValue)
        }
        return {
          currencyId: assetId,
          value: assetValue,
          market: marketValue,
        };
      })
    );

    // const liquidity: [Liquidity, Shortfall] = await api.rpc.loans.getAccountLiquidity(accountId, null);
    const bestCollateral = maxBy(collateralMiscList, (misc) => misc.value.toBuffer());
    // console.log('bestCollateral', JSON.stringify(bestCollateral));
    const bestDebt = maxBy(debitMiscList, (misc) => misc.value.toBuffer());
    // console.log('bestDebt', JSON.stringify(bestDebt));

    const liquidateIncentive = (bestCollateral.market as unknown as Market).liquidateIncentive as unknown as BN;
    const closeFactor = (bestDebt.market as unknown as Market).closeFactor as unknown as BN;
    
    const repayValue = BN.min(
      bestCollateral.value.mul(new BN(BN1E18)).div(liquidateIncentive),
      bestDebt.value.mul(closeFactor).div(BN1E6)
    );

    const debtPrice = this.getUnitPrice(prices, bestDebt.currencyId);
    const repay = repayValue.mul(BN1E18).div(debtPrice);

    return {
      borrower: accountId,
      liquidateToken: bestDebt.currencyId,
      collateralToken: bestCollateral.currencyId,
      repay
    };
  }

  private async calcLiquidationParams() {
    const shortfallBorrowers = await this.scanShortfallBorrowers();

    console.log('shortfallBorrowers count', shortfallBorrowers.length);
    console.log('shortfallBorrowers: \n', shortfallBorrowers);

    return await Promise.all(
      shortfallBorrowers.map(async (accountId) => {
        return await this.calcLiquidationParam(accountId);
      })
    );
  }

  private async liquidateBorrow() {
    const liquidationParams = await this.calcLiquidationParams();

    liquidationParams.forEach((param) => {
      console.log('borrower', param.borrower.toHuman());
      console.log('liquidateToken', param.liquidateToken.toHuman());
      console.log('collateralToken', param.collateralToken.toHuman());
      console.log('repay', param.repay.toString());
    });

    return liquidationParams
  }
}
import { ApiPromise } from '@polkadot/api';
import { CurrencyId, Rate } from '@parallel-finance/types/interfaces';
import { u32 } from '@polkadot/types';
import { BN } from '@polkadot/util';
import { maxBy, find } from 'lodash';
import { Liquidation, OraclePrice } from '../types';
import { StorageKey } from '@polkadot/types';

const BN18 = new BN(10).pow(new BN(18));
const BN6 = new BN(10).pow(new BN(6));

const generateLiquidation =
  (api: ApiPromise) =>
  async (borrower: string): Promise<Liquidation> => {
    const markets = await api.query.loans.markets.entries();
    if (markets.length == 0) {
      await Promise.reject(new Error('no markets'));
    }
    const prices = await getOraclePrices(
      api,
      markets.map(([key]) => key)
    );
    const getMiscList = async (generateValue: (assetId: CurrencyId, price: BN) => Promise<BN>) =>
      (
        await Promise.all(
          markets.map(async ([key, market]) => {
            const [currencyId] = key.args;
            const assetId = currencyId as CurrencyId;
            const [price, decimal] = getUnitPrice(prices, assetId);
            return {
              currencyId: assetId,
              value: await generateValue(assetId, price),
              market: market.unwrap(),
              decimal
            };
          })
        )
      ).filter((item) => item.market.state.toString() === 'Active');
    const collateralMiscList = await getMiscList(async (assetId, price) => {
      const exchangeRate = await api.query.loans.exchangeRate(assetId);
      const deposit = await api.query.loans.accountDeposits(assetId, borrower);
      return deposit.isCollateral.isTrue
        ? deposit.voucherBalance
            .toBn()
            .mul(price)
            .mul(exchangeRate as Rate)
            .div(BN18)
        : new BN(0);
    });
    const debitMiscList = await getMiscList(async (assetId, price) => {
      const snapshot = await api.query.loans.accountBorrows(assetId, borrower);
      const borrowIndex = await api.query.loans.borrowIndex(assetId);
      return snapshot.borrowIndex.toBn().cmp(new BN(0)) !== 0
        ? borrowIndex.div(snapshot.borrowIndex.toBn()).mul(snapshot.principal).mul(price)
        : new BN(0);
    });

    const bestCollateral = maxBy(collateralMiscList, (misc) => misc.value.toBuffer());
    const bestDebt = maxBy(debitMiscList, (misc) => misc.value.toBuffer());
    const liquidateIncentive: BN = bestCollateral.market.liquidateIncentive.toBn();
    const closeFactor: BN = bestDebt.market.closeFactor.toBn();

    const repayValue = BN.min(
      bestCollateral.value.mul(liquidateIncentive).div(BN18),
      bestDebt.value.mul(closeFactor).div(BN6)
    );
    const [debtPrice] = getUnitPrice(prices, bestDebt.currencyId);
    const repayAmount = repayValue.div(debtPrice);
    return {
      borrower,
      liquidateToken: bestDebt.currencyId,
      collateralToken: bestCollateral.currencyId,
      repay: repayAmount,
      repayDecimal: bestDebt.decimal
    };
  };

const getOraclePrices = async (api: ApiPromise, marketKeys: StorageKey<[u32]>[]): Promise<OraclePrice[]> =>
  Promise.all(
    marketKeys.map(async ({ args: [currencyId] }) => {
      const assetId = currencyId as CurrencyId;
      const price = await api.rpc.oracle.getValue('Aggregated', assetId);
      const parallelPrice = price.unwrapOrDefault();
      const assetMeta = await api.query.assets.metadata(assetId);
      const decimal = ['0', '1'].includes(assetId.toString()) ? new BN(12) : assetMeta.decimals.toBn();
      return {
        currencyId: assetId,
        price: parallelPrice.value.toBn(),
        decimal
      };
    })
  );

const getUnitPrice = (prices: OraclePrice[], currencyId: CurrencyId): [BN, BN] => {
  const oraclePrice = find(prices, { currencyId });
  return [oraclePrice.price.div(new BN(10).pow(oraclePrice.decimal)), oraclePrice.decimal];
};

export default generateLiquidation;

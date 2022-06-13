import { ApiPromise } from '@polkadot/api';
import { LiquidationInfo } from '../types';
import { CurrencyId, Rate } from '@parallel-finance/types/interfaces';
import { u32 } from '@polkadot/types';
import { BN } from '@polkadot/util';
import { find } from 'lodash';
import { OraclePrice } from '../types';
import { StorageKey, Vec } from '@polkadot/types';
import { PERCENTAGE_DECIMAL, RATE_DECIMAL } from '../constants';

const calculateLiquidationInfo =
  (api: ApiPromise) =>
  async (borrower: string): Promise<LiquidationInfo> => {
    const markets = await api.query.loans.markets.entries();

    const [, , , lfShortfall] = await api.rpc.loans.getLiquidationThresholdLiquidity(borrower);
    const lfAsset = api.consts.loans.liquidationFreeAssetId as CurrencyId;
    const lfCollateral = (await api.query.loans.liquidationFreeCollaterals()) as Vec<CurrencyId>;

    if (markets.length == 0) {
      await Promise.reject(new Error('no markets'));
    }
    const prices = await getOraclePrices(
      api,
      markets.map(([key]) => key)
    );
    const getMiscList = async (generateValue: (assetId: CurrencyId, price: BN, market) => Promise<BN>) =>
      (
        await Promise.all(
          markets.map(async ([key, market]) => {
            const unwrapped = market.unwrap();
            const [currencyId] = key.args;
            const assetId = currencyId as CurrencyId;
            const [price, decimal] = getUnitPrice(prices, assetId);
            return {
              currencyId: assetId,
              value: await generateValue(assetId, price, unwrapped),
              liquidateIncentive: unwrapped.liquidateIncentive.toBn(),
              closeFactor: unwrapped.closeFactor.toBn(),
              state: unwrapped.state,
              price,
              decimal
            };
          })
        )
      ).filter((item) => item.state.toString() === 'Active');

    const supplies = await getMiscList(async (assetId, price, market) => {
      if (!!lfCollateral.toArray().find((e) => e.toBn().eq(assetId.toBn()))) {
        return new BN(0);
      }
      const exchangeRate = await api.query.loans.exchangeRate(assetId);
      const deposit = await api.query.loans.accountDeposits(assetId, borrower);
      return deposit.isCollateral.isTrue
        ? deposit.voucherBalance
            .toBn()
            .mul(price)
            .mul(exchangeRate as Rate)
            .div(RATE_DECIMAL)
        : new BN(0);
    });
    const loans = await getMiscList(async (assetId, price) => {
      if (assetId.toBn().eq(lfAsset.toBn())) {
        return lfShortfall.toBn();
      }
      const snapshot = await api.query.loans.accountBorrows(assetId, borrower);
      const borrowIndex = await api.query.loans.borrowIndex(assetId);
      return snapshot.borrowIndex.toBn().cmp(new BN(0)) !== 0
        ? borrowIndex.div(snapshot.borrowIndex.toBn()).mul(snapshot.principal).mul(price)
        : new BN(0);
    });

    return { supplies, loans };
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

export default calculateLiquidationInfo;

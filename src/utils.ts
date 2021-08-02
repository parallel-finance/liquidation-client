import * as _ from 'lodash';
const decimals = require('../config/decimal.json');

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('');
    }, ms);
  });
}

export const getCurrencyDecimal = (currency) => _.get(decimals, currency, NaN);

export const computeUniPrices = (currencies, prices) => {
  const unitPrices = prices.map(
    ({ value: { price, decimal } }, index) => ((+price / 1e18) * getCurrencyDecimal(currencies[index])) / 10 ** +decimal
  );
  return _.zipObject(currencies, unitPrices);
};

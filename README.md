## Parallel Money Market Liquidation Client

### Montivation
We need to liquidate the borrower who has a shortfall in time, so we will build this service to scan the underwater accounts and liquidate the borrow for them.

### Suggested Solution

We need several different executors running on the different threads.
- A borrower scanner is used to scan the `AccountBorrows` of each active market and get the `(liquidity, shortfall)` of each borrower by using JSON-RPC [loans_getAccountLiquidity](https://github.com/parallel-finance/parallel/issues/273).
- Put the borrower who has a positive shortfall into the liquidation event queue.
- A liquidation executor will be triggered by the event emitted from the previous step. Get the latest `(liquidity, shortfall)` info and decide the liquidate token, collateral token, the repay amount.
- sign and send the `liquidate_borrow` call.

### Run
```
yarn 
yarn start
```

### Test
```
yarn test
```

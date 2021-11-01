## Parallel Money Market Liquidation Client

### Montivation
We need to liquidate the borrower who has a shortfall in time, so we will build this service to scan the underwater accounts and liquidate the borrow for them.

### Features

- 🤖️ Fully automated liquidation after startup
- 💰 Compute repay amounts atomically on-chain
- ⛳️ Support for liquidate specific account
- 🧰 Local storage of liquidation queue

### Current Solution

We need several different executors running on the different threads.
- Fetch accounts from Parallel's API every `N` minutes and store the accounts to be liquidated.

  > A borrower scanner is used to scan the `AccountBorrows` of each active market and get the `(liquidity, shortfall)` of each borrower by using JSON-RPC [loans_getAccountLiquidity](https://github.com/parallel-finance/parallel/issues/273). Put the borrower who has a positive shortfall into the liquidation message queue, which in this case is a single file db.

- Get accounts from liquidation queue every `N` minutes and send `liquidate_borrow` call.

  > A liquidation executor will periodically fetch tasks from the task queue, get the latest `(liquidity, shortfall)` info and decide the liquidate token, collateral token, the repay amount, and send [liquidate_borrow](https://api-docs.parallel.fi/pallet_loans/pallet/enum.Call.html#variant.liquidate_borrow) call.

### Introduction

> If you're planning to use this code, you should know this stuff already. 

The Dapp allows users to supply and borrow crypto tokens (e.g. KSM, XKSM, USDT). Suppliers earn interest, while borrowers pay interest. But if the value of assets **deposited** by the user are lower than the **borrowed** assets, then there will be a situation that needs to be liquidated.

For example, suppose Bob believes that KSM's price will fall soon. Bob can supply USDT to Parallel, borrow an amount of KSM worth less than `collateralFactor * valueOfSuppliedUSDT`, and trade that borrowed KSM for more USDT. If Bob's belief comes true, he'll be able to re-trade the USDT for KSM and pay off his loan with some USDT left over.

If, on the other hand, Bob is wrong -- the price of KSM rises -- then Bob is in trouble. In this situation, the value of his borrowed KSM may grow to exceed the `collateralFactor * valueOfSuppliedUSDT`. If Bob fails to pay off his loan before this happens, then Bob is subject to liquidation.



For more introductory information, see [Parallel's website](https://parallel.fi) and for a deep dive into transaction dynamics read [this paper](https://docs.parallel.fi/white-paper).

### Run Liquidation Client

```shell
# Install dependencies
yarn

# startup and input seed interactively
yarn start -i true -e "wss://parallel-heiko.api.onfinality.io/public-ws"
```

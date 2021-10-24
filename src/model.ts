import { EraIndex, RewardDestination } from '@polkadot/types/interfaces'
import BN from 'bn.js'
import { AnyJson } from '@polkadot/types/types'
import { AccountId } from '@parallel-finance/types/interfaces'

export enum ParaPalletType {
    Loans = 'loans'
}


export enum ParaCallType {
  LiquidateBorrow = "liquidateBorrow"
}

export type ApiParam =
  | AccountId
  | number
  | string
  | BN
  | EraIndex
  | RewardDestination
  | AnyJson


export type ApiTask = {
    pallet: ParaPalletType
    call: ParaCallType
    params: ApiParam[]
}
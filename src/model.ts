import { EraIndex, RewardDestination } from '@polkadot/types/interfaces'
import BN from 'bn.js'
import { AnyJson } from '@polkadot/types/types'

export enum ApiType {
    PARA = 'PARA'
}

export enum ParaPalletType {
    Loans = 'loans'
}

export enum ParaCallType {
    Loans = 'liquidateBorrow'
}

export type ApiParam =
  | number
  | string
  | BN
  | EraIndex
  | RewardDestination
  | AnyJson


export type ApiTask = {
    type: ApiType
    pallet: ParaPalletType
    call: ParaCallType
    params: ApiParam[]
}
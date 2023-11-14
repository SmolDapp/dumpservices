import {encodeFunctionData} from 'viem';
import {erc20ABI} from 'wagmi';

import {COWSWAP_SETTLEMENT_ABI} from './abi/cowswapSettlement.abi';

import type {Hex} from 'viem';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {BaseTransaction} from '@gnosis.pm/safe-apps-sdk';

export function getApproveTransaction(amount: bigint, token: TAddress, spender: TAddress): BaseTransaction {
	return {
		to: token,
		value: '0',
		data: encodeFunctionData({abi: erc20ABI, functionName: 'approve', args: [spender, amount]})
	};
}
export function getSetPreSignatureTransaction(contract: TAddress, orderUID: Hex, signed: boolean): BaseTransaction {
	return {
		to: contract,
		value: '0',
		data: encodeFunctionData({
			abi: COWSWAP_SETTLEMENT_ABI,
			functionName: 'setPreSignature',
			args: [orderUID, signed]
		})
	};
}

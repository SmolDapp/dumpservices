import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {EcdsaSigningScheme, OrderQuoteResponse} from '@cowprotocol/cow-sdk';

// eslint-disable-next-line @typescript-eslint/naming-convention
export type Maybe<T> = T | null | undefined;

export type TPossibleStatus = 'pending' | 'expired' | 'fulfilled' | 'cancelled' | 'invalid'
export type TPossibleFlowStep = 'valid' | 'invalid' | 'pending' | 'undetermined';

export type TToken = {
	label: string;
	symbol: string;
	decimals: number;
	value: string;
	icon?: ReactElement;
}

export type TInitSolverArgs = {
	from: TAddress,
	receiver: TAddress,
	inputToken: TToken
	outputToken: TToken
	inputAmount: BigNumber
}

export type TOrderQuoteResponse = OrderQuoteResponse & {
	signature: string;
	signingScheme: EcdsaSigningScheme;
	request: TInitSolverArgs,
	buyAmountWithSlippage?: string,
	orderUID?: string,
	orderStatus?: TPossibleStatus,
	orderError?: unknown
	isRefreshing?: boolean,
	expirationTimestamp?: number,
}

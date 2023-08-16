import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
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
	inputAmount: bigint
}

export type TCowswapOrderQuoteResponse = OrderQuoteResponse & {
	solverType: 'COWSWAP';
	signature: string;
	signingScheme: EcdsaSigningScheme;
	request: TInitSolverArgs;
	buyAmountWithSlippage?: string;
	orderUID?: string;
	orderStatus?: TPossibleStatus;
	orderError?: unknown;
	isRefreshing?: boolean;
	expirationTimestamp?: number;
}

export type TBebopToken = {
	amount: string;
	amountUsd: number;
	contractAddress: TAddress;
	priceUsd: number;
	decimals: number;
}

export type TBebopOrderQuoteResponse = {
	solverType: 'BEBOP';
	status: string;
	type: string;
	quoteId: string;
	chainId: number;
	receiver: TAddress
	expiry: number;
	buyTokens: TDict<TBebopToken>
	sellTokens: TDict<TBebopToken>
	toSign: {
		expiry: number;
		taker_address: TAddress;
		maker_addresses: TAddress[];
		maker_nonces: number[];
		taker_tokens: TAddress[][];
		maker_tokens: TAddress[][];
		taker_amounts: string[][];
		maker_amounts: string[][];
		receiver: TAddress;
	}
}

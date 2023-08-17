import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {EcdsaSigningScheme, OrderQuoteResponse} from '@cowprotocol/cow-sdk';

// eslint-disable-next-line @typescript-eslint/naming-convention
export type Maybe<T> = T | null | undefined;

export enum TPossibleStatus {
	INVALID = 'invalid',
	PENDING = 'pending',

	//COWSWAP specific status
	COWSWAP_EXPIRED = 'cowswap_expired',
	COWSWAP_FULFILLED = 'cowswap_fulfilled',
	COWSWAP_CANCELLED = 'cowswap_cancelled',

	//BEBOP specific status
	BEBOP_CONFIRMED = 'bebop_confirmed',
	BEBOP_FAILED = 'bebop_failed'
}

export enum TPossibleFlowStep {
	VALID = 'valid',
	INVALID = 'invalid',
	PENDING = 'pending',
	UNDETERMINED = 'undetermined'
}

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
	// quote: OrderParameters;
	// from?: TAddress;
	// expiration: string;
	// id?: number;
	signature: string;
	signingScheme: EcdsaSigningScheme;
	request: TInitSolverArgs;
	buyAmountWithSlippage?: string;

	// Used for the UI, not part of the quote nor returned by the API
	orderUID?: string; // Unique identifier for the order on cowswap system
	orderStatus?: TPossibleStatus;
	orderError?: unknown;
	isRefreshing?: boolean;
	expirationTimestamp?: number;
}

export type TCowQuoteError = {
	solverType: 'COWSWAP';
	description: string,
	errorType: string,
	data: {fee_amount: string}
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
	id: string; //quoteId -> id
	chainId: number;
	receiver: TAddress
	expirationTimestamp: number; // expirity -> expirationTimestamp
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
	},

	// Used for the UI, not part of the quote nor returned by the API
	orderStatus?: TPossibleStatus;
	orderUID?: string; // Match the hash of the TX that created the order
	primaryBuyToken: TBebopToken;
}


export type TBebopOrderQuoteError = {
	solverType: 'BEBOP';
	error: {
		errorCode: number,
		message: string
	}
}

export type TOrderQuote = TCowswapOrderQuoteResponse | TBebopOrderQuoteResponse
export type TOrderQuoteError = TCowQuoteError | TBebopOrderQuoteError

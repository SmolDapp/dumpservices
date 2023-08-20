import type {ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
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
export type TTokenAmount = TToken & {
	amount: TNormalizedBN,
	amountWithSlippage?: string,
}

export type TInitSolverArgs = {
	from: TAddress,
	receiver: TAddress,
	inputTokens: TToken[]
	outputToken: TToken
	inputAmounts: bigint[]
}

export type TRequestMetadata = {
	orderUID: string; // Unique identifier for the order on cowswap system
	orderStatus: TPossibleStatus;
	orderError: unknown | undefined;
	isRefreshing: boolean;
	expirationTimestamp: number;
}
export type TCowswapOrderQuoteResponse = OrderQuoteResponse & {
	validTo: number;
	signature: string;
	signingScheme: EcdsaSigningScheme;
	buyAmountWithSlippage?: string;
	buyToken: TToken;
	sellToken: TToken;
} & TRequestMetadata

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
	status: string;
	type: string;
	id: string; //quoteId -> id
	chainId: number;
	receiver: TAddress
	expirationTimestamp: number; // expirity -> expirationTimestamp
	buyTokens: TDict<TTokenAmount>
	sellTokens: TDict<TTokenAmount>
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
} & TRequestMetadata

export type TBebopOrderQuoteError = {
	solverType: 'BEBOP';
	error: {
		errorCode: number,
		message: string
	}
}

// export type TSolverQuote = TCowswapOrderQuoteResponse | TBebopOrderQuoteResponse
export type TSolverQuote = { //TODO: Renamte TRequest
	solverType: 'COWSWAP' | 'BEBOP';
	buyToken: TToken; // token we want to receive
	sellTokens: TDict<TTokenAmount>; // address -> TTokenAmount

	quote: TDict<TPossibleSolverQuote>;
}
export type TPossibleSolverQuote = TCowswapOrderQuoteResponse | TBebopOrderQuoteResponse
export type TOrderQuoteError = TCowQuoteError | TBebopOrderQuoteError

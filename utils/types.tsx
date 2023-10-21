import {zeroAddress} from '@yearn-finance/web-lib/utils/address';

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

export enum TStatus {
	VALID = 'valid',
	INVALID = 'invalid',
	PENDING = 'pending',
	UNDETERMINED = 'undetermined'
}

export type TToken = {
	address: TAddress;
	name: string;
	symbol: string;
	decimals: number;
	chainId: number;
	logoURI?: string;
	extra?: boolean;
};
export const defaultTToken: TToken = {
	address: zeroAddress,
	name: '',
	symbol: '',
	decimals: 18,
	chainId: 1
};

export type TTokenWithAmount = TToken & {
	amount: TNormalizedBN;
	amountWithSlippage?: TNormalizedBN;
};

export type TRequestArgs = {
	from: TAddress;
	receiver: TAddress;
	inputTokens: TToken[];
	outputToken: TToken;
	inputAmounts: bigint[];
	inputBalances: bigint[];
};

export type TRequestMetadata = {
	orderUID: string; // Unique identifier for the order on cowswap system
	orderStatus: TPossibleStatus;
	orderError: unknown | undefined;
	isRefreshing: boolean;
	isFetching?: boolean;
	expirationTimestamp: number;
	buyToken: TToken;
	sellToken: TToken;
};
export type TCowswapOrderQuoteResponse = OrderQuoteResponse & {
	validTo: number;
	signature: string;
	signingScheme: EcdsaSigningScheme;
	buyAmountWithSlippage?: bigint;
} & TRequestMetadata;

export type TCowQuoteError = {
	solverType: 'COWSWAP';
	message: string;
	shouldDisable: boolean;
	body: {
		description: string;
		errorType: string;
		data: {fee_amount: string};
	};
};

export type TBebopToken = {
	amount: string;
	amountUsd: number;
	contractAddress: TAddress;
	priceUsd: number;
	decimals: number;
	rate: number;
};

export type TBebopQuoteAPIResp = {
	status: string;
	type: string;
	chainId: number;
	quoteId: string;
	receiver: TAddress;
	from: TAddress;
	expiry: number;
	buyTokens: TDict<TBebopToken>;
	sellTokens: TDict<TBebopToken>;
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
	};
};

export type TBebopOrderQuoteResponse = {
	id: string;
	status: string;
	type: string;
	chainId: number;
	receiver: TAddress;
	from: TAddress;
	expirationTimestamp: number;
	buyToken: TTokenWithAmount;
	sellToken: TTokenWithAmount;
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
	};
} & TRequestMetadata;

export type TBebopOrderQuoteError = {
	solverType: 'BEBOP';
	message: string;
	shouldDisable: boolean;
	error: {
		errorCode: number;
		message: string;
	};
};

export type TRequest = {
	solverType: 'COWSWAP' | 'BEBOP';
	buyToken: TToken; // token we want to receive
	sellTokens: TDict<TTokenWithAmount>; // address -> TTokenWithAmount

	quote: TDict<TPossibleSolverQuote>;
	bebopAggregatedQuote?: TBebopQuoteAPIResp;
};
export type TPossibleSolverQuote = TCowswapOrderQuoteResponse | TBebopOrderQuoteResponse;
export type TOrderQuoteError = TCowQuoteError | TBebopOrderQuoteError;

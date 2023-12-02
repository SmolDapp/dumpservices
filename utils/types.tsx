import {zeroAddress} from '@yearn-finance/web-lib/utils/address';

import type {Hex} from 'viem';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {EcdsaSigningScheme, OrderQuoteResponse} from '@cowprotocol/cow-sdk';

// eslint-disable-next-line @typescript-eslint/naming-convention
export type Maybe<T> = T | null | undefined;

export enum TPossibleStatus {
	NOT_STARTED = 'not_started',

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
	buyToken: TTokenWithAmount;
	sellToken: TTokenWithAmount;
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

export type TBebopJamQuoteAPIResp = {
	type: string;
	status: string;
	quoteId: string;
	chainId: number;
	approvalType: string;
	nativeToken: string;
	taker: string;
	receiver: string;
	isNewReceiver: boolean;
	expiry: number;
	gasFee: {
		native: string;
		usd: number;
	};
	buyTokens: TDict<{
		amount: string;
		decimals: number;
		priceUsd: number;
		symbol: string;
		price: number;
		priceBeforeFee: number;
		amountBeforeFee: string;
	}>;
	sellTokens: TDict<{
		amount: string;
		decimals: number;
		priceUsd: number;
		symbol: string;
		price: number;
		priceBeforeFee: number;
		amountBeforeFee: string;
	}>;
	settlementAddress: string;
	approvalTarget: string;
	requiredSignatures: unknown[];
	hooksHash: string;
	toSign: {
		taker: string;
		receiver: string;
		expiry: number;
		nonce: string;
		executor: string;
		minFillPercent: number;
		hooksHash: string;
		sellTokens: string[];
		buyTokens: string[];
		sellAmounts: string[];
		buyAmounts: string[];
		sellTokenTransfers: string;
		buyTokenTransfers: string;
	};
	solver: string;
	//Override for dump
	isSigned: boolean;
	isSigning: boolean;
	hasSignatureError: boolean;
	signature: Hex;
	isExecuted: boolean;
	isExecuting: boolean;
	hasExecutionError: boolean;
	txHash: Hex;
};
export type TBebopJamOrderStatusAPIResp = {
	status: 'string';
	txHash: Hex;
	amounts: number;
};

export type TBebopOrderQuoteResponse = {
	id: string;
	status: string;
	signature: string;
	type: string;
	chainId: number;
	receiver: TAddress;
	from: TAddress;
	expirationTimestamp: number;
	toSign: {
		taker: string;
		receiver: string;
		expiry: number;
		nonce: string;
		executor: string;
		minFillPercent: number;
		hooksHash: string;
		sellTokens: string[];
		buyTokens: string[];
		sellAmounts: string[];
		buyAmounts: string[];
		sellTokenTransfers: string;
		buyTokenTransfers: string;
	};
	//Override for dump
	isSigned: boolean;
	isSigning: boolean;
	hasSignatureError: boolean;
	isExecuted: boolean;
	isExecuting: boolean;
	hasExecutionError: boolean;
	txHash: Hex;
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

export type TCowswapRequest = {
	solverType: 'COWSWAP';
	quote: TDict<TCowswapOrderQuoteResponse>;
	buyToken: TToken; // token we want to receive
};
export type TBebopRequest = {
	solverType: 'BEBOP';
	quote: TBebopOrderQuoteResponse;
	buyTokens: TDict<TTokenWithAmount>; // tokens, where the key is the address of the token we send for it
	lastUpdate: Date;
};
export type TRequest = {
	sellTokens: TDict<TTokenWithAmount>; // address -> TTokenWithAmount
} & (TCowswapRequest | TBebopRequest);
export type TOrderQuoteError = TCowQuoteError | TBebopOrderQuoteError;

export type TQuote = TRequest & (TBebopRequest | TCowswapRequest);

export type TGetQuote = {
	quoteResponse?: TRequest;
	feeAmount?: bigint;
	error?: TOrderQuoteError;
};

export type TRetreiveCowQuote = {
	sellToken: TAddress;
	buyToken: TToken;
	from: TAddress;
	receiver: TAddress;
	amount: TNormalizedBN;
	isWalletSafe: boolean;
};

export type TRetreiveBebopQuote = {
	sellTokens: TAddress[];
	buyToken: TToken;
	from: TAddress;
	receiver: TAddress;
	amounts: TNormalizedBN[];
	isWalletSafe: boolean;
};

export type TSignQuoteFromCowswap = {
	quoteOrder: TCowswapOrderQuoteResponse;
	safeChainID: number;
	amountWithSlippage: bigint;
};

export type TBebopPostOrder = {txHash: Hex; status: string; expiry: number};

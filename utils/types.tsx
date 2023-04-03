import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {EcdsaSigningScheme, OrderQuoteResponse, SigningResult} from '@cowprotocol/cow-sdk';

// eslint-disable-next-line @typescript-eslint/naming-convention
export type Maybe<T> = T | null | undefined;

export type TPossibleStatus = 'pending' | 'expired' | 'fulfilled' | 'cancelled' | 'invalid'

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
	orderUID?: string,
	orderStatus?: TPossibleStatus,
}

export type TSolverContext = {
	init: (args: TInitSolverArgs) => Promise<[TNormalizedBN, Maybe<TOrderQuoteResponse>, boolean, Maybe<Error>]>;
	signCowswapOrder: (quote: TOrderQuoteResponse) => Promise<SigningResult>;
	execute: (quoteOrder: TOrderQuoteResponse, shouldUsePresign: boolean, onSubmitted: (orderUID: string) => void) => Promise<TPossibleStatus>;
}

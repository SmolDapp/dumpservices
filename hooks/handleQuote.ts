/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {TPossibleStatus} from 'utils/types';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {isBebopOrder, isCowswapOrder} from './assertSolver';

import type {Maybe, TPossibleSolverQuote, TRequest, TRequestArgs, TTokenWithAmount} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {EcdsaSigningScheme} from '@cowprotocol/cow-sdk';

/* 🥟 - Dump Services **********************************************************
 ** refreshQuote will simulate a click on the refresh button of a quote.
 ** This hack is used to trigger a specific action on a button out of the current
 ** state or context, allowing us to bypass the dom tree.
 ******************************************************************************/
export function refreshQuote(key: TAddress): void {
	setTimeout((): void => {
		document?.getElementById(`quote-refresh-${key}`)?.click();
	}, 10);
}

/* 🥟 - Dump Services **********************************************************
 ** resetQuote will simulate a click on the reset button of a quote.
 ** This hack is used to trigger a specific action on a button out of the current
 ** state or context, allowing us to bypass the dom tree.
 ******************************************************************************/
export function resetQuote(key: TAddress): void {
	setTimeout((): void => {
		document?.getElementById(`quote-reset-${key}`)?.click();
	}, 10);
}

/* 🥟 - Dump Services **********************************************************
 ** initQuote will add a quote to the current state of quotes, but this quote
 ** will be empty, except from a status of 'pending'.
 ******************************************************************************/
export function initQuote(
	prev: Maybe<TRequest>,
	key: TAddress,
	args: TRequestArgs,
	solver: 'COWSWAP' | 'BEBOP'
): Maybe<TRequest> {
	if (!prev) {
		return {
			buyToken: {
				address: args.outputToken.address,
				decimals: args.outputToken.decimals,
				symbol: args.outputToken.symbol,
				name: args.outputToken.name,
				chainId: args.outputToken.chainId
			},
			sellTokens: {
				[args.inputTokens[0].address]: {
					address: args.inputTokens[0].address,
					decimals: args.inputTokens[0].decimals,
					symbol: args.inputTokens[0].symbol,
					name: args.inputTokens[0].name,
					chainId: args.inputTokens[0].chainId,
					amount: toNormalizedBN(0)
				}
			},
			bebopAggregatedQuote: undefined,
			solverType: solver,
			quote: {
				[key]: {
					isFetching: true,
					sellToken: {
						address: args.inputTokens[0].address,
						decimals: args.inputTokens[0].decimals,
						symbol: args.inputTokens[0].symbol,
						name: args.inputTokens[0].name,
						amount: toNormalizedBN(0)
					},
					buyToken: {
						address: args.outputToken.address,
						decimals: args.outputToken.decimals,
						symbol: args.outputToken.symbol,
						name: args.outputToken.name,
						amount: toNormalizedBN(0)
					}
				}
			} as TDict<TPossibleSolverQuote>
		};
	}
	return {
		...prev,
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
		quote: {
			...prev.quote,
			[key]: {
				...prev.quote[key],
				sellToken: prev?.quote?.[key]?.sellToken || {
					address: args.inputTokens[0].address,
					decimals: args.inputTokens[0].decimals,
					symbol: args.inputTokens[0].symbol,
					name: args.inputTokens[0].name,
					amount: toNormalizedBN(0)
				},
				buyToken: prev?.quote?.[key]?.buyToken || {
					address: args.outputToken.address,
					decimals: args.outputToken.decimals,
					symbol: args.outputToken.symbol,
					name: args.outputToken.name,
					amount: toNormalizedBN(0)
				},
				isFetching: true
			}
		} as TDict<TPossibleSolverQuote>
	};
}

/* 🥟 - Dump Services **********************************************************
 ** addQuote will add a quote to the current state of quotes, by updating the
 ** quote and sellTokens objects with the one provided.
 ******************************************************************************/
export function addQuote(prev: Maybe<TRequest>, quote: TRequest): Maybe<TRequest> {
	if (!prev) {
		return quote;
	}

	const updatedQuote: TDict<TPossibleSolverQuote> = prev.quote;
	const newQuote: TDict<TPossibleSolverQuote> = quote.quote;
	for (const [key, item] of Object.entries(newQuote)) {
		updatedQuote[key] = item;
	}
	const updatedSellTokens: TDict<TTokenWithAmount> = prev.sellTokens;
	const newSellTokens: TDict<TTokenWithAmount> = quote.sellTokens;
	for (const [key, item] of Object.entries(newSellTokens)) {
		updatedSellTokens[key] = item;
	}

	return {
		...prev,
		quote: updatedQuote,
		sellTokens: updatedSellTokens
	};
}

/* 🥟 - Dump Services **********************************************************
 ** deleteQuote will remove a quote from the current state of quotes, by removing
 ** them from the quote and sellTokens objects.
 ******************************************************************************/
export function deleteQuote(quotes: Maybe<TRequest>, key: TAddress): Maybe<TRequest> {
	if (!quotes) {
		return undefined;
	}
	const quoteItems = {...quotes.quote};
	const sellTokens = {...quotes.sellTokens};
	delete quoteItems[key];
	delete sellTokens[key];

	return {
		...quotes,
		quote: quoteItems,
		sellTokens
	};
}

/* 🥟 - Dump Services **********************************************************
 ** assignSignature will add a signature to the current state of a given quote.
 ******************************************************************************/
export function assignSignature(
	quotes: Maybe<TRequest>,
	key: TAddress,
	signature: string,
	signingScheme: EcdsaSigningScheme
): Maybe<TRequest> {
	if (!quotes) {
		return undefined;
	}

	if (isCowswapOrder(quotes)) {
		const quoteItems = {...quotes.quote};
		quoteItems[key].signature = signature;
		quoteItems[key].signingScheme = signingScheme;
		return {
			...quotes,
			quote: quoteItems
		};
	}
	if (isBebopOrder(quotes)) {
		const quoteItems = {...quotes.quote};
		quoteItems[key].signature = signature;
		return {
			...quotes,
			quote: quoteItems
		};
	}
	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setPendingQuote will set a quote as pending, by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setPendingQuote(quotes: Maybe<TRequest>, key: TAddress, orderUID: string): Maybe<TRequest> {
	if (!quotes) {
		return undefined;
	}

	const quoteItems = {...quotes.quote};
	quoteItems[key].orderUID = orderUID;
	quoteItems[key].orderStatus = TPossibleStatus.PENDING;
	return {
		...quotes,
		quote: quoteItems
	};
}

/* 🥟 - Dump Services **********************************************************
 ** setRefreshingQuote will set a quote as refreshing, by updating isRefreshing
 ******************************************************************************/
export function setRefreshingQuote(quotes: Maybe<TRequest>, key: TAddress): Maybe<TRequest> {
	if (!quotes) {
		return undefined;
	}

	const quoteItems = {...quotes.quote};
	quoteItems[key].isRefreshing = true;
	return {
		...quotes,
		quote: quoteItems
	};
}

/* 🥟 - Dump Services **********************************************************
 ** setInvalidQuote will set a quote as invalid, by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setInvalidQuote(quotes: Maybe<TRequest>, key: TAddress, orderUID: string): Maybe<TRequest> {
	if (!quotes) {
		return undefined;
	}

	if (isCowswapOrder(quotes)) {
		const quoteItems = {...quotes.quote};
		quoteItems[key].orderUID = orderUID;
		quoteItems[key].orderStatus = TPossibleStatus.INVALID;
		quoteItems[key].validTo = 0;
		return {
			...quotes,
			quote: quoteItems
		};
	}
	if (isBebopOrder(quotes)) {
		const quoteItems = {...quotes.quote};
		quoteItems[key].orderUID = orderUID;
		quoteItems[key].orderStatus = TPossibleStatus.INVALID;
		return {
			...quotes,
			quote: quoteItems
		};
	}
	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setStatusQuote will set a quote as "status", by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setStatusQuote(
	quotes: Maybe<TRequest>,
	key: TAddress,
	status: TPossibleStatus,
	orderUID: string
): Maybe<TRequest> {
	if (!quotes) {
		return undefined;
	}

	const quoteItems = {...quotes.quote};
	quoteItems[key].orderUID = orderUID;
	quoteItems[key].orderStatus = status;
	return {
		...quotes,
		quote: quoteItems
	};
}

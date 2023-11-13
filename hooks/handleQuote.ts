/* eslint-disable @typescript-eslint/consistent-type-assertions */
import {TPossibleStatus} from 'utils/types';
import {EcdsaSigningScheme} from '@cowprotocol/cow-sdk';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {getTypedBebopQuote, getTypedCowswapQuote, hasQuote, isBebopOrder, isCowswapOrder} from './assertSolver';

import type {
	Maybe,
	TBebopOrderQuoteResponse,
	TBebopRequest,
	TCowswapRequest,
	TQuote,
	TRequest,
	TRequestArgs,
	TTokenWithAmount
} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderParameters} from '@cowprotocol/cow-sdk';

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
export function initQuote(prev: TQuote, key: TAddress, args: TRequestArgs, solver: 'COWSWAP' | 'BEBOP'): TQuote {
	if (solver === 'COWSWAP') {
		if (!prev) {
			return {
				solverType: 'COWSWAP',
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
				quote: {
					[toAddress(key)]: {
						isFetching: true,
						sellToken: {
							chainId: args.inputTokens[0].chainId,
							address: args.inputTokens[0].address,
							decimals: args.inputTokens[0].decimals,
							symbol: args.inputTokens[0].symbol,
							name: args.inputTokens[0].name,
							amount: toNormalizedBN(0)
						},
						buyToken: {
							chainId: args.outputToken.chainId,
							address: args.outputToken.address,
							decimals: args.outputToken.decimals,
							symbol: args.outputToken.symbol,
							name: args.outputToken.name,
							amount: toNormalizedBN(0)
						},
						quote: {} as OrderParameters,
						expiration: '',
						expirationTimestamp: 0,
						validTo: 0,
						signature: '',
						orderUID: '',
						orderStatus: TPossibleStatus.NOT_STARTED,
						orderError: undefined,
						isRefreshing: false,
						signingScheme: EcdsaSigningScheme.ETHSIGN
					}
				}
			} as TRequest & TCowswapRequest;
		}

		const prevQuote = getTypedCowswapQuote(prev);
		return {
			...prevQuote,
			quote: {
				...prevQuote.quote,
				[toAddress(key)]: {
					...prevQuote.quote[toAddress(key)],
					sellToken: prevQuote.quote[toAddress(key)]?.sellToken || {
						address: args.inputTokens[0].address,
						decimals: args.inputTokens[0].decimals,
						symbol: args.inputTokens[0].symbol,
						name: args.inputTokens[0].name,
						amount: toNormalizedBN(0)
					},
					buyToken: prevQuote.quote[toAddress(key)]?.buyToken || {
						address: args.outputToken.address,
						decimals: args.outputToken.decimals,
						symbol: args.outputToken.symbol,
						name: args.outputToken.name,
						amount: toNormalizedBN(0)
					},
					isFetching: true
				}
			}
		};
	}

	if (solver === 'BEBOP') {
		if (!prev) {
			return {
				solverType: 'BEBOP',
				buyTokens: {
					[args.inputTokens[0].address]: {
						address: args.outputToken.address,
						decimals: args.outputToken.decimals,
						symbol: args.outputToken.symbol,
						name: args.outputToken.name,
						chainId: args.outputToken.chainId
					}
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
				quote: {
					isFetching: true,
					isRefreshing: false,
					sellToken: {
						chainId: args.inputTokens[0].chainId,
						address: args.inputTokens[0].address,
						decimals: args.inputTokens[0].decimals,
						symbol: args.inputTokens[0].symbol,
						name: args.inputTokens[0].name,
						amount: toNormalizedBN(0)
					},
					buyToken: {
						chainId: args.outputToken.chainId,
						address: args.outputToken.address,
						decimals: args.outputToken.decimals,
						symbol: args.outputToken.symbol,
						name: args.outputToken.name,
						amount: toNormalizedBN(0)
					},
					id: '',
					status: '',
					signature: '',
					type: '',
					chainId: 0,
					receiver: args.receiver,
					from: args.from,
					expirationTimestamp: 0,
					toSign: {} as unknown,
					orderUID: '',
					orderStatus: TPossibleStatus.NOT_STARTED,
					orderError: undefined
				}
			} as TRequest & TBebopRequest;
		}

		const prevQuote = getTypedBebopQuote(prev);
		return {
			...prevQuote,
			quote: {
				...prevQuote.quote,
				sellToken: prevQuote.quote?.sellToken || {
					address: args.inputTokens[0].address,
					decimals: args.inputTokens[0].decimals,
					symbol: args.inputTokens[0].symbol,
					name: args.inputTokens[0].name,
					amount: toNormalizedBN(0)
				},
				buyToken: prevQuote.quote?.buyToken || {
					address: args.outputToken.address,
					decimals: args.outputToken.decimals,
					symbol: args.outputToken.symbol,
					name: args.outputToken.name,
					amount: toNormalizedBN(0)
				},
				isFetching: true
			}
		};
	}

	return prev;
}

/* 🥟 - Dump Services **********************************************************
 ** addQuote will add a quote to the current state of quotes, by updating the
 ** quote and sellTokens objects with the one provided.
 ******************************************************************************/
export function addQuote(prev: Maybe<TQuote>, quote: TQuote): TQuote {
	if (!prev) {
		return quote;
	}

	if (isCowswapOrder(prev) && isCowswapOrder(quote)) {
		const prevQuote = getTypedCowswapQuote(prev).quote;
		const newQuote = getTypedCowswapQuote(quote).quote;
		for (const [key, item] of Object.entries(newQuote)) {
			prevQuote[toAddress(key)] = item;
		}
		const updatedSellTokens: TDict<TTokenWithAmount> = prev.sellTokens;
		const newSellTokens: TDict<TTokenWithAmount> = quote.sellTokens;
		for (const [key, item] of Object.entries(newSellTokens)) {
			updatedSellTokens[toAddress(key)] = item;
		}

		return {
			...prev,
			quote: prevQuote,
			sellTokens: updatedSellTokens
		};
	}

	if (isBebopOrder(prev) && isBebopOrder(quote)) {
		const newQuote = getTypedBebopQuote(quote);
		return newQuote;
	}

	return quote;
}

/* 🥟 - Dump Services **********************************************************
 ** deleteQuote will remove a quote from the current state of quotes, by removing
 ** them from the quote and sellTokens objects.
 ******************************************************************************/
export function deleteQuote(quotes: TQuote, key: TAddress): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		const sellTokens = {...currentQuote.sellTokens};
		delete quoteItems[toAddress(key)];
		delete sellTokens[toAddress(key)];
		return {
			...currentQuote,
			quote: quoteItems,
			sellTokens
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const sellTokens = {...currentQuote.sellTokens};
		delete sellTokens[toAddress(key)];
		return {
			...currentQuote,
			quote: {} as TBebopOrderQuoteResponse,
			sellTokens: sellTokens
		};
	}

	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** assignSignature will add a signature to the current state of a given quote.
 ******************************************************************************/
export function assignSignature(
	quotes: TQuote,
	key: TAddress,
	signature: string,
	signingScheme: EcdsaSigningScheme
): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].signature = signature;
		quoteItems[toAddress(key)].signingScheme = signingScheme;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = currentQuote.quote;
		quoteItems.signature = signature;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setPendingQuote will set a quote as pending, by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setPendingQuote(quotes: TQuote, key: TAddress, orderUID: string): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].orderUID = orderUID;
		quoteItems[toAddress(key)].orderStatus = TPossibleStatus.PENDING;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = currentQuote.quote;
		quoteItems.orderUID = orderUID;
		quoteItems.orderStatus = TPossibleStatus.PENDING;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setRefreshingQuote will set a quote as refreshing, by updating isRefreshing
 ******************************************************************************/
export function setRefreshingQuote(quotes: TQuote, key: TAddress): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].isRefreshing = true;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = currentQuote.quote;
		quoteItems.isRefreshing = true;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setInvalidQuote will set a quote as invalid, by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setInvalidQuote(quotes: TQuote, key: TAddress, orderUID: string): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].orderUID = orderUID;
		quoteItems[toAddress(key)].orderStatus = TPossibleStatus.INVALID;
		quoteItems[toAddress(key)].expirationTimestamp = 0;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems.orderUID = orderUID;
		quoteItems.orderStatus = TPossibleStatus.INVALID;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}
	return quotes;
}

/* 🥟 - Dump Services **********************************************************
 ** setStatusQuote will set a quote as "status", by updating the order status
 ** and the orderUID.
 ******************************************************************************/
export function setStatusQuote(quotes: TQuote, key: TAddress, status: TPossibleStatus, orderUID: string): TQuote {
	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		const quoteItems = {...currentQuote.quote};
		quoteItems[toAddress(key)].orderUID = orderUID;
		quoteItems[toAddress(key)].orderStatus = status;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		const quoteItems = currentQuote.quote;
		quoteItems.orderUID = orderUID;
		quoteItems.orderStatus = TPossibleStatus.INVALID;
		return {
			...currentQuote,
			quote: quoteItems
		};
	}

	return quotes;
}

export function getBuyAmount(quotes: TRequest, tokenAddress: TAddress): TNormalizedBN {
	if (!hasQuote(quotes, tokenAddress)) {
		return toNormalizedBN(0);
	}

	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		return currentQuote.quote[toAddress(tokenAddress)].buyToken.amount;
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		return currentQuote.buyTokens[tokenAddress].amount;
	}
	return toNormalizedBN(0);
}

export function getSellAmount(quotes: TRequest, tokenAddress: TAddress): TNormalizedBN {
	if (!hasQuote(quotes, tokenAddress)) {
		return toNormalizedBN(0);
	}

	if (isCowswapOrder(quotes)) {
		const currentQuote = getTypedCowswapQuote(quotes);
		return toNormalizedBN(
			toBigInt(currentQuote.quote[toAddress(tokenAddress)]?.quote?.sellAmount) +
				toBigInt(currentQuote.quote[toAddress(tokenAddress)]?.quote?.feeAmount),
			currentQuote.quote[toAddress(tokenAddress)].sellToken.decimals
		);
	}

	if (isBebopOrder(quotes)) {
		const currentQuote = getTypedBebopQuote(quotes);
		return toNormalizedBN(
			toBigInt(currentQuote.sellTokens[toAddress(tokenAddress)]?.amount?.raw),
			currentQuote.sellTokens[toAddress(tokenAddress)]?.decimals || 18
		);
	}
	return toNormalizedBN(0);
}

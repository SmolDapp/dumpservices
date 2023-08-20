
import {type Maybe, type TPossibleSolverQuote, TPossibleStatus, type TSolverQuote, type TTokenAmount} from 'utils/types';

import {isCowswapOrder} from './assertSolver';

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
** addQuote will add a quote to the current state of quotes, by updating the
** quote and sellTokens objects with the one provided.
******************************************************************************/
export function addQuote(
	prev: Maybe<TSolverQuote>,
	quote: TSolverQuote
): Maybe<TSolverQuote> {
	if (!prev) {
		return quote;
	}

	const updatedQuote: TDict<TPossibleSolverQuote> = prev.quote;
	const newQuote: TDict<TPossibleSolverQuote> = quote.quote;
	for (const [key, item] of Object.entries(newQuote)) {
		updatedQuote[key] = item;
	}
	const updatedSellTokens: TDict<TTokenAmount> = prev.sellTokens;
	const newSellTokens: TDict<TTokenAmount> = quote.sellTokens;
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
export function deleteQuote(
	quotes: Maybe<TSolverQuote>,
	key: TAddress
): Maybe<TSolverQuote> {
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
	quotes: Maybe<TSolverQuote>,
	key: TAddress,
	signature: string,
	signingScheme: EcdsaSigningScheme
): Maybe<TSolverQuote> {
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
	return quotes;
}

/* 🥟 - Dump Services **********************************************************
** setPendingQuote will set a quote as pending, by updating the order status
** and the orderUID.
******************************************************************************/
export function setPendingQuote(
	quotes: Maybe<TSolverQuote>,
	key: TAddress,
	orderUID: string
): Maybe<TSolverQuote> {
	if (!quotes) {
		return undefined;
	}

	if (isCowswapOrder(quotes)) {
		const quoteItems = {...quotes.quote};
		quoteItems[key].orderUID = orderUID;
		quoteItems[key].orderStatus = TPossibleStatus.PENDING;
		return {
			...quotes,
			quote: quoteItems
		};
	}
	return quotes;
}

/* 🥟 - Dump Services **********************************************************
** setRefreshingQuote will set a quote as refreshing, by updating isRefreshing
******************************************************************************/
export function setRefreshingQuote(
	quotes: Maybe<TSolverQuote>,
	key: TAddress
): Maybe<TSolverQuote> {
	if (!quotes) {
		return undefined;
	}

	if (isCowswapOrder(quotes)) {
		const quoteItems = {...quotes.quote};
		quoteItems[key].isRefreshing = true;
		return {
			...quotes,
			quote: quoteItems
		};
	}
	return quotes;
}

/* 🥟 - Dump Services **********************************************************
** setInvalidQuote will set a quote as invalid, by updating the order status
** and the orderUID.
******************************************************************************/
export function setInvalidQuote(
	quotes: Maybe<TSolverQuote>,
	key: TAddress,
	orderUID: string
): Maybe<TSolverQuote> {
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
	return quotes;
}


/* 🥟 - Dump Services **********************************************************
** setStatusQuote will set a quote as "status", by updating the order status
** and the orderUID.
******************************************************************************/
export function setStatusQuote(
	quotes: Maybe<TSolverQuote>,
	key: TAddress,
	status: TPossibleStatus,
	orderUID: string
): Maybe<TSolverQuote> {
	if (!quotes) {
		return undefined;
	}

	if (isCowswapOrder(quotes)) {
		const quoteItems = {...quotes.quote};
		quoteItems[key].orderUID = orderUID;
		quoteItems[key].orderStatus = status;
		return {
			...quotes,
			quote: quoteItems
		};
	}
	return quotes;
}

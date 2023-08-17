import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {TBebopOrderQuoteResponse, TCowswapOrderQuoteResponse, TOrderQuote} from 'utils/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

export function asCowswapOrder(order: TOrderQuote | undefined): asserts order is TCowswapOrderQuoteResponse {
	if (!order) {
		throw new Error('Order is undefined');
	}
	if (typeof order !== 'object') {
		throw new Error('Order is not an object');
	}
	if (!('solverType' in order)) {
		throw new Error('Order does not have solverType');
	}
	if (order.solverType !== 'COWSWAP') {
		throw new Error('Order is not a Cowswap order');
	}
}

export function isCowswapOrder(order: TOrderQuote | undefined): order is TCowswapOrderQuoteResponse {
	try {
		asCowswapOrder(order);
		return true;
	} catch (e) {
		return false;
	}
}

export function asBebopOrder(order: TOrderQuote | undefined): asserts order is TBebopOrderQuoteResponse {
	if (!order) {
		throw new Error('Order is undefined');
	}
	if (typeof order !== 'object') {
		throw new Error('Order is not an object');
	}
	if (!('solverType' in order)) {
		throw new Error('Order does not have solverType');
	}
	if (order.solverType !== 'BEBOP') {
		throw new Error('Order is not a Bebop order');
	}
}

export function isBebopOrder(order: TOrderQuote | undefined): order is TBebopOrderQuoteResponse {
	try {
		asBebopOrder(order);
		return true;
	} catch (e) {
		return false;
	}
}

export function getValidTo(order: TOrderQuote): number {
	if (isCowswapOrder(order)) {
		return order.quote.validTo;
	}
	if (isBebopOrder(order)) {
		return order.expirationTimestamp;
	}
	return 0;
}

export function shouldRefreshQuote(order: TOrderQuote, isGnosisSafe: boolean): boolean {
	const expiration = Number(isGnosisSafe ? getValidTo(order) : (order?.expirationTimestamp || 0)) * 1000;
	if (isCowswapOrder(order)) {
		return (expiration < new Date().valueOf() && !order?.orderUID);
	}

	if (isBebopOrder(order)) {
		return (expiration < new Date().valueOf());
	}

	return false;
}


export function getBuyAmount(order: TOrderQuote): TNormalizedBN {
	if (isCowswapOrder(order)) {
		return toNormalizedBN(
			order.quote.buyAmount,
			order.request.outputToken.decimals || 18
		);
	}
	if (isBebopOrder(order)) {
		return toNormalizedBN(
			order.primaryBuyToken.amount,
			order.primaryBuyToken.decimals || 18
		);
	}
	return toNormalizedBN(0);
}

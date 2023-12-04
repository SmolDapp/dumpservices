import {toAddress} from '@yearn-finance/web-lib/utils/address';

import type {TBebopRequest, TCowswapRequest, TRequest} from 'utils/types';

export function isQuote(order: TRequest): order is TRequest {
	if (!order) {
		return false;
	}
	if (typeof order !== 'object') {
		return false;
	}
	if (!('solverType' in order)) {
		return false;
	}
	return true;
}

export function asCowswapOrder(order: TRequest): asserts order is TRequest & TCowswapRequest {
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

export function isCowswapOrder(order: TRequest): order is TRequest & TCowswapRequest {
	try {
		asCowswapOrder(order);
		return true;
	} catch (e) {
		return false;
	}
}

export function asBebopOrder(order: TRequest): asserts order is TRequest & TBebopRequest {
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

export function isBebopOrder(order: TRequest): order is TRequest & TBebopRequest {
	try {
		asBebopOrder(order);
		return true;
	} catch (e) {
		return false;
	}
}

export function getTypedCowswapQuote(order: TRequest): TRequest & TCowswapRequest {
	return order as TRequest & TCowswapRequest;
}

export function getTypedBebopQuote(order: TRequest): TRequest & TBebopRequest {
	return order as TRequest & TBebopRequest;
}

export function hasQuote(quote: TRequest, tokenAddress: string): boolean {
	if (!quote) {
		return false;
	}
	if (isCowswapOrder(quote)) {
		const currentQuote = getTypedCowswapQuote(quote);
		if (tokenAddress === '') {
			return !!currentQuote.quote;
		}
		return !!currentQuote?.quote?.[toAddress(tokenAddress)];
	}

	if (isBebopOrder(quote)) {
		const currentQuote = getTypedBebopQuote(quote);
		return !!currentQuote?.quote?.buyToken;
	}

	return false;
}

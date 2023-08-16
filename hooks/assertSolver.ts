import type {TBebopOrderQuoteResponse, TCowswapOrderQuoteResponse} from 'utils/types';

export function asCowswapOrder(order: unknown): asserts order is TCowswapOrderQuoteResponse {
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

export function isCowswapOrder(order: unknown): order is TCowswapOrderQuoteResponse {
	try {
		asCowswapOrder(order);
		return true;
	} catch (e) {
		return false;
	}
}

export function asBebopOrder(order: unknown): asserts order is TBebopOrderQuoteResponse {
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

export function isBebopOrder(order: unknown): order is TBebopOrderQuoteResponse {
	try {
		asBebopOrder(order);
		return true;
	} catch (e) {
		return false;
	}
}

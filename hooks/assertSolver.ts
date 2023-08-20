
import type {Maybe, TBebopOrderQuoteResponse, TCowswapOrderQuoteResponse,TSolverQuote} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';

export function isQuote(order: Maybe<TSolverQuote>): order is TSolverQuote {
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

export function asCowswapOrder(order: Maybe<TSolverQuote>): asserts order is TSolverQuote & {'quote': TDict<TCowswapOrderQuoteResponse>} {
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

export function isCowswapOrder(order: Maybe<TSolverQuote>): order is TSolverQuote & {'quote': TDict<TCowswapOrderQuoteResponse>} {
	try {
		asCowswapOrder(order);
		return true;
	} catch (e) {
		return false;
	}
}

export function asBebopOrder(order: Maybe<TSolverQuote>): asserts order is TSolverQuote & {'quote': TDict<TBebopOrderQuoteResponse>} {
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

export function isBebopOrder(order: Maybe<TSolverQuote>): order is TSolverQuote & {'quote': TDict<TBebopOrderQuoteResponse>} {
	try {
		asBebopOrder(order);
		return true;
	} catch (e) {
		return false;
	}
}


export function getTypedCowswapQuote(order: Maybe<TSolverQuote>): TSolverQuote & {'quote': TDict<TCowswapOrderQuoteResponse>} {
	return order as TSolverQuote & {'quote': TDict<TCowswapOrderQuoteResponse>};
}

import {isBebopOrder, isCowswapOrder} from './assertSolver';

import type {TRequest} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';

export function getValidTo(order: TRequest, key: TAddress, isWalletSafe: boolean = false): number {
	if (isWalletSafe && isCowswapOrder(order)) {
		return (order.quote?.[key]?.quote?.validTo || 0) * 1000;
	}
	if (isCowswapOrder(order)) {
		return order.quote[key].expirationTimestamp * 1000;
	}
	if (isBebopOrder(order)) {
		return order.quote.expirationTimestamp * 1000;
	}
	return 0;
}

export function shouldRefreshQuote(order: TRequest, key: TAddress, isWalletSafe: boolean): boolean {
	let expiration = 0;
	if (isWalletSafe) {
		expiration = getValidTo(order, key);
	} else if (isCowswapOrder(order)) {
		expiration = order.quote[key].expirationTimestamp * 1000;
	} else if (isBebopOrder(order)) {
		expiration = order.quote.expirationTimestamp * 1000;
	}

	if (isCowswapOrder(order)) {
		return expiration <= new Date().valueOf() && !order.quote[key]?.orderUID && !order.quote[key]?.isFetching;
	}

	if (isBebopOrder(order)) {
		return expiration < new Date().valueOf();
	}

	return false;
}

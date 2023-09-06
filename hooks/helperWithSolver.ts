import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {isBebopOrder, isCowswapOrder} from './assertSolver';

import type {Maybe, TRequest} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

export function getValidTo(
	order: TRequest,
	key: TAddress,
	isWalletSafe: boolean = false
): number {
	if (isWalletSafe && isCowswapOrder(order)) {
		return order.quote[key].validTo;
	}
	if (isCowswapOrder(order)) {
		return order.quote[key].expirationTimestamp * 1000;
	}
	if (isBebopOrder(order)) {
		return order.quote[key].expirationTimestamp * 1000;
	}
	return 0;
}

export function shouldRefreshQuote(
	order: TRequest,
	key: TAddress,
	isWalletSafe: boolean
): boolean {
	let expiration = 0;
	if (isWalletSafe) {
		expiration = getValidTo(order, key);
	} else if (isCowswapOrder(order)) {
		expiration = order.quote[key].expirationTimestamp * 1000;
	} else if (isBebopOrder(order)) {
		expiration = order.quote[key].expirationTimestamp * 1000;
	}

	if (isCowswapOrder(order)) {
		return (expiration <= new Date().valueOf() && !order.quote[key]?.orderUID && !order.quote[key]?.isFetching);
	}

	if (isBebopOrder(order)) {
		return (expiration > new Date().valueOf());
	}

	return false;
}


//TODO: GET BETTER NAME, THIS SHITTY
export function getSellAmount(order: Maybe<TRequest>, tokenAddress: TAddress): TNormalizedBN {
	if (isCowswapOrder(order) && order.quote[tokenAddress]) {
		return toNormalizedBN(
			toBigInt(order.quote[tokenAddress]?.quote?.sellAmount) + toBigInt(order.quote[tokenAddress]?.quote?.feeAmount),
			order.quote[tokenAddress].sellToken.decimals
		);
	}
	if (isBebopOrder(order) && order.quote[tokenAddress]) {
		return toNormalizedBN(
			toBigInt(order.quote[tokenAddress]?.sellToken?.amount?.raw),
			order.quote[tokenAddress]?.sellToken?.decimals || 18
		);
	}
	return toNormalizedBN(0);
}

export function getBuyAmount(order: Maybe<TRequest>, tokenAddress: TAddress): TNormalizedBN {
	if (isCowswapOrder(order) && order.quote[tokenAddress]) {
		return toNormalizedBN(
			order.quote[tokenAddress]?.quote?.buyAmount,
			order.quote[tokenAddress].buyToken.decimals
		);
	}

	if (isBebopOrder(order) && order.quote[tokenAddress]) {
		return toNormalizedBN(
			toBigInt(order.quote[tokenAddress]?.buyToken?.amount?.raw),
			order.quote[tokenAddress]?.buyToken?.decimals || 18
		);
	}
	return toNormalizedBN(0);
}

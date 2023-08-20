import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {isBebopOrder, isCowswapOrder} from './assertSolver';

import type {Maybe, TSolverQuote} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

export function getValidTo(
	order: TSolverQuote,
	key: TAddress,
	isGnosisSafe: boolean = false
): number {
	if (isGnosisSafe && isCowswapOrder(order)) {
		return order.quote[key].validTo;
	}
	if (isCowswapOrder(order)) {
		return order.quote[key].expirationTimestamp;
	}
	if (isBebopOrder(order)) {
		return order.quote[key].expirationTimestamp;
	}
	return 0;
}

export function shouldRefreshQuote(
	order: TSolverQuote,
	key: TAddress,
	isGnosisSafe: boolean
): boolean {
	let expiration = 0;
	if (isGnosisSafe) {
		expiration = getValidTo(order, key);
	} else if (isCowswapOrder(order)) {
		expiration = order.quote[key].expirationTimestamp;
	} else if (isBebopOrder(order)) {
		expiration = order.quote[key].expirationTimestamp;
	}

	if (isCowswapOrder(order)) {
		return (expiration > new Date().valueOf() && !order.quote[key]?.orderUID);
	}

	if (isBebopOrder(order)) {
		return (expiration > new Date().valueOf());
	}

	return false;
}


//TODO: GET BETTER NAME, THIS SHITTY
export function getSellAmount(order: Maybe<TSolverQuote>, tokenAddress: TAddress): TNormalizedBN {
	if (isCowswapOrder(order) && order.quote[toAddress(tokenAddress)]) {
		return toNormalizedBN(
			toBigInt(order.quote[toAddress(tokenAddress)].quote.sellAmount) + toBigInt(order.quote[toAddress(tokenAddress)].quote.feeAmount),
			order.quote[toAddress(tokenAddress)].sellToken.decimals
		);
	}
	if (isBebopOrder(order)) {
		return order.sellTokens[toAddress(tokenAddress)].amount;
	}
	return toNormalizedBN(0);
}

export function getBuyAmount(order: Maybe<TSolverQuote>, tokenAddress: TAddress): TNormalizedBN {
	if (isCowswapOrder(order) && order.quote[toAddress(tokenAddress)]) {
		return toNormalizedBN(
			order.quote[toAddress(tokenAddress)].quote.buyAmount,
			order.quote[toAddress(tokenAddress)].buyToken.decimals
		);
	}
	if (isBebopOrder(order)) {
		return order.sellTokens[toAddress(tokenAddress)].amount;
	}
	return toNormalizedBN(0);
}

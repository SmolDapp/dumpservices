import {VALID_TO_MN, VALID_TO_MN_SAFE} from 'utils/constants';
import axios from 'axios';
import {OrderBookApi, OrderQuoteSideKindSell, SigningScheme} from '@cowprotocol/cow-sdk';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {
	TBebopJamQuoteAPIResp,
	TBebopOrderQuoteError,
	TBebopOrderQuoteResponse,
	TCowQuoteError,
	TCowswapOrderQuoteResponse,
	TOrderQuoteError,
	TRequest,
	TRequestArgs,
	TTokenWithAmount
} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderQuoteRequest} from '@cowprotocol/cow-sdk';

export type TGetQuote = {
	quoteResponse?: TRequest;
	feeAmount?: bigint;
	error?: TOrderQuoteError;
};

type TRetreiveCowQuote = {
	sellToken: TAddress;
	buyToken: TAddress;
	from: TAddress;
	receiver: TAddress;
	amount: TNormalizedBN;
	isWalletSafe: boolean;
};
export async function retrieveQuoteFromCowswap({
	request,
	sellToken,
	buyToken,
	from,
	receiver,
	amount,
	isWalletSafe
}: TRetreiveCowQuote & {request: TRequestArgs}): Promise<TGetQuote> {
	const cowswapOrderBook = new OrderBookApi({chainId: 1});
	const quote: OrderQuoteRequest = {
		sellToken, // token to spend
		buyToken, // token to receive
		from,
		receiver,
		appData: process.env.COWSWAP_APP_DATA || '',
		partiallyFillable: false, // always false
		kind: OrderQuoteSideKindSell.SELL,
		validTo: 0,
		sellAmountBeforeFee: toBigInt(amount.raw || 0).toString(), // amount to sell, in wei
		signingScheme: isWalletSafe ? SigningScheme.PRESIGN : SigningScheme.EIP712
	};
	const canExecuteFetch =
		!(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken) || isZeroAddress(quote.buyToken)) &&
		toBigInt(amount.raw || 0) > 0n;

	if (canExecuteFetch && cowswapOrderBook) {
		quote.validTo = Math.round(
			new Date().setMinutes(new Date().getMinutes() + (isWalletSafe ? VALID_TO_MN_SAFE : VALID_TO_MN)) / 1000
		);
		try {
			const result = (await cowswapOrderBook.getQuote(quote)) as TCowswapOrderQuoteResponse;
			const cowRequest: TRequest = {
				solverType: 'COWSWAP',
				buyToken: request.outputToken,
				sellTokens: {
					[request.inputTokens[0].address]: {
						address: toAddress(request.inputTokens[0].address),
						name: request.inputTokens[0].name,
						symbol: request.inputTokens[0].symbol,
						decimals: request.inputTokens[0].decimals,
						chainId: request.inputTokens[0].chainId,
						amount: toNormalizedBN(
							toBigInt(result.quote.sellAmount) + toBigInt(result.quote.feeAmount),
							request.outputToken.decimals
						)
					}
				},
				quote: {
					[toAddress(result.quote.sellToken)]: {
						...result,
						buyToken: request.outputToken,
						sellToken: request.inputTokens[0],
						validTo: quote.validTo
					}
				}
			};
			return {quoteResponse: cowRequest};
		} catch (_error) {
			const error = _error as TCowQuoteError;
			error.solverType = 'COWSWAP';
			error.message = '[CowSwap] - Impossible to dump that token';
			error.shouldDisable = true;
			console.error(error);
			if (error.body.errorType === 'UnsupportedToken') {
				error.message = 'This token is not supported by CowSwap';
			}
			if (error.body.errorType === 'NoLiquidity') {
				error.message = 'There is no liquidity for this token';
			}
			if (error.body.errorType === 'SellAmountDoesNotCoverFee') {
				if (toBigInt(request.inputBalances[0]) >= toBigInt(error?.body?.data?.fee_amount)) {
					error.message = 'The sell amount does not cover the fee. You can try to increase the amount';
					error.shouldDisable = false;
				} else {
					error.message = 'The sell amount does not cover the fee';
				}
			}
			return {feeAmount: toBigInt(error?.body?.data?.fee_amount), error};
		}
	}
	return {feeAmount: 0n};
}

type TRetreiveBebopQuote = {
	sellTokens: TAddress[];
	buyTokens: TAddress[];
	from: TAddress;
	receiver: TAddress;
	amounts: TNormalizedBN[];
	isWalletSafe: boolean;
};
export async function retrieveQuoteFromBebopJam({
	request,
	sellTokens,
	buyTokens,
	from,
	receiver,
	amounts
}: TRetreiveBebopQuote & {request: TRequestArgs}): Promise<TGetQuote> {
	const hasZeroAddressSellToken = sellTokens.some((token): boolean => isZeroAddress(token));
	const hasZeroAmount = amounts.some((amount): boolean => toBigInt(amount.raw || 0) <= 0n);
	const canExecuteFetch =
		!(isZeroAddress(from) || hasZeroAddressSellToken || isZeroAddress(buyTokens[0])) && !hasZeroAmount;

	if (canExecuteFetch) {
		try {
			const requestURI = new URL(`http://${'localhost:3000'}/api/jamProxy`);
			requestURI.searchParams.append('buy_tokens', buyTokens[0]);
			requestURI.searchParams.append('sell_tokens', sellTokens.join(','));
			requestURI.searchParams.append('sell_amounts', amounts.map(({raw}): string => raw.toString()).join(','));
			requestURI.searchParams.append('taker_address', from);
			requestURI.searchParams.append('receiver_address', receiver);
			requestURI.searchParams.append('approval_type', 'Standard');
			requestURI.searchParams.append('source', 'smol');
			const {data} = await axios.get(requestURI.toString());

			if ((data as TBebopOrderQuoteError)?.error?.errorCode) {
				const error = data as TBebopOrderQuoteError;
				error.solverType = 'BEBOP';
				error.message = '[Bebop] - Impossible to dump that token - ' + error.error.message;
				console.error(error);
				return {feeAmount: 0n, error};
			}

			if (data.status === 'Success') {
				const apiResponse = data as TBebopJamQuoteAPIResp;
				const [[originalBuyTokenAddr, originalBuyToken]] = Object.entries(apiResponse.buyTokens);
				const [[originalSellTokenAddr, originalSellToken]] = Object.entries(apiResponse.sellTokens);
				const requestedBuyToken = request.inputTokens.find((t): boolean => t.address === buyTokens[0]);
				const requestedSellToken = request.outputToken;

				const result: Partial<TBebopOrderQuoteResponse> = {
					id: apiResponse.quoteId,
					status: apiResponse.status,
					type: apiResponse.type,
					chainId: apiResponse.chainId,
					receiver: toAddress(apiResponse.receiver),
					from: from,
					expirationTimestamp: Number(apiResponse.expiry),
					toSign: apiResponse.toSign,
					buyToken: {
						address: toAddress(originalBuyTokenAddr),
						decimals: originalBuyToken.decimals,
						name: requestedBuyToken?.name || '',
						symbol: requestedBuyToken?.symbol || '',
						chainId: requestedBuyToken?.chainId || 0,
						amount: toNormalizedBN(originalBuyToken.amount, originalBuyToken.decimals)
					},
					sellToken: {
						address: toAddress(originalSellTokenAddr),
						decimals: originalSellToken.decimals,
						name: requestedSellToken.name,
						symbol: requestedSellToken.symbol,
						chainId: requestedSellToken.chainId,
						amount: toNormalizedBN(originalSellToken.amount, originalSellToken.decimals)
					}
				};

				const updatedQuote: TDict<TBebopOrderQuoteResponse> = {};
				const sellTokens: TDict<TTokenWithAmount> = {};
				for (const [tokenAddress, tokenData] of Object.entries(apiResponse.sellTokens)) {
					const fromInputToken = request.inputTokens.find(
						(t): boolean => t.address === toAddress(tokenAddress)
					);
					sellTokens[toAddress(tokenAddress)] = {
						address: toAddress(tokenAddress),
						decimals: tokenData.decimals,
						name: fromInputToken?.name || '',
						symbol: fromInputToken?.symbol || '',
						chainId: fromInputToken?.chainId || 0,
						amount: toNormalizedBN(tokenData.amount, tokenData.decimals)
					};
					updatedQuote[toAddress(tokenAddress)] = result as TBebopOrderQuoteResponse;
				}

				const bebopRequest: TRequest = {
					solverType: 'BEBOP',
					buyToken: request.outputToken,
					sellTokens: sellTokens,
					quote: updatedQuote
				};

				return {quoteResponse: bebopRequest};
			}
		} catch (_error) {
			const error = _error as TBebopOrderQuoteError;
			error.solverType = 'BEBOP';
			error.message = '[Bebop] - Impossible to dump that token';
			console.error(_error);
			return {feeAmount: 0n, error};
		}
	}
	return {feeAmount: 0n};
}

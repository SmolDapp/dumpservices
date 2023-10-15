import {VALID_TO_MN, VALID_TO_MN_SAFE} from 'utils/constants';
import {
	type TBebopOrderQuoteError,
	type TBebopOrderQuoteResponse,
	type TBebopQuoteAPIResp,
	type TCowQuoteError,
	type TCowswapOrderQuoteResponse,
	type TOrderQuoteError,
	type TRequest,
	type TRequestArgs,
	type TToken
} from 'utils/types';
import axios from 'axios';
import {OrderBookApi, OrderQuoteSideKindSell, SigningScheme} from '@cowprotocol/cow-sdk';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

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
	const canExecuteFetch = !(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken) || isZeroAddress(quote.buyToken)) && toBigInt(amount.raw || 0) > 0n;

	if (canExecuteFetch && cowswapOrderBook) {
		quote.validTo = Math.round(new Date().setMinutes(new Date().getMinutes() + (isWalletSafe ? VALID_TO_MN_SAFE : VALID_TO_MN)) / 1000);
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
						amount: toNormalizedBN(toBigInt(result.quote.sellAmount) + toBigInt(result.quote.feeAmount), request.outputToken.decimals)
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
			error.message = 'Impossible to dump that token';
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
export async function retrieveQuoteFromBebop({request, sellTokens, buyTokens, from, receiver, amounts}: TRetreiveBebopQuote & {request: TRequestArgs}): Promise<TGetQuote> {
	const hasZeroAddressSellToken = sellTokens.some((token): boolean => isZeroAddress(token));
	const hasZeroAmount = amounts.some((amount): boolean => toBigInt(amount.raw || 0) <= 0n);
	const canExecuteFetch = !(isZeroAddress(from) || hasZeroAddressSellToken || isZeroAddress(buyTokens[0])) && !hasZeroAmount;

	if (canExecuteFetch) {
		try {
			const requestURI = new URL('https://api.bebop.xyz/polygon/v1/quote');
			requestURI.searchParams.append('buy_tokens', buyTokens[0]);
			requestURI.searchParams.append('sell_tokens', sellTokens.join(','));
			requestURI.searchParams.append('sell_amounts', amounts.map((amount): string => amount.normalized.toString()).join(','));
			requestURI.searchParams.append('taker_address', from);
			requestURI.searchParams.append('receiver_address', receiver);
			requestURI.searchParams.append('source', 'smol');
			const {data} = await axios.get(requestURI.toString());

			//Handle the error
			if ((data as TBebopOrderQuoteError)?.error?.errorCode) {
				const error = data as TBebopOrderQuoteError;
				error.solverType = 'BEBOP';
				error.message = 'Impossible to dump that token';
				console.error(error);
				return {feeAmount: 0n, error};
			}

			if (data.status === 'QUOTE_SUCCESS') {
				const apiResponse = data as TBebopQuoteAPIResp;
				const [originalBuyToken] = Object.values(apiResponse.buyTokens);
				const [originalSellToken] = Object.values(apiResponse.sellTokens);
				const requestedBuyToken = request.inputTokens.find((t): boolean => t.address === toAddress(originalBuyToken.contractAddress));
				const requestedSellToken = request.outputToken;

				const result = {
					id: apiResponse.quoteId,
					status: apiResponse.status,
					type: apiResponse.type,
					chainId: apiResponse.chainId,
					receiver: apiResponse.receiver,
					from: from,
					expirationTimestamp: Number(apiResponse.expiry),
					toSign: apiResponse.toSign,
					buyToken: {
						address: toAddress(originalBuyToken.contractAddress),
						decimals: originalBuyToken.decimals,
						name: requestedBuyToken?.name || '',
						symbol: requestedBuyToken?.symbol || '',
						chainId: requestedBuyToken?.chainId || 0,
						amount: toNormalizedBN(originalBuyToken.amount, originalBuyToken.decimals)
					},
					sellToken: {
						address: toAddress(originalSellToken.contractAddress),
						decimals: originalSellToken.decimals,
						name: requestedSellToken.name,
						symbol: requestedSellToken.symbol,
						chainId: requestedSellToken.chainId,
						amount: toNormalizedBN(originalSellToken.amount, originalSellToken.decimals)
					}
				};

				const sellTokens: TDict<TToken & {amount: TNormalizedBN}> = {};
				for (const token of Object.values(apiResponse.sellTokens)) {
					const fromInputToken = request.inputTokens.find((t): boolean => t.address === toAddress(token.contractAddress));
					sellTokens[toAddress(token.contractAddress)] = {
						address: toAddress(token.contractAddress),
						decimals: token.decimals,
						name: fromInputToken?.name || '',
						symbol: fromInputToken?.symbol || '',
						chainId: fromInputToken?.chainId || 0,
						amount: toNormalizedBN(token.amount, token.decimals)
					};
				}

				const updatedQuote: TDict<TBebopOrderQuoteResponse> = {};
				for (const token of Object.values(apiResponse.sellTokens)) {
					updatedQuote[toAddress(token.contractAddress)] = result as TBebopOrderQuoteResponse;
				}

				const bebopRequest: TRequest = {
					solverType: 'BEBOP',
					buyToken: request.outputToken,
					sellTokens: sellTokens,
					quote: updatedQuote,
					bebopAggregatedQuote: apiResponse
				};
				return {quoteResponse: bebopRequest};
			}
		} catch (_error) {
			const error = _error as TBebopOrderQuoteError;
			error.solverType = 'BEBOP';
			error.message = 'Impossible to dump that token';
			console.error(error);
			return {feeAmount: 0n, error};
		}
	}
	return {feeAmount: 0n};
}

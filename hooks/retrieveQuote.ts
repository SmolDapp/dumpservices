import {VALID_TO_MN, VALID_TO_MN_SAFE} from 'utils/constants';
import axios from 'axios';
import {OrderBookApi, OrderQuoteSide, SigningScheme} from '@cowprotocol/cow-sdk';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {TBebopOrderQuoteError, TBebopOrderQuoteResponse, TBebopToken, TCowQuoteError, TCowswapOrderQuoteResponse, TInitSolverArgs, TOrderQuoteError, TSolverQuote, TToken, TTokenAmount} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderQuoteRequest} from '@cowprotocol/cow-sdk';

export type TGetQuote = {
	quoteResponse?: TSolverQuote,
	feeAmount?: bigint,
	error?: TOrderQuoteError
}

type TRetreiveCowQuote = {
	sellToken: TAddress,
	buyToken: TAddress,
	from: TAddress,
	receiver: TAddress,
	amount: TNormalizedBN,
	isGnosisSafe: boolean,
	shouldPreventErrorToast?: boolean
}
export async function retrieveQuoteFromCowswap({
	request,
	sellToken,
	buyToken,
	from,
	receiver,
	amount,
	isGnosisSafe,
	shouldPreventErrorToast = false
}: TRetreiveCowQuote & {request: TInitSolverArgs}): Promise<TGetQuote> {
	const cowswapOrderBook = new OrderBookApi({chainId: 1});
	const quote: OrderQuoteRequest = ({
		sellToken, // token to spend
		buyToken, // token to receive
		from,
		receiver,
		appData: process.env.COWSWAP_APP_DATA || '',
		partiallyFillable: false, // always false
		kind: OrderQuoteSide.kind.SELL,
		validTo: 0,
		sellAmountBeforeFee: toBigInt(amount.raw || 0).toString(), // amount to sell, in wei
		signingScheme: isGnosisSafe ? SigningScheme.PRESIGN : SigningScheme.EIP712
	});

	const canExecuteFetch = (
		!(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken) || isZeroAddress(quote.buyToken))
		&& toBigInt(amount.raw || 0) > 0n
	);

	if (canExecuteFetch && cowswapOrderBook) {
		quote.validTo = Math.round((new Date().setMinutes(
			new Date().getMinutes() + (isGnosisSafe ? VALID_TO_MN_SAFE : VALID_TO_MN)) / 1000)
		);
		try {
			const result = await cowswapOrderBook.getQuote(quote) as TCowswapOrderQuoteResponse;
			const cowRequest: TSolverQuote = {
				solverType: 'COWSWAP',
				buyToken: request.outputToken,
				sellTokens: {
					[toAddress(request.inputTokens[0].value)]: {
						value: toAddress(request.inputTokens[0].value),
						decimals: request.inputTokens[0].decimals,
						label: request.inputTokens[0].label,
						symbol: request.inputTokens[0].symbol,
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
			return ({quoteResponse: cowRequest});
		} catch (_error) {
			console.error(_error);
			const error = _error as TCowQuoteError;
			error.solverType = 'COWSWAP';
			if (!shouldPreventErrorToast) {
				toast({
					type: 'error',
					content: `Impossible to dump that token ${error.description ? `(Reason: ${error.description})` : ''}`
				});
			}
			return ({feeAmount: toBigInt(error.data?.fee_amount), error});
		}
	}
	return ({feeAmount: 0n});
}

type TRetreiveBebopQuote = {
	sellTokens: TAddress[],
	buyTokens: TAddress[],
	from: TAddress,
	receiver: TAddress,
	amounts: TNormalizedBN[],
	isGnosisSafe: boolean,
	shouldPreventErrorToast?: boolean
}
export async function retrieveQuoteFromBebop({
	request,
	sellTokens,
	buyTokens,
	from,
	receiver,
	amounts,
	shouldPreventErrorToast = false
}: TRetreiveBebopQuote & {request: TInitSolverArgs}): Promise<TGetQuote> {
	const hasZeroAddressSellToken = sellTokens.some((token): boolean => isZeroAddress(token));
	const hasZeroAmount = amounts.some((amount): boolean => toBigInt(amount.raw || 0) <= 0n);
	const canExecuteFetch = (
		!(isZeroAddress(from) || hasZeroAddressSellToken || isZeroAddress(buyTokens[0]))
		&& !hasZeroAmount
	);

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
			if ((data as TBebopOrderQuoteError)?.error?.errorCode) {
				const error = data as TBebopOrderQuoteError;
				error.solverType = 'BEBOP';
				if (!shouldPreventErrorToast) {
					toast({
						type: 'error',
						content: `Impossible to dump that token ${error.error.message ? `(Reason: ${error.error.message})` : ''}`
					});
				}
				return ({feeAmount: 0n, error});
			}

			const result = data as TBebopOrderQuoteResponse;
			if (result.status === 'QUOTE_SUCCESS') {
				result.id = data.quoteId;
				result.expirationTimestamp = Number(data.expiry);

				const updatedBuyToken: TDict<TTokenAmount> = {};
				for (const token of (Object.values(result.buyTokens) as unknown as TBebopToken[])) {
					updatedBuyToken[toAddress(token.contractAddress)] = {
						value: toAddress(token.contractAddress),
						decimals: token.decimals,
						label: request.inputTokens.find((t): boolean => t.value === toAddress(token.contractAddress))?.label || '',
						symbol: request.inputTokens.find((t): boolean => t.value === toAddress(token.contractAddress))?.symbol || '',
						amount: toNormalizedBN(token.amount, token.decimals)
					};
				}
				const updatedSellToken: TDict<TToken & {amount: TNormalizedBN}> = {};
				for (const token of (Object.values(result.sellTokens) as unknown as TBebopToken[])) {
					updatedSellToken[toAddress(token.contractAddress)] = {
						value: toAddress(token.contractAddress),
						decimals: token.decimals,
						label: request.inputTokens.find((t): boolean => t.value === toAddress(token.contractAddress))?.label || '',
						symbol: request.inputTokens.find((t): boolean => t.value === toAddress(token.contractAddress))?.symbol || '',
						amount: toNormalizedBN(token.amount, token.decimals)
					};
				}
				const updatedQuote: TDict<TBebopOrderQuoteResponse> = {};
				for (const token of (Object.values(result.sellTokens) as unknown as TBebopToken[])) {
					updatedQuote[toAddress(token.contractAddress)] = {
						...result
					};
				}

				result.sellTokens = updatedSellToken;

				const bebopRequest: TSolverQuote = {
					solverType: 'BEBOP',
					buyToken: request.outputToken,
					sellTokens: updatedSellToken,
					quote: updatedQuote
				};
				return ({quoteResponse: bebopRequest});
			}
		} catch (_error) {
			console.error(_error);
			const error = _error as TBebopOrderQuoteError;
			error.solverType = 'BEBOP';
			if (!shouldPreventErrorToast) {
				toast({
					type: 'error',
					content: `Impossible to dump that token ${error.error.message ? `(Reason: ${error.error.message})` : ''}`
				});
			}
			return ({feeAmount: 0n, error});
		}
	}
	return ({feeAmount: 0n});
}

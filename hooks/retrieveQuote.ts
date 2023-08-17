import {VALID_TO_MN, VALID_TO_MN_SAFE} from 'utils/constants';
import axios from 'axios';
import {OrderBookApi, OrderQuoteSide, SigningScheme} from '@cowprotocol/cow-sdk';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {TBebopOrderQuoteError, TBebopOrderQuoteResponse, TCowQuoteError, TCowswapOrderQuoteResponse, TOrderQuote, TOrderQuoteError} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderQuoteRequest} from '@cowprotocol/cow-sdk';

export type TGetQuote = {
	quoteResponse?: TOrderQuote
	feeAmount?: bigint,
	error?: TOrderQuoteError
}

type TRetreiveQuote = {
	sellTokens: TAddress[],
	buyTokens: TAddress[],
	from: TAddress,
	receiver: TAddress,
	amounts: TNormalizedBN[],
	isGnosisSafe: boolean,
	shouldPreventErrorToast?: boolean
}

export async function retrieveQuoteFromCowswap({
	sellTokens,
	buyTokens,
	from,
	receiver,
	amounts,
	isGnosisSafe,
	shouldPreventErrorToast = false
}: TRetreiveQuote): Promise<TGetQuote> {
	const cowswapOrderBook = new OrderBookApi({chainId: 1});
	const quote: OrderQuoteRequest = ({
		sellToken: sellTokens[0], // token to spend
		buyToken: buyTokens[0], // token to receive
		from,
		receiver,
		appData: process.env.COWSWAP_APP_DATA || '',
		partiallyFillable: false, // always false
		kind: OrderQuoteSide.kind.SELL,
		validTo: 0,
		sellAmountBeforeFee: toBigInt(amounts[0].raw || 0).toString(), // amount to sell, in wei
		signingScheme: isGnosisSafe ? SigningScheme.PRESIGN : SigningScheme.EIP712
	});

	const canExecuteFetch = (
		!(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken[0]) || isZeroAddress(quote.buyToken))
		&& toBigInt(amounts[0].raw || 0) > 0n
	);

	if (canExecuteFetch && cowswapOrderBook) {
		quote.validTo = Math.round((new Date().setMinutes(
			new Date().getMinutes() + (isGnosisSafe ? VALID_TO_MN_SAFE : VALID_TO_MN)) / 1000)
		);
		try {
			const result = await cowswapOrderBook.getQuote(quote) as TCowswapOrderQuoteResponse;
			return ({quoteResponse: result});
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

export async function retrieveQuoteFromBebop({
	sellTokens,
	buyTokens,
	from,
	receiver,
	amounts,
	shouldPreventErrorToast = false
}: TRetreiveQuote): Promise<TGetQuote> {
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
				result.solverType = 'BEBOP';
				result.expirationTimestamp = Number(data.expiry);
				result.id = data.quoteId;
				result.primaryBuyToken = Object.values(result.buyTokens).find((token): boolean => toAddress(token.contractAddress) === buyTokens[0]) || Object.values(result.buyTokens)[0];
				return ({quoteResponse: result});
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

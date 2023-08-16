import {VALID_TO_MN, VALID_TO_MN_SAFE} from 'utils/constants';
import axios from 'axios';
import {OrderBookApi, OrderQuoteSide, SigningScheme} from '@cowprotocol/cow-sdk';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {isZeroAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {TBebopOrderQuoteResponse, TCowswapOrderQuoteResponse} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderQuoteRequest} from '@cowprotocol/cow-sdk';

export type TCowQuoteError = {
	description: string,
	errorType: string,
	data: {fee_amount: string}
}
export type TGetQuote = {
	quoteResponse?: TCowswapOrderQuoteResponse | TBebopOrderQuoteResponse
	feeAmount?: bigint,
	error?: TCowQuoteError
}

type TRetreiveQuoteFromCowswap = {
	sellToken: TAddress,
	buyToken: TAddress,
	from: TAddress,
	receiver: TAddress,
	amount: TNormalizedBN,
	isGnosisSafe: boolean,
	shouldPreventErrorToast?: boolean
}

export async function retrieveQuoteFromCowswap({
	sellToken,
	buyToken,
	from,
	receiver,
	amount,
	isGnosisSafe,
	shouldPreventErrorToast = false
}: TRetreiveQuoteFromCowswap): Promise<TGetQuote> {
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
			return ({quoteResponse: result});
		} catch (_error) {
			console.error(_error);
			const error = _error as TCowQuoteError;
			if (!shouldPreventErrorToast) {
				toast({
					type: 'error',
					content: `Zap not possible ${error.description ? `(Reason: ${error.description})` : ''}`
				});
			}
			return ({feeAmount: toBigInt(error.data?.fee_amount), error});
		}
	}
	return ({feeAmount: 0n});
}

export async function retrieveQuoteFromBebop({
	sellToken,
	buyToken,
	from,
	receiver,
	amount,
	shouldPreventErrorToast = false
}: TRetreiveQuoteFromCowswap): Promise<TGetQuote> {
	const canExecuteFetch = (
		!(isZeroAddress(from) || isZeroAddress(sellToken) || isZeroAddress(buyToken))
		&& toBigInt(amount.raw || 0) > 0n
	);

	if (canExecuteFetch) {
		try {
			const requestURI = new URL('https://api.bebop.xyz/polygon/v1/quote');
			requestURI.searchParams.append('buy_tokens', buyToken);
			requestURI.searchParams.append('sell_tokens', sellToken);
			requestURI.searchParams.append('sell_amounts', amount.normalized.toString());
			requestURI.searchParams.append('taker_address', from);
			requestURI.searchParams.append('receiver_address', receiver);
			requestURI.searchParams.append('source', 'smol');
			const {data} = await axios.get(requestURI.toString());
			const result = data as TBebopOrderQuoteResponse;
			if (result.status === 'QUOTE_SUCCESS') {
				return ({quoteResponse: result});
			}
		} catch (_error) {
			console.error(_error);
			const error = _error as TCowQuoteError;
			if (!shouldPreventErrorToast) {
				toast({
					type: 'error',
					content: `Zap not possible ${error.description ? `(Reason: ${error.description})` : ''}`
				});
			}
			return ({feeAmount: toBigInt(error.data?.fee_amount), error});
		}
	}
	return ({feeAmount: 0n});
}

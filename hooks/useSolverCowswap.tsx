import {useCallback, useEffect, useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {ethers} from 'ethers';
import {OrderBookApi, OrderQuoteSide, OrderSigningUtils, SigningScheme} from '@cowprotocol/cow-sdk';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {BigNumber} from 'ethers';
import type {Maybe, TInitSolverArgs, TOrderQuoteResponse, TPossibleStatus} from 'utils/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderCreation, OrderParameters, OrderQuoteRequest, SigningResult, UnsignedOrder} from '@cowprotocol/cow-sdk';

type TCowQuoteError = {
	description: string,
	errorType: string,
	data: {fee_amount: string}
}
type TGetQuote = [Maybe<TOrderQuoteResponse>, BigNumber, Maybe<TCowQuoteError>]
type TInit = [TNormalizedBN, Maybe<TOrderQuoteResponse>, boolean, Maybe<TCowQuoteError>]
type TCheckOrder = {status: TPossibleStatus, isSuccessful: boolean, error?: Error}
type TExecuteResp = {status: TPossibleStatus, orderUID: string, quote: TOrderQuoteResponse, error?: {message: string}}
type TSolverContext = {
	init: (args: TInitSolverArgs) => Promise<TInit>;
	signCowswapOrder: (quote: TOrderQuoteResponse) => Promise<SigningResult>;
	execute: (quoteOrder: TOrderQuoteResponse, shouldUsePresign: boolean, onSubmitted: (orderUID: string) => void) => Promise<TExecuteResp>;
}


const	VALID_TO_MN = 60;
const	VALID_TO_MN_SAFE = 179;
export function useSolverCowswap(): TSolverContext {
	const {slippage} = useSweepooor();
	const {walletType, provider} = useWeb3();
	const {toast} = yToast();
	const {safeChainID} = useChainID();
	const [orderBookAPI, set_orderBookAPI] = useState<Maybe<OrderBookApi>>();
	const maxIterations = 1000; // 1000 * up to 3 seconds = 3000 seconds = 50 minutes
	const isGnosisSafe = (
		walletType === 'EMBED_GNOSIS_SAFE'
		// || (((provider as any)?.provider?.connector?._peerMeta?.name || '').toLowerCase()).includes('safe')
	);
	useEffect((): void => {
		const api = new OrderBookApi({chainId: safeChainID});
		set_orderBookAPI(api);
	}, [safeChainID]);

	const getQuote = useCallback(async (
		request: TInitSolverArgs,
		shouldPreventErrorToast = false
	): Promise<TGetQuote> => {
		const	quote: OrderQuoteRequest = ({
			sellToken: toAddress(request.inputToken.value), // token to spend
			buyToken: toAddress(request.outputToken.value), // token to receive
			from: request.from,
			receiver: request.receiver,
			appData: process.env.COWSWAP_APP_DATA || '',
			partiallyFillable: false, // always false
			kind: OrderQuoteSide.kind.SELL,
			validTo: 0,
			sellAmountBeforeFee: formatBN(request?.inputAmount || 0).toString() // amount to sell, in wei
		});

		const canExecuteFetch = (
			!(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken) || isZeroAddress(quote.buyToken))
			&& !formatBN(request?.inputAmount || 0).isZero()
		);

		if (canExecuteFetch && orderBookAPI) {
			quote.validTo = Math.round((new Date().setMinutes(
				new Date().getMinutes() + (isGnosisSafe ? VALID_TO_MN_SAFE : VALID_TO_MN)) / 1000)
			);
			console.warn(quote.validTo, (isGnosisSafe ? VALID_TO_MN_SAFE : VALID_TO_MN));
			try {
				const result = await orderBookAPI.getQuote(quote) as TOrderQuoteResponse;
				console.log(result);
				return ([result, Zero, undefined]);
			} catch (error) {
				const	_error = error as TCowQuoteError;
				if (shouldPreventErrorToast) {
					return [undefined, formatBN(_error.data?.fee_amount || 0), _error];
				}
				console.error(error);
				const	message = `Zap not possible ${_error.description ? `(Reason: ${_error.description})` : ''}`;
				toast({type: 'error', content: message});
				return [undefined, formatBN(_error?.data?.fee_amount || 0), _error];
			}
		}
		return [undefined, formatBN(0), undefined];
	}, [isGnosisSafe, orderBookAPI, toast]);

	/* 🔵 - Yearn Finance **************************************************************************
	** A slippage of 1% per default is set to avoid the transaction to fail due to price
	** fluctuations. The buyAmountWithSlippage is used to request this amount instead of the
	** original buyAmount.
	**********************************************************************************************/
	const getBuyAmountWithSlippage = useCallback((quote: OrderParameters, decimals: number): string => {
		const buyAmount = Number(ethers.utils.formatUnits(quote.buyAmount, decimals));
		const withSlippage = ethers.utils.parseUnits((buyAmount * (1 - Number((slippage?.value || 0) / 100))).toFixed(decimals), decimals);
		return withSlippage.toString();
	}, [slippage.value]);

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.current.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<TInit> => {
		const [quote, minFeeAmount, error] = await getQuote(_request);
		if (quote) {
			const buyAmountWithSlippage = getBuyAmountWithSlippage(quote.quote, _request?.outputToken?.decimals || 18);
			const value = toNormalizedBN(buyAmountWithSlippage || 0, _request?.outputToken?.decimals || 18);
			quote.request = _request;
			quote.buyAmountWithSlippage = buyAmountWithSlippage;
			quote.expirationTimestamp = Math.round((new Date(quote.expiration).getTime() / 1000));
			return [value, quote, true, error];
		}
		const value = toNormalizedBN(minFeeAmount || 0, _request?.inputToken?.decimals || 18);
		return [value, undefined, false, error];
	}, [getBuyAmountWithSlippage, getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** signCowswapOrder is used to sign the order with the user's wallet. The signature is used
	** to execute the order.
	** If shouldUsePresign is set to true, the signature is not required and the approval is
	** skipped. This should only be used for debugging purposes.
	**********************************************************************************************/
	const	signCowswapOrder = useCallback(async (quoteOrder: TOrderQuoteResponse): Promise<SigningResult> => {
		if (process.env.SHOULD_USE_PRESIGN) { //sleep 1 second to simulate the signing process
			await new Promise(async (resolve): Promise<NodeJS.Timeout> => setTimeout(resolve, 1000));
			return ({signature: '0x', signingScheme: 'presign'} as any);
		}

		// We need to sign the message WITH THE SLIPPAGE, in order to get the correct signature
		const	{quote} = quoteOrder;
		let	buyAmountWithSlippage = quoteOrder.buyAmountWithSlippage as string;
		if (!quoteOrder.buyAmountWithSlippage) {
			buyAmountWithSlippage = getBuyAmountWithSlippage(quote, quoteOrder.request.outputToken.decimals);
		}
		const	signer = provider.getSigner();
		const	rawSignature = await OrderSigningUtils.signOrder(
			{...quote as UnsignedOrder, buyAmount: buyAmountWithSlippage},
			safeChainID,
			signer
		);
		return rawSignature;
	}, [getBuyAmountWithSlippage, provider, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Cowswap orders have a validity period and the return value on submit is not the execution
	** status of the order. This method is used to check the status of the order and returns a
	** boolean value indicating whether the order was successful or not.
	** It will timeout once the order is no longer valid or after 50 minutes (max should be 30mn)
	**********************************************************************************************/
	const	checkOrderStatus = useCallback(async (orderUID: string, validTo: number): Promise<TCheckOrder> => {
		for (let i = 0; i < maxIterations; i++) {
			const order = await orderBookAPI?.getOrder(orderUID);
			if (order?.status === 'fulfilled') {
				return ({status: order?.status, isSuccessful: true});
			}
			if (order?.status === 'cancelled' || order?.status === 'expired') {
				return ({status: order?.status, isSuccessful: false, error: new Error('TX fail because the order was not fulfilled')});
			}
			if (validTo < (new Date().valueOf() / 1000)) {
				return ({status: 'expired', isSuccessful: false, error: new Error('TX fail because the order expired')});
			}
			// Sleep for 3 seconds before checking the status again
			await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 3000));
		}
		return ({status: 'expired', isSuccessful: false, error: new Error('TX fail because the order expired')});
	}, [orderBookAPI]);

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (
		quoteOrder: TOrderQuoteResponse,
		shouldUsePresign: boolean,
		onSubmitted: (orderUID: string) => void
	): Promise<TExecuteResp> => {
		if (!quoteOrder) {
			return {status: 'invalid', orderUID: '', quote: quoteOrder};
		}
		const	{quote} = quoteOrder;
		let	buyAmountWithSlippage = quoteOrder.buyAmountWithSlippage as string;
		if (!quoteOrder.buyAmountWithSlippage) {
			buyAmountWithSlippage = getBuyAmountWithSlippage(quote, quoteOrder.request.outputToken.decimals);
		}
		const	signingScheme: SigningScheme = shouldUsePresign ? SigningScheme.PRESIGN : quoteOrder.signingScheme as string as SigningScheme;
		const	orderCreation: OrderCreation = {
			...quote,
			buyAmount: buyAmountWithSlippage,
			from: quoteOrder.from,
			// quoteId: quoteOrder.id, //Experimentation
			signature: quoteOrder.signature,
			signingScheme: signingScheme
		};
		try {
			const	orderUID = await orderBookAPI?.sendOrder(orderCreation);
			if (orderUID) {
				onSubmitted?.(orderUID);
				if (shouldUsePresign) {
					// await new Promise(async (resolve): Promise<NodeJS.Timeout> => setTimeout(resolve, 5000));
					// toast({type: 'success', content: 'Order executed'});
					// return {status: 'fulfilled', orderUID, quote: quoteOrder};
					return {status: 'pending', orderUID, quote: quoteOrder};
				}
				const {status, error} = await checkOrderStatus(orderUID, quote.validTo as number);
				if (error) {
					console.error(error);
					toast({type: 'error', content: (error as {message: string}).message});
				}
				return {status, orderUID, quote: quoteOrder};
			}
		} catch (error) {
			return {status: 'invalid', orderUID: '', quote: quoteOrder, error: error as {message: string}};
		}

		return {status: 'invalid', orderUID: '', quote: quoteOrder};
	}, [checkOrderStatus, getBuyAmountWithSlippage, orderBookAPI, toast]);

	return useMemo((): TSolverContext => ({
		init,
		signCowswapOrder,
		execute
	}), [init, signCowswapOrder, execute]);
}

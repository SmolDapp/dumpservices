import {useCallback, useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {ethers} from 'ethers';
import {OrderBookApi, SigningScheme} from '@cowprotocol/cow-sdk';
import {useMountEffect} from '@react-hookz/web';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {isBebopOrder, isCowswapOrder} from './assertSolver';
import {retrieveQuoteFromBebop, retrieveQuoteFromCowswap} from './retrieveQuote';
import {signQuoteFromCowswap} from './signQuote';

import type {Maybe, TBebopOrderQuoteResponse, TCowswapOrderQuoteResponse, TInitSolverArgs, TPossibleStatus} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderCreation, OrderParameters, SigningResult} from '@cowprotocol/cow-sdk';
import type {TCowQuoteError, TGetQuote} from './retrieveQuote';

type TInit = {
	estimateOut: TNormalizedBN,
	quoteResponse?: TCowswapOrderQuoteResponse | TBebopOrderQuoteResponse
	isSuccess: boolean,
	error?: TCowQuoteError
}
type TCheckOrder = {status: TPossibleStatus, isSuccessful: boolean, error?: Error}
type TExecuteResp = {status: TPossibleStatus, orderUID: string, quote: TCowswapOrderQuoteResponse, error?: {message: string}}
type TSolverContext = {
	init: (args: TInitSolverArgs) => Promise<TInit>;
	signCowswapOrder: (quote: TCowswapOrderQuoteResponse) => Promise<SigningResult>;
	execute: (quoteOrder: TCowswapOrderQuoteResponse, shouldUsePresign: boolean, onSubmitted: (orderUID: string) => void) => Promise<TExecuteResp>;
}

export function getSpender({chainID}: {chainID: number}): TAddress {
	switch (chainID) {
		case 1:
			return toAddress(process.env.COWSWAP_SPENDER_ADDRESS);
		case 137:
			return toAddress(process.env.BEBOP_ADDRESS);
	}
	return toAddress(process.env.COWSWAP_SPENDER_ADDRESS);

}

export function useSolverCowswap(): TSolverContext {
	const {slippage} = useSweepooor();
	const {walletType} = useWeb3();
	const {toast} = yToast();
	const {safeChainID} = useChainID();
	const [cowswapOrderBook, set_cowswapOrderBook] = useState<Maybe<OrderBookApi>>();
	const maxIterations = 1000; // 1000 * up to 3 seconds = 3000 seconds = 50 minutes
	const isGnosisSafe = (walletType === 'EMBED_GNOSIS_SAFE');

	/* 🔵 - SmolDapp *******************************************************************************
	** Depending on the solver to use, we may need to initialize a bunch of elements.
	** Possible solvers are:
	** - Cowswap for Ethereum
	** - Bebop for Polygon and Arbitrum
	**********************************************************************************************/
	useMountEffect((): void => {
		set_cowswapOrderBook(new OrderBookApi({chainId: 1}));
	});

	const getQuote = useCallback(async (
		request: TInitSolverArgs,
		shouldPreventErrorToast = false
	): Promise<TGetQuote> => {
		switch (safeChainID) {
			case 1:
				return await retrieveQuoteFromCowswap({
					sellToken: toAddress(request.inputToken.value),
					buyToken: toAddress(request.outputToken.value),
					from: toAddress(request.from),
					receiver: toAddress(request.receiver),
					amount: toNormalizedBN(request.inputAmount, request.inputToken.decimals),
					isGnosisSafe,
					shouldPreventErrorToast
				});
			case 137:
				return await retrieveQuoteFromBebop({
					sellToken: toAddress(request.inputToken.value),
					buyToken: toAddress(request.outputToken.value),
					from: toAddress(request.from),
					receiver: toAddress(request.receiver),
					amount: toNormalizedBN(request.inputAmount, request.inputToken.decimals),
					isGnosisSafe,
					shouldPreventErrorToast
				});
			default:
				return ({quoteResponse: undefined, feeAmount: 0n, error: undefined});
		}
	}, [isGnosisSafe, safeChainID]);

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
		const decimals = _request?.outputToken?.decimals || 18;
		if (safeChainID !== 1 && safeChainID !== 137) {
			return {isSuccess: false, estimateOut: toNormalizedBN(0)};
		}

		const {quoteResponse, feeAmount, error} = await getQuote(_request);
		if (!quoteResponse || error) {
			const estimateOut = toNormalizedBN(toBigInt(feeAmount), decimals);
			return {isSuccess: false, estimateOut, quoteResponse, error};
		}

		if (isCowswapOrder(quoteResponse)) {
			const quote = quoteResponse;
			const buyAmountWithSlippage = getBuyAmountWithSlippage(quote.quote, _request?.outputToken?.decimals || 18);
			const estimateOut = toNormalizedBN(buyAmountWithSlippage || 0, _request?.outputToken?.decimals || 18);
			quote.request = _request;
			quote.buyAmountWithSlippage = buyAmountWithSlippage;
			quote.expirationTimestamp = Math.round((new Date(quote.expiration).getTime() / 1000));
			return {isSuccess: true, quoteResponse, estimateOut};
		}

		if (isBebopOrder(quoteResponse)) {
			const quote = quoteResponse;
			const token = Object.values(quote.buyTokens).find((token): boolean => toAddress(token.contractAddress) === toAddress(_request.outputToken.value)) || Object.values(quote.buyTokens)[0];
			const estimateOut = toNormalizedBN(
				toBigInt(token.amount),
				_request?.outputToken?.decimals || 18
			);
			return {isSuccess: true, quoteResponse, estimateOut};
		}

		const value = toNormalizedBN(toBigInt(feeAmount), decimals);
		return {isSuccess: false, estimateOut: value};
	}, [getBuyAmountWithSlippage, getQuote, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** signCowswapOrder is used to sign the order with the user's wallet. The signature is used
	** to execute the order.
	** If shouldUsePresign is set to true, the signature is not required and the approval is
	** skipped. This should only be used for debugging purposes.
	**********************************************************************************************/
	const signCowswapOrder = useCallback(async (quoteOrder: TCowswapOrderQuoteResponse): Promise<SigningResult> => {
		if (isCowswapOrder(quoteOrder)) {
			const amountWithSlippage = getBuyAmountWithSlippage(
				quoteOrder.quote,
				quoteOrder.request.outputToken.decimals
			);
			return signQuoteFromCowswap({quoteOrder, safeChainID, amountWithSlippage});
		}

		return ({signature: '0x', signingScheme: 'presign'} as unknown as SigningResult);
	}, [getBuyAmountWithSlippage, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Cowswap orders have a validity period and the return value on submit is not the execution
	** status of the order. This method is used to check the status of the order and returns a
	** boolean value indicating whether the order was successful or not.
	** It will timeout once the order is no longer valid or after 50 minutes (max should be 30mn)
	**********************************************************************************************/
	const checkOrderStatus = useCallback(async (orderUID: string, validTo: number): Promise<TCheckOrder> => {
		for (let i = 0; i < maxIterations; i++) {
			const order = await cowswapOrderBook?.getOrder(orderUID);
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
	}, [cowswapOrderBook]);

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (
		quoteOrder: TCowswapOrderQuoteResponse,
		shouldUsePresign: boolean,
		onSubmitted: (orderUID: string) => void
	): Promise<TExecuteResp> => {
		if (!quoteOrder) {
			return {status: 'invalid', orderUID: '', quote: quoteOrder};
		}
		const {quote} = quoteOrder;
		let buyAmountWithSlippage = quoteOrder.buyAmountWithSlippage as string;
		if (!quoteOrder.buyAmountWithSlippage) {
			buyAmountWithSlippage = getBuyAmountWithSlippage(quote, quoteOrder.request.outputToken.decimals);
		}
		const signingScheme: SigningScheme = shouldUsePresign ? SigningScheme.PRESIGN : quoteOrder.signingScheme as string as SigningScheme;
		const orderCreation: OrderCreation = {
			...quote,
			buyAmount: buyAmountWithSlippage,
			from: quoteOrder.from,
			// quoteId: quoteOrder.id, //Experimentation
			signature: quoteOrder.signature,
			signingScheme: signingScheme
		};
		try {
			const orderUID = await cowswapOrderBook?.sendOrder(orderCreation);
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
			type TError = {
				body: {
					errorType: string,
					description: string
				}
			}
			if ((error as TError)?.body?.description) {
				const err = `${(error as TError)?.body?.errorType}: ${(error as TError)?.body?.description}`;
				console.error(err);
				toast({type: 'error', content: err});
				return {status: 'invalid', orderUID: '', quote: quoteOrder, error: {message: err}};
			}
			console.error(error);
			return {status: 'invalid', orderUID: '', quote: quoteOrder, error: error as {message: string}};
		}

		return {status: 'invalid', orderUID: '', quote: quoteOrder};
	}, [checkOrderStatus, getBuyAmountWithSlippage, cowswapOrderBook, toast]);

	return useMemo((): TSolverContext => ({
		init,
		signCowswapOrder,
		execute
	}), [init, signCowswapOrder, execute]);
}

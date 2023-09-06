import {useCallback, useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {ethers} from 'ethers';
import {TPossibleStatus} from 'utils/types';
import {OrderBookApi, SigningScheme} from '@cowprotocol/cow-sdk';
import {useMountEffect} from '@react-hookz/web';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {isBebopOrder, isCowswapOrder} from './assertSolver';
import {getValidTo} from './helperWithSolver';
import {retrieveQuoteFromBebop, retrieveQuoteFromCowswap} from './retrieveQuote';
import {signQuoteFromCowswap} from './signQuote';

import type {Maybe, TOrderQuoteError,TRequest,TRequestArgs} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {OrderCreation, SigningResult} from '@cowprotocol/cow-sdk';
import type {TGetQuote} from './retrieveQuote';

type TInit = {
	estimateOut: TNormalizedBN,
	quoteResponse?: TRequest
	isSuccess: boolean,
	error?: TOrderQuoteError
}
type TCheckOrder = {
	status: TPossibleStatus,
	isSuccessful: boolean,
	error?: Error
}
type TExecuteResp = {
	status: TPossibleStatus,
	orderUID: string,
	quote: TRequest,
	error?: {message: string}
}
type TSolverContext = {
	getQuote: (args: TRequestArgs) => Promise<TInit>;
	signOrder: (quote: TRequest, key: TAddress) => Promise<SigningResult>;
	execute: (quoteOrder: TRequest, key: TAddress, shouldUsePresign: boolean, onSubmitted: (orderUID: string) => void) => Promise<TExecuteResp>;
}

export function getSpender({chainID}: {chainID: number}): TAddress {
	switch (chainID) {
		case 1:
			return toAddress(process.env.COWSWAP_SPENDER_ADDRESS);
		case 137:
			return toAddress(process.env.BEBOP_SPENDER_ADDRESS);
	}
	return toAddress(process.env.COWSWAP_SPENDER_ADDRESS);

}

export function useSolverCowswap(): TSolverContext {
	const {slippage} = useSweepooor();
	const {isWalletSafe} = useWeb3();
	const {safeChainID} = useChainID();
	const [cowswapOrderBook, set_cowswapOrderBook] = useState<Maybe<OrderBookApi>>();
	const maxIterations = 1000; // 1000 * up to 3 seconds = 3000 seconds = 50 minutes

	/* 🔵 - SmolDapp *******************************************************************************
	** Depending on the solver to use, we may need to initialize a bunch of elements.
	** Possible solvers are:
	** - Cowswap for Ethereum
	** - Bebop for Polygon and Arbitrum
	**********************************************************************************************/
	useMountEffect((): void => {
		set_cowswapOrderBook(new OrderBookApi({chainId: 1}));
	});

	const _getQuote = useCallback(async (
		request: TRequestArgs
	): Promise<TGetQuote> => {
		if (request.inputAmounts.length === 0 || request.inputTokens.length === 0) {
			return ({quoteResponse: undefined, feeAmount: 0n, error: undefined});
		}
		if (request.inputAmounts.length !== request.inputTokens.length) {
			return ({quoteResponse: undefined, feeAmount: 0n, error: undefined});
		}
		switch (safeChainID) {
			case 1:
				if (request.inputAmounts.length === 1 && request.inputTokens.length === 1) {
					return await retrieveQuoteFromCowswap({
						request,
						sellToken: toAddress(request.inputTokens[0].address),
						buyToken: toAddress(request.outputToken.address),
						from: toAddress(request.from),
						receiver: toAddress(request.receiver),
						amount: toNormalizedBN(request.inputAmounts[0], request.inputTokens[0].decimals),
						isWalletSafe
					});
				}
				return ({quoteResponse: undefined, feeAmount: 0n, error: undefined});
			case 137:
				return await retrieveQuoteFromBebop({
					request,
					sellTokens: request.inputTokens.map(({address}): TAddress => toAddress(address)),
					buyTokens: [toAddress(request.outputToken.address)],
					from: toAddress(request.from),
					receiver: toAddress(request.receiver),
					amounts: request.inputAmounts.map((value, index): TNormalizedBN => (
						toNormalizedBN(value, request.inputTokens[index].decimals)
					)),
					isWalletSafe
				});
			default:
				return ({quoteResponse: undefined, feeAmount: 0n, error: undefined});
		}
	}, [isWalletSafe, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** A slippage of 1% per default is set to avoid the transaction to fail due to price
	** fluctuations. The buyAmountWithSlippage is used to request this amount instead of the
	** original buyAmount.
	**********************************************************************************************/
	const getBuyAmountWithSlippage = useCallback((amount: bigint, decimals: number): string => {
		const buyAmount = Number(ethers.utils.formatUnits(amount, decimals));
		const withSlippage = ethers.utils.parseUnits((buyAmount * (1 - Number((slippage?.value || 0) / 100))).toFixed(decimals), decimals);
		return withSlippage.toString();
	}, [slippage.value]);

	/* 🔵 - Yearn Finance **************************************************************************
	** getQuote will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call _getQuote to get the current quote for the provided request.current.
	**********************************************************************************************/
	const getQuote = useCallback(async (_request: TRequestArgs): Promise<TInit> => {
		const decimals = _request?.outputToken?.decimals || 18;
		const sellTokenAddress = toAddress(_request?.inputTokens[0]?.address);
		if (safeChainID !== 1 && safeChainID !== 137) {
			return {isSuccess: false, estimateOut: toNormalizedBN(0)};
		}

		const {quoteResponse, feeAmount, error} = await _getQuote(_request);
		if (!quoteResponse || error) {
			const estimateOut = toNormalizedBN(toBigInt(feeAmount), decimals);
			return {isSuccess: false, estimateOut, quoteResponse, error};
		}


		if (isCowswapOrder(quoteResponse)) {
			const buyAmountWithSlippage = getBuyAmountWithSlippage(
				toBigInt(quoteResponse.quote[sellTokenAddress].quote.buyAmount),
				quoteResponse.quote[sellTokenAddress].buyToken.decimals
			);
			const estimateOut = toNormalizedBN(buyAmountWithSlippage || 0, decimals);
			quoteResponse.quote[sellTokenAddress].buyAmountWithSlippage = buyAmountWithSlippage;
			quoteResponse.quote[sellTokenAddress].expirationTimestamp = Math.round(
				(new Date(quoteResponse.quote[sellTokenAddress].expiration).getTime() / 1000)
			);

			return {isSuccess: true, quoteResponse, estimateOut};
		}

		if (isBebopOrder(quoteResponse)) {
			const estimateOut = quoteResponse.quote[sellTokenAddress].buyToken.amount;
			return {isSuccess: true, quoteResponse, estimateOut};
		}

		const value = toNormalizedBN(toBigInt(feeAmount), decimals);
		return {isSuccess: false, estimateOut: value};
	}, [getBuyAmountWithSlippage, _getQuote, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** signOrder is used to sign the order with the user's wallet. The signature is used
	** to execute the order.
	** If shouldUsePresign is set to true, the signature is not required and the approval is
	** skipped. This should only be used for debugging purposes.
	**********************************************************************************************/
	const signOrder = useCallback(async (
		quoteOrder: TRequest,
		key: TAddress
	): Promise<SigningResult> => {
		if (isCowswapOrder(quoteOrder)) {
			const buyAmountWithSlippage = getBuyAmountWithSlippage(
				toBigInt(quoteOrder.quote[key].quote.buyAmount),
				quoteOrder.quote[key].buyToken.decimals
			);
			return signQuoteFromCowswap({
				quoteOrder: quoteOrder.quote[key],
				safeChainID,
				amountWithSlippage: buyAmountWithSlippage
			});
		}

		if (isBebopOrder(quoteOrder)) {
			console.warn('TODO: Not implemented yet');
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
				return ({status: TPossibleStatus.COWSWAP_FULFILLED, isSuccessful: true});
			}
			if (order?.status === 'cancelled') {
				return ({status: TPossibleStatus.COWSWAP_CANCELLED, isSuccessful: false, error: new Error('TX fail because the order was not fulfilled')});
			}
			if (order?.status === 'expired' || validTo < (new Date().valueOf() / 1000)) {
				return ({status: TPossibleStatus.COWSWAP_EXPIRED, isSuccessful: false, error: new Error('TX fail because the order expired')});
			}
			// Sleep for 3 seconds before checking the status again
			await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 3000));
		}
		return ({status: TPossibleStatus.COWSWAP_EXPIRED, isSuccessful: false, error: new Error('TX fail because the order expired')});
	}, [cowswapOrderBook]);

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (
		quoteOrder: TRequest,
		key: TAddress,
		shouldUsePresign: boolean,
		onSubmitted: (orderUID: string) => void
	): Promise<TExecuteResp> => {
		if (!quoteOrder) {
			return {status: TPossibleStatus.INVALID, orderUID: '', quote: quoteOrder};
		}

		if (isCowswapOrder(quoteOrder)) {
			const quote = quoteOrder.quote[key];
			const buyAmountWithSlippage = getBuyAmountWithSlippage(
				toBigInt(quoteOrder.quote[key].quote.buyAmount),
				quoteOrder.quote[key].buyToken.decimals
			);
			const signingScheme: SigningScheme = (
				shouldUsePresign ?
					SigningScheme.PRESIGN
					: quote.signingScheme as string as SigningScheme
			);
			const orderCreation: OrderCreation = {
				...quote.quote,
				buyAmount: buyAmountWithSlippage,
				from: quote.from,
				// quoteId: quoteOrder.id, //Experimentation
				signature: quote.signature,
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
						return {status: TPossibleStatus.PENDING, orderUID, quote: quoteOrder};
					}
					const {status, error} = await checkOrderStatus(orderUID, getValidTo(quoteOrder, key));
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
				return {status: TPossibleStatus.INVALID, orderUID: '', quote: quoteOrder, error: {message: err}};
			}
			console.error(error);
			return {status: TPossibleStatus.INVALID, orderUID: '', quote: quoteOrder, error: error as {message: string}};
			}
		}

		if (isBebopOrder(quoteOrder)) {
			console.warn('TODO: Not implemented yet');
		}

		return {status: TPossibleStatus.INVALID, orderUID: '', quote: quoteOrder};
	}, [checkOrderStatus, cowswapOrderBook, getBuyAmountWithSlippage]);

	return useMemo((): TSolverContext => ({
		getQuote,
		signOrder,
		execute
	}), [getQuote, signOrder, execute]);
}

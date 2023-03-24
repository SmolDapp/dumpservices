import {useCallback, useMemo} from 'react';
import {ethers} from 'ethers';
import axios from 'axios';
import {domain, OrderKind, SigningScheme, signOrder} from '@gnosis.pm/gp-v2-contracts';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useLocalStorage} from '@yearn-finance/web-lib/hooks/useLocalStorage';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';

import type {BigNumber} from 'ethers';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {Order, QuoteQuery} from '@gnosis.pm/gp-v2-contracts';

type TPossibleStatus = 'pending' | 'expired' | 'fulfilled' | 'cancelled' | 'invalid'
type TToken = {
	label: string;
	symbol: string;
	decimals: number;
	value: string;
	icon?: ReactElement;
}
type TInitSolverArgs = {
	from: TAddress,
	inputToken: TToken
	outputToken: TToken
	inputAmount: BigNumber
}
export type TCowQuote = {
	quote: Order;
	request: TInitSolverArgs,
	from: string;
	expiration: string;
	signature: string;
	id: number;
	inputTokenSymbol: string;
	inputTokenDecimals: number,
	outputTokenSymbol: string;
	outputTokenDecimals: number,
	orderUID?: string,
	orderStatus?: TPossibleStatus,
}
type TSolverContext = {
	init: (args: TInitSolverArgs) => Promise<[TNormalizedBN, TCowQuote | undefined, boolean, Error | undefined]>;
	signCowswapOrder: (quote: TCowQuote) => Promise<string>;
	execute: (quoteOrder: TCowQuote, shouldUsePresign: boolean, onSubmitted: (orderUID: string) => void) => Promise<TPossibleStatus>;
}

const	VALID_TO_MN = 60;
export function useSolverCowswap(): TSolverContext {
	const {address, provider} = useWeb3();
	const {toast} = yToast();
	const maxIterations = 1000; // 1000 * up to 3 seconds = 3000 seconds = 50 minutes
	const [zapSlippage] = useLocalStorage<number>('migratooor/zap-slippage', 0.1);

	const getQuote = useCallback(async (
		request: TInitSolverArgs,
		shouldPreventErrorToast = false
	): Promise<[TCowQuote | undefined, BigNumber, Error | undefined]> => {
		const	quote: QuoteQuery = ({
			from: request.from, // receiver
			sellToken: toAddress(request.inputToken.value), // token to spend
			buyToken: toAddress(request.outputToken.value), // token to receive
			receiver: request.from, // always the same as from
			appData: process.env.COWSWAP_APP_DATA || '',
			kind: OrderKind.SELL, // always sell
			partiallyFillable: false, // always false
			validTo: 0,
			sellAmountBeforeFee: formatBN(request?.inputAmount || 0).toString() // amount to sell, in wei
		});

		const canExecuteFetch = (
			!(isZeroAddress(quote.from) || isZeroAddress(quote.sellToken) || isZeroAddress(quote.buyToken))
			&& !formatBN(request?.inputAmount || 0).isZero()
		);
		if (canExecuteFetch) {
			quote.validTo = Math.round((new Date().setMinutes(new Date().getMinutes() + VALID_TO_MN) / 1000));
			try {
				const {data: result} = await axios.post('https://api.cow.fi/mainnet/api/v1/quote', quote);
				if (result) {
					result.inputTokenDecimals = request.inputToken.decimals;
					result.outputTokenDecimals = request.outputToken.decimals;
					result.inputTokenSymbol = request.inputToken.symbol;
					result.outputTokenSymbol = request.outputToken.symbol;
				}
				return ([result, Zero, undefined]);
			} catch (error) {
				const	_error = error as any;
				console.error(error);
				if (shouldPreventErrorToast) {
					return [undefined, formatBN(_error?.response?.data?.data?.fee_amount || 0), _error?.response?.data];
				}
				const	message = `Zap not possible. Try again later or pick another token. ${_error?.response?.data?.description ? `(Reason: [${_error?.response?.data?.description}])` : ''}`;
				toast({type: 'error', content: message});
				// _error?.response?.data?.data?.fee_amount
				return [undefined, formatBN(_error?.response?.data?.data?.fee_amount || 0), _error?.response?.data];
			}
		}
		return [undefined, formatBN(0), undefined];
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	/* 🔵 - Yearn Finance **************************************************************************
	** A slippage of 1% per default is set to avoid the transaction to fail due to price
	** fluctuations. The buyAmountWithSlippage is used to request this amount instead of the
	** original buyAmount.
	**********************************************************************************************/
	const getBuyAmountWithSlippage = useCallback((quote: Order, decimals: number): string => {
		const buyAmount = Number(ethers.utils.formatUnits(quote.buyAmount, decimals));
		const withSlippage = ethers.utils.parseUnits((buyAmount * (1 - Number(zapSlippage / 100))).toFixed(decimals), decimals);
		return withSlippage.toString();
	}, [zapSlippage]);

	/* 🔵 - Yearn Finance **************************************************************************
	** init will be called when the cowswap solver should be used to perform the desired swap.
	** It will set the request to the provided value, as it's required to get the quote, and will
	** call getQuote to get the current quote for the provided request.current.
	**********************************************************************************************/
	const init = useCallback(async (_request: TInitSolverArgs): Promise<[
		TNormalizedBN,
		TCowQuote | undefined,
		boolean,
		Error | undefined
	]> => {
		const [quote, minFeeAmount, error] = await getQuote(_request);
		if (quote) {
			const buyAmountWithSlippage = getBuyAmountWithSlippage(quote.quote, _request?.outputToken?.decimals || 18);
			quote.request = _request;
			return [
				toNormalizedBN(buyAmountWithSlippage || 0, _request?.outputToken?.decimals || 18),
				quote,
				true,
				error
			];
		}
		return [
			toNormalizedBN(minFeeAmount || 0, _request?.inputToken?.decimals || 18),
			undefined,
			false,
			error
		];
	}, [getBuyAmountWithSlippage, getQuote]);

	/* 🔵 - Yearn Finance **************************************************************************
	** signCowswapOrder is used to sign the order with the user's wallet. The signature is used
	** to execute the order.
	** If shouldUsePresign is set to true, the signature is not required and the approval is
	** skipped. This should only be used for debugging purposes.
	**********************************************************************************************/
	const	signCowswapOrder = useCallback(async (quoteOrder: TCowQuote): Promise<string> => {
		if (process.env.SHOULD_USE_PRESIGN) {
			//sleep 1 second to simulate the signing process
			await new Promise(async (resolve): Promise<NodeJS.Timeout> => setTimeout(resolve, 1000));
			return toAddress(address || '');
		}

		//We need to sign the message WITH THE SLIPPAGE, in order to get the correct signature
		const	{quote} = quoteOrder;
		const	buyAmountWithSlippage = getBuyAmountWithSlippage(quote, quoteOrder.outputTokenDecimals);

		const	signer = provider.getSigner();
		const	rawSignature = await signOrder(
			domain(1, toAddress(process.env.COWSWAP_GPV2SETTLEMENT_ADDRESS)),
			{...quote, buyAmount: buyAmountWithSlippage},
			signer,
			SigningScheme.EIP712
		);
		return ethers.utils.joinSignature(rawSignature.data);
	}, [getBuyAmountWithSlippage, provider, address]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Cowswap orders have a validity period and the return value on submit is not the execution
	** status of the order. This method is used to check the status of the order and returns a
	** boolean value indicating whether the order was successful or not.
	** It will timeout once the order is no longer valid or after 50 minutes (max should be 30mn)
	**********************************************************************************************/
	const	checkOrderStatus = useCallback(async (orderUID: string, validTo: number): Promise<{status: TPossibleStatus, isSuccessful: boolean, error?: Error}> => {
		for (let i = 0; i < maxIterations; i++) {
			const {data: order} = await axios.get(`https://api.cow.fi/mainnet/api/v1/orders/${orderUID}`);
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
	}, []);

	/* 🔵 - Yearn Finance **************************************************************************
	** execute will send the post request to execute the order and wait for it to be executed, no
	** matter the result. It returns a boolean value indicating whether the order was successful or
	** not.
	**********************************************************************************************/
	const execute = useCallback(async (
		quoteOrder: TCowQuote,
		shouldUsePresign = Boolean(process.env.SHOULD_USE_PRESIGN),
		onSubmitted: (orderUID: string) => void
	): Promise<TPossibleStatus> => {
		if (!quoteOrder) {
			return 'invalid';
		}
		const	{quote} = quoteOrder;
		try {
			//We need to reapply the slippage for the signature to match
			const	buyAmountWithSlippage = getBuyAmountWithSlippage(quote, quoteOrder.outputTokenDecimals);
			const	{data: orderUID} = await axios.post('https://api.cow.fi/mainnet/api/v1/orders', {
				...quote,
				buyAmount: buyAmountWithSlippage,
				from: quoteOrder.from,
				quoteId: quoteOrder.id,
				signature: quoteOrder.signature,
				signingScheme: shouldUsePresign ? 'presign' : 'eip712'
			});
			if (orderUID) {
				onSubmitted?.(orderUID);
				if (shouldUsePresign) {
					return 'pending';
				}
				const {status, error} = await checkOrderStatus(orderUID, quote.validTo as number);
				console.error(error);
				return status;
			}
		} catch (_error) {
			console.error(_error);
			return 'invalid';
		}
		return 'invalid';
	}, [checkOrderStatus, getBuyAmountWithSlippage]);

	return useMemo((): TSolverContext => ({
		init,
		signCowswapOrder,
		execute
	}), [init, signCowswapOrder, execute]);
}

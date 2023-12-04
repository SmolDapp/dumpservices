import React, {useCallback, useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {getTypedCowswapQuote} from 'hooks/assertSolver';
import {
	addQuote,
	assignSignature,
	getSellAmount,
	setInvalidQuote,
	setPendingQuote,
	setRefreshingQuote,
	setStatusQuote
} from 'hooks/handleQuote';
import {useAsyncTrigger} from 'hooks/useAsyncEffect';
import {getSpender, useSolver} from 'hooks/useSolver';
import {approveERC20, isApprovedERC20} from 'utils/actions';
import notify from 'utils/notifier';
import {TStatus} from 'utils/types';
import {IconSpinner} from '@icons/IconSpinner';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TCowswapOrderQuoteResponse, TRequest} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';

function CowswapButtons({
	approvals,
	onUpdateApprovalStep,
	onUpdateSignStep,
	onUpdateExecuteStep
}: {
	approvals: TDict<TStatus>;
	onUpdateApprovalStep: Dispatch<SetStateAction<TDict<TStatus>>>;
	onUpdateSignStep: Dispatch<SetStateAction<TDict<TStatus>>>;
	onUpdateExecuteStep: Dispatch<SetStateAction<TDict<TStatus>>>;
}): ReactElement {
	const {provider} = useWeb3();
	const {refresh} = useWallet();
	const {safeChainID} = useChainID();
	const {quotes, set_quotes} = useSweepooor();
	const [isApproving, set_isApproving] = useState(false);
	const [isSigning, set_isSigning] = useState(false);
	const [isRefreshingQuotes, set_isRefreshingQuotes] = useState(false);
	const solver = useSolver();

	/* 🔵 - Yearn Finance **************************************************************************
	 ** areAllApproved and areAllSigned are used to determine if all the selected tokens have been
	 ** approved and signed.
	 ** If so, the onSendOrders function will be called.
	 **********************************************************************************************/
	const areAllApproved = useMemo((): boolean => {
		if (Object.values(quotes?.quote || {}).length === 0) {
			return false;
		}
		const isOk = true;
		for (const token of Object.keys(quotes?.quote || {})) {
			if (
				!approvals[toAddress(token)] ||
				approvals[toAddress(token)] === TStatus.UNDETERMINED ||
				approvals[toAddress(token)] === TStatus.INVALID ||
				approvals[toAddress(token)] === TStatus.PENDING
			) {
				return false;
			}
		}
		return isOk;
	}, [approvals, quotes]);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** Every time the selected tokens change (either a new token is added or the amount is changed),
	 ** we will check if the allowance is enough for the amount to be swept.
	 **********************************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		const allQuotes = getTypedCowswapQuote(quotes);
		for (const token of Object.keys(allQuotes.quote)) {
			const tokenAddress = toAddress(token);
			try {
				const isApproved = await isApprovedERC20({
					connector: provider,
					chainID: safeChainID,
					contractAddress: tokenAddress,
					spenderAddress: getSpender({chainID: safeChainID}),
					amount: getSellAmount(quotes, tokenAddress).raw
				});
				onUpdateApprovalStep(prev => ({...prev, [token]: isApproved ? TStatus.VALID : TStatus.UNDETERMINED}));
			} catch (error) {
				console.error(error);
			}
		}
	}, [quotes, provider, safeChainID, onUpdateApprovalStep]);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** onApproveERC20 will loop through all the selected tokens and approve them if needed.
	 ** It will also update the approveStatus state to keep track of the approvals.
	 ** If the token is already approved, state will be updated to true but approval will not be
	 ** performed.
	 **********************************************************************************************/
	const onApproveERC20 = useCallback(async (): Promise<void> => {
		if (!quotes) {
			return;
		}
		onUpdateApprovalStep({});
		set_isApproving(true);

		const allQuotes = getTypedCowswapQuote(quotes);
		for (const [token, quote] of Object.entries(allQuotes.quote)) {
			const tokenAddress = toAddress(token);
			const quoteID = quote?.id;
			if (!quoteID) {
				console.warn(`[CowSwap] - No quote for ${tokenAddress}`);
				continue;
			}
			try {
				const isApproved = await isApprovedERC20({
					connector: provider,
					chainID: safeChainID,
					contractAddress: tokenAddress,
					spenderAddress: getSpender({chainID: safeChainID}),
					amount: getSellAmount(quotes, tokenAddress).raw
				});

				if (!isApproved) {
					onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.PENDING}));
					const result = await approveERC20({
						connector: provider,
						chainID: safeChainID,
						contractAddress: tokenAddress,
						spenderAddress: getSpender({chainID: safeChainID}),
						amount: getSellAmount(quotes, tokenAddress).raw
					});
					if (result.isSuccessful) {
						onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.VALID}));
					} else {
						onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
					}
				} else {
					onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.VALID}));
				}
			} catch (error) {
				console.error(error);
				onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.UNDETERMINED}));
			}
		}
		set_isApproving(false);
	}, [onUpdateApprovalStep, provider, quotes, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** onSendOrders send the orders to the cowswap API, skipping the ones that are already sent (
	 ** pending or fulfilled).
	 ** It will also request an update of the signature if it appears to not be signed, and will
	 ** update the quote to append the orderUID which will be used to track execution of the order,
	 ** aka from pending to status (fulfilled, cancelled, etc)
	 **********************************************************************************************/
	const onSendOrders = useCallback(async (): Promise<void> => {
		if (!areAllApproved) {
			toast({type: 'error', content: '[CowSwap] - Please approve all tokens before sending orders'});
			return;
		}
		if (!quotes) {
			console.warn(`[CowSwap] - No quotes available`);
			return;
		}
		set_isSigning(true);
		const executedQuotes: TCowswapOrderQuoteResponse[] = [];
		const allQuotes = getTypedCowswapQuote(quotes);
		for (const [token, quote] of Object.entries(allQuotes.quote)) {
			const tokenAddress = toAddress(token);
			const quoteID = quote?.id;
			if (!quoteID) {
				console.warn(`[CowSwap] - No quote for ${token}`); //should not happen
				continue;
			}
			if (quote.orderUID && ['fulfilled', 'pending'].includes(quote?.orderStatus || '')) {
				continue; //skip already sent
			}

			/* 🔵 - Yearn Finance ******************************************************************
			 ** Sign the current quote
			 ***************************************************************************************/
			try {
				onUpdateSignStep(prev => ({...prev, [tokenAddress]: TStatus.PENDING}));
				const {signature, signingScheme} = await solver.signOrder(quotes, tokenAddress);
				quote.signature = signature;
				quote.signingScheme = signingScheme;
				onUpdateSignStep(prev => ({...prev, [tokenAddress]: TStatus.VALID}));
				set_quotes((prev): TRequest => assignSignature(prev, tokenAddress, signature, signingScheme));
			} catch (error) {
				onUpdateSignStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
				continue;
			}

			/* 🔵 - Yearn Finance ******************************************************************
			 ** Send the current quote to the cowswap API
			 ***************************************************************************************/
			try {
				onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.PENDING}));
				solver
					.execute(quotes, tokenAddress, Boolean(process.env.SHOULD_USE_PRESIGN), (orderUID): void => {
						set_quotes((prev): TRequest => setPendingQuote(prev, tokenAddress, orderUID));
					})
					.then(async ({status, orderUID, error}): Promise<void> => {
						if (error?.message) {
							if (error?.message?.includes('InsufficientAllowance')) {
								onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
								onUpdateSignStep(prev => ({...prev, [tokenAddress]: TStatus.UNDETERMINED}));
								onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.UNDETERMINED}));
								set_quotes((prev): TRequest => setInvalidQuote(prev, tokenAddress, orderUID));
							} else {
								onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
								set_quotes((prev): TRequest => setInvalidQuote(prev, tokenAddress, orderUID));
							}
						} else {
							executedQuotes.push({
								...quote,
								orderUID: orderUID,
								orderStatus: status
							} as unknown as TCowswapOrderQuoteResponse);
							onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.VALID}));
							set_quotes((prev): TRequest => setStatusQuote(prev, tokenAddress, status, orderUID));
							refresh([
								{
									token: toAddress(quote.quote.buyToken),
									decimals: quote.buyToken.decimals,
									name: quote.buyToken.name,
									symbol: quote.buyToken.symbol
								},
								{
									token: toAddress(quote.quote.sellToken),
									decimals: quote.sellToken.decimals,
									name: quote.sellToken.name,
									symbol: quote.sellToken.symbol
								}
							]);
						}
					});
			} catch (error) {
				onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
				set_quotes((prev): TRequest => setInvalidQuote(prev, tokenAddress, ''));
			}
		}

		notify(executedQuotes, 'COWSWAP', 'EOA', '');
		set_isSigning(false);
	}, [
		areAllApproved,
		quotes,
		onUpdateSignStep,
		solver,
		set_quotes,
		onUpdateExecuteStep,
		onUpdateApprovalStep,
		refresh
	]);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** Sometimes, the quotes are not valid anymore, or we just want to refresh them after a long
	 ** time. This function will refresh all the quotes, and update the UI accordingly.
	 **********************************************************************************************/
	const onRefreshAllQuotes = useCallback(async (): Promise<void> => {
		if (!quotes) {
			return;
		}

		set_isRefreshingQuotes(true);
		for (const [key, currentQuote] of Object.entries(getTypedCowswapQuote(quotes).quote)) {
			if (currentQuote.orderUID && ['fulfilled', 'pending'].includes(currentQuote?.orderStatus || '')) {
				return;
			}

			set_quotes((prev): TRequest => setRefreshingQuote(prev, toAddress(key)));
			const {quoteResponse} = await solver.getQuote({
				from: toAddress(currentQuote.from),
				receiver: toAddress(currentQuote.quote.receiver),
				inputTokens: [currentQuote.sellToken],
				outputToken: currentQuote.buyToken,
				inputAmounts: [getSellAmount(quotes, toAddress(key)).raw],
				inputBalances: [0n] //Non relevant here
			});
			if (quoteResponse) {
				set_quotes((prev): TRequest => addQuote(prev, quoteResponse));
			}
		}
		set_isRefreshingQuotes(false);
	}, [solver, quotes, set_quotes]);

	return (
		<div className={'flex flex-row items-center space-x-4'}>
			<button
				id={'TRIGGER_ALL_REFRESH'}
				onClick={onRefreshAllQuotes}
				className={'relative cursor-pointer text-xs text-neutral-400 hover:text-neutral-900'}>
				<p className={`transition-opacity ${isRefreshingQuotes ? 'opacity-0' : 'opacity-100'}`}>
					{'Refresh all quotes'}
				</p>
				<span
					className={`absolute inset-0 flex w-full items-center justify-center transition-opacity ${
						isRefreshingQuotes ? 'opacity-100' : 'opacity-0'
					}`}>
					<IconSpinner />
				</span>
			</button>
			<Button
				id={'TRIGGER_SWEEPOOOR'}
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isApproving}
				isDisabled={Object.values(quotes?.quote || {}).length === 0 || areAllApproved}
				onClick={onApproveERC20}>
				{'Approve'}
			</Button>
			<Button
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isSigning}
				isDisabled={Object.values(quotes?.quote || {}).length === 0 || !areAllApproved}
				onClick={onSendOrders}>
				{'Sign'}
			</Button>
		</div>
	);
}

export {CowswapButtons};

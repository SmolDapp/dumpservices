import React, {useCallback, useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {getTypedBebopQuote} from 'hooks/assertSolver';
import {
	addQuote,
	assignSignature,
	setInvalidQuote,
	setPendingQuote,
	setRefreshingQuote,
	setStatusQuote
} from 'hooks/handleQuote';
import {getSellAmount} from 'hooks/helperWithSolver';
import {useAsyncTrigger} from 'hooks/useAsyncEffect';
import {getSpender, useSolver} from 'hooks/useSolver';
import {approveERC20, isApprovedERC20} from 'utils/actions';
import {TPossibleStatus, TStatus} from 'utils/types';
import {serialize} from 'wagmi';
import {IconCheck} from '@icons/IconCheck';
import {IconSpinner} from '@icons/IconSpinner';
import {useDeepCompareMemo} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {Maybe, TBebopOrderQuoteResponse, TPossibleSolverQuote, TRequest} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';

function BebopApproveButton({
	areAllApproved,
	onUpdateApprovalStep
}: {
	areAllApproved: boolean;
	onUpdateApprovalStep: Dispatch<SetStateAction<TDict<TStatus>>>;
}): ReactElement {
	const {provider} = useWeb3();
	const {safeChainID} = useChainID();
	const {quotes} = useSweepooor();
	const [isApproving, set_isApproving] = useState(false);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** Every time the selected tokens change (either a new token is added or the amount is changed),
	 ** we will check if the allowance is enough for the amount to be swept.
	 **********************************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		const allQuotes = getTypedBebopQuote(quotes);
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

		const allQuotes = getTypedBebopQuote(quotes);
		for (const [token, quote] of Object.entries(allQuotes.quote)) {
			const tokenAddress = toAddress(token);
			const quoteID = quote?.id;
			if (!quoteID) {
				console.warn(`No quote for ${tokenAddress}`);
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

	return (
		<Button
			id={'TRIGGER_SWEEPOOOR'}
			className={'yearn--button !w-fit !px-6 !text-sm'}
			isBusy={isApproving}
			isDisabled={
				Object.values(quotes?.quote || {}).length === 0 ||
				Object.values(quotes?.quote || {}).every(q => q.orderStatus === TPossibleStatus.BEBOP_CONFIRMED) ||
				areAllApproved
			}
			onClick={onApproveERC20}>
			{'Approve'}
		</Button>
	);
}

function BebopSignButton({
	onUpdateSignStep
}: {
	onUpdateSignStep: Dispatch<SetStateAction<TDict<TStatus>>>;
}): ReactElement {
	const {quotes, set_quotes} = useSweepooor();
	const [isSigning, set_isSigning] = useState(false);
	const solver = useSolver();

	/* 🔵 - Yearn Finance **************************************************************************
	 ** onSignOrders send the orders to the bebop API, skipping the ones that are already sent (
	 ** pending or fulfilled).
	 ** It will also request an update of the signature if it appears to not be signed, and will
	 ** update the quote to append the orderUID which will be used to track execution of the order,
	 ** aka from pending to status (fulfilled, cancelled, etc)
	 **********************************************************************************************/
	const onSignOrders = useCallback(async (): Promise<void> => {
		if (!quotes) {
			console.warn(`no quote`);
			return;
		}
		set_isSigning(true);
		const allQuotes = getTypedBebopQuote(quotes);
		for (const [token, quote] of Object.entries(allQuotes.quote)) {
			const tokenAddress = toAddress(token);
			const quoteID = quote?.id;
			if (!quoteID) {
				console.warn(`No quote for ${token}`); //should not happen
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
				onUpdateSignStep(prev => ({...prev, [tokenAddress]: TStatus.VALID}));
				set_quotes((prev): Maybe<TRequest> => assignSignature(prev, tokenAddress, signature, signingScheme));
			} catch (error) {
				console.error(error);
				onUpdateSignStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
				continue;
			}
		}
		set_isSigning(false);
	}, [quotes, onUpdateSignStep, solver, set_quotes]);

	return (
		<Button
			className={'yearn--button !w-fit !px-6 !text-sm'}
			isBusy={isSigning}
			isDisabled={
				Object.values(quotes?.quote || {}).length === 0 ||
				Object.values(quotes?.quote || {}).every(q => q.orderStatus === TPossibleStatus.BEBOP_CONFIRMED)
			}
			onClick={onSignOrders}>
			<p>{'Sign'}</p>
		</Button>
	);
}

function BebopExecuteButton({
	onUpdateApprovalStep,
	onUpdateSignStep,
	onUpdateExecuteStep
}: {
	onUpdateApprovalStep: Dispatch<SetStateAction<TDict<TStatus>>>;
	onUpdateSignStep: Dispatch<SetStateAction<TDict<TStatus>>>;
	onUpdateExecuteStep: Dispatch<SetStateAction<TDict<TStatus>>>;
}): ReactElement {
	const {refresh} = useWallet();
	const {quotes, set_quotes} = useSweepooor();
	const [isExecuting, set_isExecuting] = useState(false);
	const solver = useSolver();

	/* 🔵 - Yearn Finance **************************************************************************
	 ** pending or fulfilled).
	 ** It will also request an update of the signature if it appears to not be signed, and will
	 ** update the quote to append the orderUID which will be used to track execution of the order,
	 ** aka from pending to status (fulfilled, cancelled, etc)
	 **********************************************************************************************/
	const onSendOrders = useCallback(async (): Promise<void> => {
		if (!quotes) {
			console.warn(`no quote`);
			return;
		}
		const executedQuotes: TPossibleSolverQuote[] = [];
		const allQuotes = getTypedBebopQuote(quotes);
		for (const [token, quote] of Object.entries(allQuotes.quote)) {
			const tokenAddress = toAddress(token);
			const quoteID = quote?.id;
			if (!quoteID) {
				console.warn(`No quote for ${token}`); //should not happen
				continue;
			}
			if (quote.orderUID && ['fulfilled', 'pending'].includes(quote?.orderStatus || '')) {
				continue; //skip already sent
			}

			/* 🔵 - Yearn Finance ******************************************************************
			 ** Send the current quote to the bebop API
			 ***************************************************************************************/
			try {
				set_isExecuting(true);
				onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.PENDING}));
				solver
					.execute(quotes, tokenAddress, Boolean(process.env.SHOULD_USE_PRESIGN), (orderUID): void => {
						set_quotes((prev): Maybe<TRequest> => setPendingQuote(prev, tokenAddress, orderUID));
					})
					.then(async ({status, orderUID, error}): Promise<void> => {
						set_isExecuting(false);
						if (error?.message) {
							if (error?.message?.includes('InsufficientAllowance')) {
								onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
								onUpdateSignStep(prev => ({...prev, [tokenAddress]: TStatus.UNDETERMINED}));
								onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.UNDETERMINED}));
								set_quotes((prev): Maybe<TRequest> => setInvalidQuote(prev, tokenAddress, orderUID));
							} else {
								onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
								set_quotes((prev): Maybe<TRequest> => setInvalidQuote(prev, tokenAddress, orderUID));
							}
						} else {
							executedQuotes.push({
								...quote,
								orderUID: orderUID,
								orderStatus: status
							} as unknown as TBebopOrderQuoteResponse);
							onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.VALID}));
							set_quotes((prev): Maybe<TRequest> => setStatusQuote(prev, tokenAddress, status, orderUID));
							refresh([
								{
									token: toAddress(quote.buyToken.address),
									decimals: quote.buyToken.decimals,
									name: quote.buyToken.name,
									symbol: quote.buyToken.symbol
								},
								{
									token: toAddress(quote.sellToken.address),
									decimals: quote.sellToken.decimals,
									name: quote.sellToken.name,
									symbol: quote.sellToken.symbol
								}
							]);
						}
					});
			} catch (error) {
				onUpdateExecuteStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
				set_quotes((prev): Maybe<TRequest> => setInvalidQuote(prev, tokenAddress, ''));
			}
		}
		// notify(executedQuotes, 'BEBOP', 'EOA', '');
	}, [quotes, onUpdateExecuteStep, solver, set_quotes, onUpdateSignStep, onUpdateApprovalStep, refresh]);

	return (
		<Button
			className={'yearn--button !w-fit !px-6 !text-sm'}
			isBusy={isExecuting}
			isDisabled={
				Object.values(quotes?.quote || {}).length === 0 ||
				Object.values(quotes?.quote || {}).every(q => q.signature === '')
			}
			onClick={onSendOrders}>
			{'Execute'}
		</Button>
	);
}

function BebopButtons({
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
	const {quotes, set_quotes} = useSweepooor();
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
			if (toAddress(token) === ETH_TOKEN_ADDRESS) {
				continue;
			}
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
	}, [approvals, serialize(quotes)]); // eslint-disable-line react-hooks/exhaustive-deps

	const areAllSigned = useDeepCompareMemo((): boolean => {
		if (Object.values(quotes?.quote || {}).length === 0) {
			return false;
		}
		return Object.values(quotes?.quote || {}).every(q => q.signature && q.signature !== '');
	}, [serialize(quotes)]); // eslint-disable-line react-hooks/exhaustive-deps

	const areAllExecuted = useDeepCompareMemo((): boolean => {
		if (Object.values(quotes?.quote || {}).length === 0) {
			return false;
		}
		return Object.values(quotes?.quote || {}).every(q => q.orderStatus === TPossibleStatus.BEBOP_CONFIRMED);
	}, [serialize(quotes)]); // eslint-disable-line react-hooks/exhaustive-deps

	/* 🔵 - Yearn Finance **************************************************************************
	 ** Sometimes, the quotes are not valid anymore, or we just want to refresh them after a long
	 ** time. This function will refresh all the quotes, and update the UI accordingly.
	 **********************************************************************************************/
	const onRefreshAllQuotes = useCallback(async (): Promise<void> => {
		if (!quotes) {
			return;
		}

		set_isRefreshingQuotes(true);
		for (const [key, currentQuote] of Object.entries(getTypedBebopQuote(quotes).quote)) {
			if (currentQuote.orderUID && ['fulfilled', 'pending'].includes(currentQuote?.orderStatus || '')) {
				return;
			}

			set_quotes((prev): Maybe<TRequest> => setRefreshingQuote(prev, toAddress(key)));
			const {quoteResponse} = await solver.getQuote({
				from: toAddress(currentQuote.from),
				receiver: toAddress(currentQuote.receiver),
				inputTokens: [currentQuote.sellToken],
				outputToken: currentQuote.buyToken,
				inputAmounts: [getSellAmount(quotes, toAddress(key)).raw],
				inputBalances: [0n] //Non relevant here
			});
			if (quoteResponse) {
				set_quotes((prev): Maybe<TRequest> => addQuote(prev, quoteResponse));
			}
		}
		set_isRefreshingQuotes(false);
	}, [solver, quotes, set_quotes]);

	function renderCurrentButton(): ReactElement {
		if (!areAllApproved) {
			return (
				<BebopApproveButton
					areAllApproved={areAllApproved}
					onUpdateApprovalStep={onUpdateApprovalStep}
				/>
			);
		}
		if (!areAllSigned) {
			return <BebopSignButton onUpdateSignStep={onUpdateSignStep} />;
		}
		if (!areAllExecuted) {
			return (
				<BebopExecuteButton
					onUpdateSignStep={onUpdateSignStep}
					onUpdateApprovalStep={onUpdateApprovalStep}
					onUpdateExecuteStep={onUpdateExecuteStep}
				/>
			);
		}
		return (
			<Button
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isDisabled>
				<IconCheck className={'h-4 w-4 text-neutral-0'} />
			</Button>
		);
	}

	return (
		<div className={'flex w-full flex-row items-center justify-between space-x-4'}>
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
			<div>{renderCurrentButton()}</div>
		</div>
	);
}

export {BebopButtons};

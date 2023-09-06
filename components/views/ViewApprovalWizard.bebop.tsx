import React, {useCallback, useMemo, useState} from 'react';
import ApprovalWizardItemBebop from 'components/ApprovalWizardItem.bebop';
import {IconSpinner} from 'components/icons/IconSpinner';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedBebopQuote} from 'hooks/assertSolver';
import {getSellAmount} from 'hooks/helperWithSolver';
import {getSpender, useSolverCowswap} from 'hooks/useSolverCowswap';
import {approveERC20, isApprovedERC20} from 'utils/actions';
import {TPossibleFlowStep} from 'utils/types';
import {useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {performBatchedUpdates} from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TBebopQuoteAPIResp, TToken} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';


function BebopBatchedFlow({
	approvals,
	onUpdateApprovalStep,
	onUpdateSignStep,
	onUpdateExecuteStep
}: {
	approvals: TDict<TPossibleFlowStep>,
	onUpdateApprovalStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>,
	onUpdateSignStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>,
	onUpdateExecuteStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>
}): ReactElement {
	const cowswap = useSolverCowswap();
	const {provider} = useWeb3();
	const {quotes} = useSweepooor();
	const [isApproving, set_isApproving] = useState(false);
	const [isRefreshingQuotes, set_isRefreshingQuotes] = useState(false);
	const {safeChainID} = useChainID();

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
				!approvals[toAddress(token)]
				|| approvals[toAddress(token)] === TPossibleFlowStep.UNDETERMINED
				|| approvals[toAddress(token)] === TPossibleFlowStep.INVALID
				|| approvals[toAddress(token)] === TPossibleFlowStep.PENDING
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
	useUpdateEffect((): void => {
		const allQuotes = getTypedBebopQuote(quotes);
		for (const token of Object.keys(allQuotes.quote)) {
			const tokenAddress = toAddress(token);
			isApprovedERC20({
				connector: provider,
				contractAddress: tokenAddress,
				spenderAddress: getSpender({chainID: safeChainID}),
				amount: getSellAmount(quotes, tokenAddress).raw
			}).then((isApproved): void => {
				onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({
					...prev,
					[token]: isApproved ? TPossibleFlowStep.VALID : TPossibleFlowStep.UNDETERMINED
				}));
			}).catch((error): void => {
				console.error(error);
			});
		}
	}, [quotes, provider, safeChainID]);

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
		performBatchedUpdates((): void => {
			onUpdateApprovalStep({});
			set_isApproving(true);
		});

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
					contractAddress: tokenAddress,
					spenderAddress: getSpender({chainID: safeChainID}),
					amount: getSellAmount(quotes, tokenAddress).raw
				});

				if (!isApproved) {
					onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({
						...prev,
						[tokenAddress]: TPossibleFlowStep.PENDING
					}));

					const result = await approveERC20({
						connector: provider,
						contractAddress: tokenAddress,
						spenderAddress: getSpender({chainID: safeChainID}),
						amount: getSellAmount(quotes, tokenAddress).raw
					});
					if (result.isSuccessful) {
						performBatchedUpdates((): void => {
							onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({
								...prev,
								[tokenAddress]: TPossibleFlowStep.VALID
							}));
						});
					} else {
						onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({
							...prev,
							[tokenAddress]: TPossibleFlowStep.INVALID
						}));
					}
				} else {
					onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({
						...prev,
						[tokenAddress]: TPossibleFlowStep.VALID
					}));
				}
			} catch (error) {
				console.error(error);
				onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({
					...prev,
					[tokenAddress]: TPossibleFlowStep.UNDETERMINED
				}));
			}
		}
		set_isApproving(false);
	}, [onUpdateApprovalStep, provider, quotes, safeChainID]);



	/* 🔵 - Yearn Finance **************************************************************************
	** Sometimes, the quotes are not valid anymore, or we just want to refresh them after a long
	** time. This function will refresh all the quotes, and update the UI accordingly.
	**********************************************************************************************/
	const onRefreshAllQuotes = useCallback(async (): Promise<void> => {
		set_isRefreshingQuotes(true);
		const allOrders = Object.values(getTypedBebopQuote(quotes).quote);
		const [firstQuote] = allOrders;
		const {quoteResponse} = await cowswap.getQuote({
			from: firstQuote.from,
			receiver: firstQuote.receiver,
			inputTokens: allOrders.map((order): TToken => order.sellToken),
			outputToken: firstQuote.buyToken,
			inputAmounts: allOrders.map((order): bigint => order.sellToken.amount.raw)
		});

		console.warn(quoteResponse);
		set_isRefreshingQuotes(false);
	}, [cowswap, quotes]);

	return (
		<div className={'flex flex-row items-center space-x-4'}>
			<button
				onClick={onRefreshAllQuotes}
				className={'relative cursor-pointer text-xs text-neutral-400 hover:text-neutral-900'}>
				<p className={`transition-opacity ${isRefreshingQuotes ? 'opacity-0' : 'opacity-100'}`}>{'Refresh all quotes'}</p>
				<span className={`absolute inset-0 flex w-full items-center justify-center transition-opacity ${isRefreshingQuotes ? 'opacity-100' : 'opacity-0'}`}>
					<IconSpinner />
				</span>
			</button>
			<Button
				id={'TRIGGER_SWEEPOOOR'}
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isApproving}
				isDisabled={(Object.values(quotes?.quote || {}).length === 0)}
				onClick={async (): Promise<void> => {
					set_isApproving(true);
					// await onExecuteFromGnosis();
				}}>
				{'Execute'}
			</Button>
		</div>
	);
}

function Wrapper(): ReactElement {
	const cowswap = useSolverCowswap();
	const {isWalletSafe} = useWeb3();
	const {quotes} = useSweepooor();
	const [approvalStep, set_approvalStep] = useState<TDict<TPossibleFlowStep>>({});
	const [signStep, set_signStep] = useState<TDict<TPossibleFlowStep>>({});
	const [executeStep, set_executeStep] = useState<TDict<TPossibleFlowStep>>({});
	const [aggregatedQuote, set_aggregatedQuote] = useState<TBebopQuoteAPIResp | undefined>();

	const onRetrieveAggregatedQuote = useCallback(async (): Promise<void> => {
		set_aggregatedQuote(undefined);
		const allOrders = Object.values(getTypedBebopQuote(quotes).quote);
		if (!allOrders || !allOrders[0] || allOrders[0].isRefreshing || allOrders[0].isFetching) {
			return;
		}

		const [firstQuote] = allOrders;
		const {quoteResponse} = await cowswap.getQuote({
			from: firstQuote.from,
			receiver: firstQuote.receiver,
			inputTokens: allOrders.map((order): TToken => order.sellToken),
			outputToken: firstQuote.buyToken,
			inputAmounts: allOrders.map((order): bigint => toBigInt(order.sellToken.amount.raw || 0))
		});
		console.warn(quoteResponse);
		set_aggregatedQuote(quoteResponse?.bebopAggregatedQuote);
	}, [cowswap, quotes]);

	useUpdateEffect((): void => {
		onRetrieveAggregatedQuote();
	}, [onRetrieveAggregatedQuote]);

	return (
		<>
			<ApprovalWizardItemBebop quote={aggregatedQuote} />
			<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
				<div className={'flex flex-col'} />
				<BebopBatchedFlow
					approvals={approvalStep}
					onUpdateApprovalStep={set_approvalStep}
					onUpdateSignStep={set_signStep}
					onUpdateExecuteStep={set_executeStep} />
			</div>
		</>
	);
}

export default Wrapper;

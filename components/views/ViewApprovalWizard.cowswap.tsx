import React, {useCallback, useMemo, useState} from 'react';
import ApprovalWizardItemCowswap from 'components/ApprovalWizardItem.cowswap';
import {IconSpinner} from 'components/icons/IconSpinner';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {getTypedCowswapQuote} from 'hooks/assertSolver';
import {addQuote, assignSignature, setInvalidQuote, setPendingQuote, setRefreshingQuote, setStatusQuote} from 'hooks/handleQuote';
import {getSellAmount} from 'hooks/helperWithSolver';
import {getSpender, useSolverCowswap} from 'hooks/useSolverCowswap';
import {approveERC20, isApprovedERC20} from 'utils/actions';
import notify from 'utils/notifier';
import {TPossibleFlowStep} from 'utils/types';
import {useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {performBatchedUpdates} from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {Maybe, TCowswapOrderQuoteResponse, TPossibleSolverQuote, TRequest} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';

function CowswapStandardFlow({
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
	const {provider} = useWeb3();
	const {refresh} = useWallet();
	const {safeChainID} = useChainID();
	const {quotes, set_quotes} = useSweepooor();
	const [isApproving, set_isApproving] = useState(false);
	const [isSigning, set_isSigning] = useState(false);
	const [isRefreshingQuotes, set_isRefreshingQuotes] = useState(false);
	const cowswap = useSolverCowswap();

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
		const allQuotes = getTypedCowswapQuote(quotes);
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

		const allQuotes = getTypedCowswapQuote(quotes);
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
	** onSendOrders send the orders to the cowswap API, skipping the ones that are already sent (
	** pending or fulfilled).
	** It will also request an update of the signature if it appears to not be signed, and will
	** update the quote to append the orderUID which will be used to track execution of the order,
	** aka from pending to status (fulfilled, cancelled, etc)
	**********************************************************************************************/
	const onSendOrders = useCallback(async (): Promise<void> => {
		if (!areAllApproved) {
			toast({type: 'error', content: 'Please approve all tokens before sending orders'});
			return;
		}
		if (!quotes) {
			return;
		}
		set_isSigning(true);
		const executedQuotes: TPossibleSolverQuote[] = [];
		const allQuotes = getTypedCowswapQuote(quotes);
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
				onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({
					...prev,
					[tokenAddress]: TPossibleFlowStep.PENDING
				}));
				const {signature, signingScheme} = await cowswap.signOrder(quotes, tokenAddress);
				quote.signature = signature;
				quote.signingScheme = signingScheme;
				performBatchedUpdates((): void => {
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({
						...prev,
						[tokenAddress]: TPossibleFlowStep.VALID
					}));
					set_quotes((prev): Maybe<TRequest> => (
						assignSignature(prev, tokenAddress, signature, signingScheme)
					));
				});
			} catch (error) {
				onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({
					...prev,
					[tokenAddress]: TPossibleFlowStep.INVALID
				}));
				continue;
			}

			/* 🔵 - Yearn Finance ******************************************************************
				** Send the current quote to the cowswap API
				***************************************************************************************/
			try {
				onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({
					...prev,
					[tokenAddress]: TPossibleFlowStep.PENDING
				}));
				cowswap.execute(
					quotes,
					tokenAddress,
					Boolean(process.env.SHOULD_USE_PRESIGN),
					(orderUID): void => {
						set_quotes((prev): Maybe<TRequest> => setPendingQuote(prev, tokenAddress, orderUID));
					}
				).then(async ({status, orderUID, error}): Promise<void> => {
					if (error?.message) {
						if (error?.message?.includes('InsufficientAllowance')) {
							performBatchedUpdates((): void => {
								onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({
									...prev,
									[tokenAddress]: TPossibleFlowStep.INVALID
								}));
								onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({
									...prev,
									[tokenAddress]: TPossibleFlowStep.UNDETERMINED
								}));
								onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({
									...prev,
									[tokenAddress]: TPossibleFlowStep.UNDETERMINED
								}));
								set_quotes((prev): Maybe<TRequest> => (
									setInvalidQuote(prev, tokenAddress, orderUID)
								));
							});
						} else {
							performBatchedUpdates((): void => {
								onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({
									...prev,
									[tokenAddress]: TPossibleFlowStep.INVALID
								}));
								set_quotes((prev): Maybe<TRequest> => (
									setInvalidQuote(prev, tokenAddress, orderUID)
								));
							});
						}
					} else {
						executedQuotes.push({
							...quote,
							orderUID: orderUID,
							orderStatus: status
						} as unknown as TCowswapOrderQuoteResponse);
						onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({
							...prev,
							[tokenAddress]: TPossibleFlowStep.VALID
						}));
						set_quotes((prev): Maybe<TRequest> => (
							setStatusQuote(prev, tokenAddress, status, orderUID)
						));
						refresh([
							{
								token: toAddress(quote.quote.buyToken),
								decimals: quote.buyToken.decimals,
								name: quote.buyToken.name,
								symbol: quote.buyToken.symbol
							}, {
								token: toAddress(quote.quote.sellToken),
								decimals: quote.sellToken.decimals,
								name: quote.sellToken.name,
								symbol: quote.sellToken.symbol
							}
						]);
					}
				});
			} catch (error) {
				performBatchedUpdates((): void => {
					onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({
						...prev,
						[tokenAddress]: TPossibleFlowStep.INVALID
					}));
					set_quotes((prev): Maybe<TRequest> => (
						setInvalidQuote(prev, tokenAddress, '')
					));
				});
			}
		}

		notify(executedQuotes, 'COWSWAP', 'EOA', '');
		set_isSigning(false);
	}, [areAllApproved, quotes, onUpdateSignStep, cowswap, set_quotes, onUpdateExecuteStep, onUpdateApprovalStep, refresh]);

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

			set_quotes((prev): Maybe<TRequest> => setRefreshingQuote(prev, toAddress(key)));
			const {quoteResponse} = await cowswap.getQuote({
				from: toAddress(currentQuote.from),
				receiver: toAddress(currentQuote.quote.receiver),
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
	}, [cowswap, quotes, set_quotes]);

	return (
		<div className={'flex flex-row items-center space-x-4'}>
			<button
				id={'TRIGGER_ALL_REFRESH'}
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
				isDisabled={(Object.values(quotes?.quote || {}).length === 0) || areAllApproved}
				onClick={onApproveERC20}>
				{'Approve'}
			</Button>
			<Button
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isSigning}
				isDisabled={(Object.values(quotes?.quote || {}).length === 0) || !areAllApproved}
				onClick={onSendOrders}>
				{'Sign'}
			</Button>
		</div>
	);
}

function Wrapper(): ReactElement {
	const {quotes} = useSweepooor();
	const [approvalStep, set_approvalStep] = useState<TDict<TPossibleFlowStep>>({});
	const [signStep, set_signStep] = useState<TDict<TPossibleFlowStep>>({});
	const [executeStep, set_executeStep] = useState<TDict<TPossibleFlowStep>>({});

	return (
		<>
			{Object.entries(getTypedCowswapQuote(quotes).quote).map(([token, currentQuote], index): JSX.Element => {
				return (
					<ApprovalWizardItemCowswap
						key={`${token}_${currentQuote?.quote?.buyAmount}_${currentQuote?.quote?.receiver}_${index}`}
						token={toAddress(token)}
						index={index}
						hasSignature={(currentQuote?.signature || '') !== ''}
						approvalStep={approvalStep}
						signStep={signStep}
						executeStep={executeStep} />
				);
			})}
			<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
				<div className={'flex flex-col'} />
				<CowswapStandardFlow
					approvals={approvalStep}
					onUpdateApprovalStep={set_approvalStep}
					onUpdateSignStep={set_signStep}
					onUpdateExecuteStep={set_executeStep} />
			</div>
		</>
	);
}

export default Wrapper;

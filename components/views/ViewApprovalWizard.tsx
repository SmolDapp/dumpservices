import React, {useCallback, useMemo, useState} from 'react';
import ApprovalWizardItem from 'components/ApprovalWizardItem';
import IconSpinner from 'components/icons/IconSpinner';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {isBebopOrder, isCowswapOrder} from 'hooks/assertSolver';
import {getSpender, useSolverCowswap} from 'hooks/useSolverCowswap';
import {approveERC20, isApprovedERC20} from 'utils/actions';
import notify from 'utils/notifier';
import {getApproveTransaction, getSetPreSignatureTransaction} from 'utils/tools.gnosis';
import axios from 'axios';
import {SigningScheme} from '@cowprotocol/cow-sdk';
import {useSafeAppsSDK} from '@gnosis.pm/safe-apps-react-sdk';
import {useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {defaultTxStatus} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TCowswapOrderQuoteResponse, TOrderQuote, TPossibleFlowStep} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {EcdsaSigningScheme} from '@cowprotocol/cow-sdk';
import type {BaseTransaction} from '@gnosis.pm/safe-apps-sdk';

type TExistingTx = {
	tx: BaseTransaction,
	orderUID: string
}
type TSafeTxHistory = {
	safe: string
	nonce: number
}

function GnosisBatchedFlow({onUpdateSignStep}: {onUpdateSignStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>}): ReactElement {
	const {provider} = useWeb3();
	const cowswap = useSolverCowswap();
	const {selected, quotes, set_quotes} = useSweepooor();
	const [isApproving, set_isApproving] = useState(false);
	const [isRefreshingQuotes, set_isRefreshingQuotes] = useState(false);
	const [existingTransactions, set_existingTransactions] = useState<TDict<TExistingTx>>({});
	const {sdk} = useSafeAppsSDK();
	const {safeChainID} = useChainID();

	/* 🔵 - Yearn Finance **************************************************************************
	** Sometimes, the quotes are not valid anymore, or we just want to refresh them after a long
	** time. This function will refresh all the quotes, and update the UI accordingly.
	**********************************************************************************************/
	const onRefreshAllQuotes = useCallback(async (): Promise<void> => {
		set_isRefreshingQuotes(true);
		for (const currentQuote of Object.values(quotes)) {
			if (isCowswapOrder(currentQuote)) {
				if (currentQuote.orderUID && ['fulfilled', 'pending'].includes(currentQuote?.orderStatus || '')) {
					continue; //skip already sent
				}
				const tokenAddress = toAddress(currentQuote?.request?.inputToken?.value);
				set_quotes((quotes: TDict<TOrderQuote>): TDict<TOrderQuote> => ({
					...quotes,
					[tokenAddress]: {...currentQuote, isRefreshing: true}
				}));
				const {quoteResponse} = await cowswap.init({
					from: currentQuote?.request?.from,
					receiver: currentQuote?.request?.receiver,
					inputToken: currentQuote?.request?.inputToken,
					outputToken: currentQuote?.request?.outputToken,
					inputAmount: currentQuote?.request?.inputAmount
				});
				if (quoteResponse) {
					set_quotes((quotes: TDict<TOrderQuote>): TDict<TOrderQuote> => ({
						...quotes,
						[tokenAddress]: quoteResponse
					}));
				}
			}

			if (isBebopOrder(currentQuote)) {
				console.warn('TODO: Not implemented yet');
				if (currentQuote?.orderStatus === 'CONFIRMED') {
					continue; //skip already sent
				}
			}
		}
		set_isRefreshingQuotes(false);
	}, [cowswap, quotes, set_quotes]);

	/* 🔵 - Yearn Finance **************************************************************************
	** If the signer is a Gnosis Safe, we will use another way to perform the approvals and
	** signatures to be able to batch all the txs in one:
	** For each token:
	** - If it is non-approved, it will be approved
	** - The quote will be sent to the Cowswap API with signingScheme set to 'presign'
	** - A orderUID will be returned
	**********************************************************************************************/
	const onExecuteFromGnosis = useCallback(async (): Promise<void> => {
		const allSelected = [...selected];
		const preparedTransactions: BaseTransaction[] = [];
		const newlyExistingTransactions: TDict<TExistingTx> = {};
		const executedQuotes = [];

		// Check approvals and add them to the batch if needed
		for (const token of allSelected) {
			const quoteOrder = quotes[toAddress(token)];
			const isApproved = await isApprovedERC20({
				connector: provider,
				contractAddress: toAddress(token),
				spenderAddress: getSpender({chainID: safeChainID}),
				amount: MAX_UINT_256
			});
			if (!isApproved) {
				const newApprovalForBatch = getApproveTransaction(
					MAX_UINT_256.toString(),
					toAddress(token),
					getSpender({chainID: safeChainID})
				);
				preparedTransactions.push(newApprovalForBatch);
			}

			if (isCowswapOrder(quoteOrder)) {
				quoteOrder.signature = '0x';
				quoteOrder.signingScheme = SigningScheme.PRESIGN as unknown as EcdsaSigningScheme;
				const quoteID = quoteOrder.id;
				if (!quoteID) {
					console.warn(`No quote for ${token}`);
					continue;
				}

				const existingTx = existingTransactions[String(quoteOrder.id)];
				if (existingTx) {
					//we already have an execute tx for this token in our batch
					console.warn(`Execute for ${token} already in batch`);
					preparedTransactions.push(existingTx.tx);
					executedQuotes.push({...quoteOrder, orderUID: existingTx.orderUID});
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
					continue;
				}

				onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'pending'}));
				try {
					await cowswap.execute(quoteOrder, true, (orderUID): void => {
						const newPreSignatureForBatch = getSetPreSignatureTransaction(
							toAddress(process.env.COWSWAP_GPV2SETTLEMENT_ADDRESS),
							orderUID,
							true
						);
						newlyExistingTransactions[String(quoteOrder.id)] = {
							tx: newPreSignatureForBatch,
							orderUID
						};
						preparedTransactions.push(newPreSignatureForBatch);
						executedQuotes.push({...quoteOrder, orderUID});
						onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
					});
				} catch (error) {
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'invalid'}));
				}
			}

			if (isBebopOrder(quoteOrder)) {
				console.warn('TODO: Not implemented yet');
			}
		}

		set_existingTransactions((existingTransactions: TDict<TExistingTx>): TDict<TExistingTx> => ({
			...existingTransactions,
			...newlyExistingTransactions
		}));
		try {
			const {safeTxHash} = await sdk.txs.send({txs: Object.values(preparedTransactions)});
			try {
				const tx = await axios.get(`https://safe-transaction-mainnet.safe.global/api/v1/multisig-transactions/${safeTxHash}`) as TSafeTxHistory;
				notify(executedQuotes, 'Safe', safeTxHash, tx);
			} catch (error) {
				notify(executedQuotes, 'Safe', safeTxHash);
			}
			set_isApproving(false);
			console.log(safeTxHash);
		} catch (error) {
			console.error(error);
			set_isApproving(false);
		}
	}, [selected, quotes, provider, safeChainID, existingTransactions, onUpdateSignStep, cowswap, sdk.txs]);

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
				isDisabled={selected.length === 0}
				onClick={async (): Promise<void> => {
					set_isApproving(true);
					await onExecuteFromGnosis();
				}}>
				{'Execute'}
			</Button>
		</div>
	);
}

function CowswapStandardFlow({onUpdateApprovalStep, onUpdateSignStep, onUpdateExecuteStep}: {
	onUpdateApprovalStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>,
	onUpdateSignStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>,
	onUpdateExecuteStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>
}): ReactElement {
	const {provider} = useWeb3();
	const {refresh} = useWallet();
	const {safeChainID} = useChainID();
	const {selected, amounts, quotes, set_quotes} = useSweepooor();
	const {toast} = yToast();
	const [approveStatus, set_approveStatus] = useState<TDict<boolean>>({});
	const [isApproving, set_isApproving] = useState(false);
	const [isSigning, set_isSigning] = useState(false);
	const [isRefreshingQuotes, set_isRefreshingQuotes] = useState(false);
	const [, set_txStatus] = useState(defaultTxStatus);
	const cowswap = useSolverCowswap();


	/* 🔵 - Yearn Finance **************************************************************************
	** areAllApproved and areAllSigned are used to determine if all the selected tokens have been
	** approved and signed.
	** If so, the onSendOrders function will be called.
	**********************************************************************************************/
	const areAllApproved = useMemo((): boolean => {
		if (selected.length === 0) {
			return false;
		}
		const isOk = true;
		for (const token of selected) {
			if (!approveStatus[toAddress(token)]) {
				return false;
			}
		}
		return isOk;
	}, [approveStatus, selected]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Every time the selected tokens change (either a new token is added or the amount is changed),
	** we will check if the allowance is enough for the amount to be swept.
	**********************************************************************************************/
	useUpdateEffect((): void => {
		const allSelected = [...selected];
		for (const token of allSelected) {
			isApprovedERC20({
				connector: provider,
				contractAddress: toAddress(token),
				spenderAddress: getSpender({chainID: safeChainID}),
				amount: amounts[toAddress(token)]?.raw
			}).then((isApproved): void => {
				set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: isApproved}));
			}).catch((error): void => {
				console.error(error);
			});
		}
	}, [selected, amounts, provider, safeChainID]);

	/* 🔵 - Yearn Finance **************************************************************************
	** onApproveERC20 will loop through all the selected tokens and approve them if needed.
	** It will also update the approveStatus state to keep track of the approvals.
	** If the token is already approved, state will be updated to true but approval will not be
	** performed.
	**********************************************************************************************/
	const onApproveERC20 = useCallback(async (): Promise<void> => {
		performBatchedUpdates((): void => {
			onUpdateApprovalStep({});
			set_isApproving(true);
		});

		const allSelected = [...selected];
		for (const token of allSelected) {
			const quote = quotes?.[toAddress(token)];
			const quoteID = quote?.id;
			if (!quoteID) {
				console.warn(`No quote for ${token}`);
				continue;
			}
			try {
				const isApproved = await isApprovedERC20({
					connector: provider,
					contractAddress: toAddress(token),
					spenderAddress: getSpender({chainID: safeChainID}),
					amount: amounts[toAddress(token)]?.raw
				});

				if (!isApproved) {
					onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'pending'}));

					const result = await approveERC20({
						connector: provider,
						contractAddress: toAddress(token),
						spenderAddress: getSpender({chainID: safeChainID}),
						amount: amounts[toAddress(token)]?.raw,
						statusHandler: set_txStatus
					});
					if (result.isSuccessful) {
						performBatchedUpdates((): void => {
							set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: true}));
							onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
						});
					} else {
						onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'invalid'}));
					}
				} else {
					set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: true}));
				}
			} catch (error) {
				console.error(error);
				onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'undetermined'}));
			}
		}
		set_isApproving(false);
	}, [amounts, onUpdateApprovalStep, provider, quotes, safeChainID, selected]);

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
		set_isSigning(true);
		const allSelected = [...selected];
		const executedQuotes: TOrderQuote[] = [];
		for (const token of allSelected) {
			const tokenAddress = toAddress(token);
			const quote = quotes[tokenAddress];

			if (isCowswapOrder(quote)) {
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
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'pending'}));
					const {signature, signingScheme} = await cowswap.signOrder(quote);
					quote.signature = signature;
					quote.signingScheme = signingScheme;
					performBatchedUpdates((): void => {
						onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
						set_quotes((prev): TDict<TOrderQuote> => ({
							...prev,
							[tokenAddress]: {
								...(prev[tokenAddress] as TCowswapOrderQuoteResponse),
								signature,
								signingScheme
							}
						}));
					});
				} catch (error) {
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'invalid'}));
					continue;
				}

				/* 🔵 - Yearn Finance ******************************************************************
				** Send the current quote to the cowswap API
				***************************************************************************************/
				try {
					onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'pending'}));
					cowswap.execute(
						quote,
						Boolean(process.env.SHOULD_USE_PRESIGN),
						(orderUID): void => {
							set_quotes((prev): TDict<TOrderQuote> => ({
								...prev,
								[tokenAddress]: {
									...(prev[tokenAddress] as TCowswapOrderQuoteResponse),
									orderUID,
									orderStatus: 'pending'
								}
							}));
						}
					).then(async ({status, orderUID, error}): Promise<void> => {
						if (error?.message) {
							if (error?.message?.includes('InsufficientAllowance')) {
								performBatchedUpdates((): void => {
									onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'invalid'}));
									onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'undetermined'}));
									set_approveStatus((prev): TDict<boolean> => ({...prev, [tokenAddress]: false}));
									set_quotes((prev): TDict<TOrderQuote> => ({
										...prev,
										[tokenAddress]: {
											...(prev[tokenAddress] as TCowswapOrderQuoteResponse),
											quote: {
												...(prev[tokenAddress] as TCowswapOrderQuoteResponse).quote,
												validTo: 0
											},
											orderUID: orderUID,
											orderStatus: 'invalid'
										}
									}));
								});
							} else {
								performBatchedUpdates((): void => {
									onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'invalid'}));
									set_quotes((prev): TDict<TOrderQuote> => ({
										...prev,
										[tokenAddress]: {
											...(prev[tokenAddress] as TCowswapOrderQuoteResponse),
											quote: {
												...(prev[tokenAddress] as TCowswapOrderQuoteResponse).quote,
												validTo: 0
											},
											orderUID: orderUID,
											orderStatus: 'invalid'
										}
									}));
								});
							}
						} else {
							executedQuotes.push({...quote, orderUID: orderUID, orderStatus: status});
							onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
							set_quotes((prev): TDict<TOrderQuote> => ({
								...prev,
								[tokenAddress]: {
									...(prev[tokenAddress] as TCowswapOrderQuoteResponse),
									orderUID,
									orderStatus: status
								}
							}));
							refresh([
								{
									token: toAddress(quote.quote.buyToken),
									decimals: quote.request.outputToken.decimals,
									name: quote.request.outputToken.label,
									symbol: quote.request.outputToken.symbol
								}, {
									token: toAddress(quote.quote.sellToken),
									decimals: quote.request.inputToken.decimals,
									name: quote.request.inputToken.label,
									symbol: quote.request.inputToken.symbol
								}
							]);
						}
					});
				} catch (error) {
					performBatchedUpdates((): void => {
						onUpdateExecuteStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'invalid'}));
						set_quotes((prev): TDict<TOrderQuote> => ({
							...prev,
							[tokenAddress]: {
								...(prev[tokenAddress] as TCowswapOrderQuoteResponse),
								quote: {
									...(prev[tokenAddress] as TCowswapOrderQuoteResponse).quote,
									validTo: 0
								},
								orderStatus: 'invalid'
							}
						}));
					});
				}
			}

			if (isBebopOrder(quote)) {
				console.warn('TODO: Not implemented yet');
			}
		}

		notify(executedQuotes, 'EOA', '');
		set_isSigning(false);
	}, [areAllApproved, selected, toast, quotes, onUpdateSignStep, cowswap, set_quotes, onUpdateExecuteStep, onUpdateApprovalStep, refresh]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Sometimes, the quotes are not valid anymore, or we just want to refresh them after a long
	** time. This function will refresh all the quotes, and update the UI accordingly.
	**********************************************************************************************/
	const onRefreshAllQuotes = useCallback(async (): Promise<void> => {
		set_isRefreshingQuotes(true);
		for (const currentQuote of Object.values(quotes)) {
			if (isCowswapOrder(currentQuote)) {
				if (currentQuote.orderUID && ['fulfilled', 'pending'].includes(currentQuote?.orderStatus || '')) {
					return; //skip already sent
				}
				const tokenAddress = toAddress(currentQuote?.request?.inputToken?.value);
				set_quotes((quotes: TDict<TOrderQuote>): TDict<TOrderQuote> => ({
					...quotes,
					[tokenAddress]: {
						...currentQuote,
						isRefreshing: true
					}
				}));
				const {quoteResponse} = await cowswap.init({
					from: currentQuote?.request?.from,
					receiver: currentQuote?.request?.receiver,
					inputToken: currentQuote?.request?.inputToken,
					outputToken: currentQuote?.request?.outputToken,
					inputAmount: currentQuote?.request?.inputAmount
				});
				if (quoteResponse) {
					set_quotes((quotes: TDict<TOrderQuote>): TDict<TOrderQuote> => ({
						...quotes,
						[tokenAddress]: quoteResponse
					}));
				}
			}

			if (isBebopOrder(currentQuote)) {
				console.warn('TODO: Not implemented yet');
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
				isDisabled={(selected.length === 0) || areAllApproved}
				onClick={onApproveERC20}>
				{'Approve'}
			</Button>
			<Button
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isSigning}
				isDisabled={(selected.length === 0) || !areAllApproved}
				onClick={onSendOrders}>
				{'Sign'}
			</Button>
		</div>
	);
}


function BebopBatchedFlow({onUpdateSignStep}: {onUpdateSignStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>}): ReactElement {
	const {provider} = useWeb3();
	const cowswap = useSolverCowswap();
	const {selected, quotes, set_quotes} = useSweepooor();
	const [isApproving, set_isApproving] = useState(false);
	const [isRefreshingQuotes, set_isRefreshingQuotes] = useState(false);
	const [existingTransactions, set_existingTransactions] = useState<TDict<TExistingTx>>({});
	const {sdk} = useSafeAppsSDK();
	const {safeChainID} = useChainID();

	/* 🔵 - Yearn Finance **************************************************************************
	** Sometimes, the quotes are not valid anymore, or we just want to refresh them after a long
	** time. This function will refresh all the quotes, and update the UI accordingly.
	**********************************************************************************************/
	const onRefreshAllQuotes = useCallback(async (): Promise<void> => {
		set_isRefreshingQuotes(true);
		for (const currentQuote of Object.values(quotes)) {
			if (isCowswapOrder(currentQuote)) {
				if (currentQuote.orderUID && ['fulfilled', 'pending'].includes(currentQuote?.orderStatus || '')) {
					continue; //skip already sent
				}
				const tokenAddress = toAddress(currentQuote?.request?.inputToken?.value);
				set_quotes((quotes: TDict<TOrderQuote>): TDict<TOrderQuote> => ({
					...quotes,
					[tokenAddress]: {...currentQuote, isRefreshing: true}
				}));
				const {quoteResponse} = await cowswap.init({
					from: currentQuote?.request?.from,
					receiver: currentQuote?.request?.receiver,
					inputToken: currentQuote?.request?.inputToken,
					outputToken: currentQuote?.request?.outputToken,
					inputAmount: currentQuote?.request?.inputAmount
				});
				if (quoteResponse) {
					set_quotes((quotes: TDict<TOrderQuote>): TDict<TOrderQuote> => ({
						...quotes,
						[tokenAddress]: quoteResponse
					}));
				}
			}

			if (isBebopOrder(currentQuote)) {
				console.warn('TODO: Not implemented yet');
				if (currentQuote?.orderStatus === 'CONFIRMED') {
					continue; //skip already sent
				}
			}
		}
		set_isRefreshingQuotes(false);
	}, [cowswap, quotes, set_quotes]);

	/* 🔵 - Yearn Finance **************************************************************************
	** If the signer is a Gnosis Safe, we will use another way to perform the approvals and
	** signatures to be able to batch all the txs in one:
	** For each token:
	** - If it is non-approved, it will be approved
	** - The quote will be sent to the Cowswap API with signingScheme set to 'presign'
	** - A orderUID will be returned
	**********************************************************************************************/
	const onExecuteFromGnosis = useCallback(async (): Promise<void> => {
		const allSelected = [...selected];
		const preparedTransactions: BaseTransaction[] = [];
		const newlyExistingTransactions: TDict<TExistingTx> = {};
		const executedQuotes = [];

		// Check approvals and add them to the batch if needed
		for (const token of allSelected) {
			const quoteOrder = quotes[toAddress(token)];
			const isApproved = await isApprovedERC20({
				connector: provider,
				contractAddress: toAddress(token),
				spenderAddress: getSpender({chainID: safeChainID}),
				amount: MAX_UINT_256
			});
			if (!isApproved) {
				const newApprovalForBatch = getApproveTransaction(
					MAX_UINT_256.toString(),
					toAddress(token),
					getSpender({chainID: safeChainID})
				);
				preparedTransactions.push(newApprovalForBatch);
			}

			if (isCowswapOrder(quoteOrder)) {
				quoteOrder.signature = '0x';
				quoteOrder.signingScheme = SigningScheme.PRESIGN as unknown as EcdsaSigningScheme;
				const quoteID = quoteOrder.id;
				if (!quoteID) {
					console.warn(`No quote for ${token}`);
					continue;
				}

				const existingTx = existingTransactions[String(quoteOrder.id)];
				if (existingTx) {
					//we already have an execute tx for this token in our batch
					console.warn(`Execute for ${token} already in batch`);
					preparedTransactions.push(existingTx.tx);
					executedQuotes.push({...quoteOrder, orderUID: existingTx.orderUID});
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
					continue;
				}

				onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'pending'}));
				try {
					await cowswap.execute(quoteOrder, true, (orderUID): void => {
						const newPreSignatureForBatch = getSetPreSignatureTransaction(
							toAddress(process.env.COWSWAP_GPV2SETTLEMENT_ADDRESS),
							orderUID,
							true
						);
						newlyExistingTransactions[String(quoteOrder.id)] = {
							tx: newPreSignatureForBatch,
							orderUID
						};
						preparedTransactions.push(newPreSignatureForBatch);
						executedQuotes.push({...quoteOrder, orderUID});
						onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
					});
				} catch (error) {
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'invalid'}));
				}
			}

			if (isBebopOrder(quoteOrder)) {
				console.warn('TODO: Not implemented yet');
			}
		}

		set_existingTransactions((existingTransactions: TDict<TExistingTx>): TDict<TExistingTx> => ({
			...existingTransactions,
			...newlyExistingTransactions
		}));
		try {
			const {safeTxHash} = await sdk.txs.send({txs: Object.values(preparedTransactions)});
			try {
				const tx = await axios.get(`https://safe-transaction-mainnet.safe.global/api/v1/multisig-transactions/${safeTxHash}`) as TSafeTxHistory;
				notify(executedQuotes, 'Safe', safeTxHash, tx);
			} catch (error) {
				notify(executedQuotes, 'Safe', safeTxHash);
			}
			set_isApproving(false);
			console.log(safeTxHash);
		} catch (error) {
			console.error(error);
			set_isApproving(false);
		}
	}, [selected, quotes, provider, safeChainID, existingTransactions, onUpdateSignStep, cowswap, sdk.txs]);

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
				isDisabled={selected.length === 0}
				onClick={async (): Promise<void> => {
					set_isApproving(true);
					await onExecuteFromGnosis();
				}}>
				{'Execute'}
			</Button>
		</div>
	);
}

function ViewApprovalWizard(): ReactElement {
	const {walletType} = useWeb3();
	const {selected, quotes} = useSweepooor();
	const [approvalStep, set_approvalStep] = useState<TDict<TPossibleFlowStep>>({});
	const [signStep, set_signStep] = useState<TDict<TPossibleFlowStep>>({});
	const [executeStep, set_executeStep] = useState<TDict<TPossibleFlowStep>>({});
	const isGnosisSafe = (walletType === 'EMBED_GNOSIS_SAFE');

	return (
		<section>
			<div className={'box-0 relative flex w-full flex-col items-center justify-center overflow-hidden p-0 md:p-6'}>
				<div className={'mb-0 w-full p-4 md:mb-6 md:p-0'}>
					<b>{'Dump!'}</b>
					<p className={'w-full text-sm text-neutral-500 md:w-3/4'} suppressHydrationWarning>
						{isGnosisSafe ? 'All the step will be batched in one single transaction! Just execute it and sign your safe transaction! Easiest way to dump!' : 'This is a two step process. You first need to approve the tokens you want to dump, and then we will ask you to sign a message to send your order to dump!'}
					</p>
				</div>

				{selected.map((token, index): JSX.Element => {
					let key = String(index);
					const currentQuote = quotes?.[toAddress(token)];
					if (isCowswapOrder(currentQuote)) {
						key = `${token}_${currentQuote?.quote?.buyAmount}_${currentQuote?.quote?.receiver}_${index}`;
					} else if (isBebopOrder(currentQuote)) {
						const buyPairs = Object.values(currentQuote?.buyTokens || {}).map((token): string => `${token?.contractAddress}_${token?.amount}`);
						key = `${token}_${buyPairs}_${currentQuote?.receiver}_${index}`;
					}
					return (
						<ApprovalWizardItem
							key={key}
							token={token}
							index={index}
							isGnosisSafe={isGnosisSafe}
							hasSignature={((currentQuote as TCowswapOrderQuoteResponse)?.signature || '') !== ''}
							approvalStep={approvalStep}
							signStep={signStep}
							executeStep={executeStep} />
					);
				})}
				<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
					<div className={'flex flex-col'} />
					{isGnosisSafe && <GnosisBatchedFlow onUpdateSignStep={set_signStep} />}
					{isBebopOrder(Object.values(quotes)[0]) && <BebopBatchedFlow onUpdateSignStep={set_signStep} />}
					{isCowswapOrder(Object.values(quotes)[0]) && (
						<CowswapStandardFlow
							onUpdateApprovalStep={set_approvalStep}
							onUpdateSignStep={set_signStep}
							onUpdateExecuteStep={set_executeStep} />
					)}
				</div>
			</div>
		</section>
	);
}
export default ViewApprovalWizard;

import React, {useCallback, useMemo, useState} from 'react';
import ApprovalWizardItem from 'components/ApprovalWizardItem';
import IconSpinner from 'components/icons/IconSpinner';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {useSolverCowswap} from 'hooks/useSolverCowswap';
import {approveERC20, isApprovedERC20} from 'utils/actions/approveERC20';
import {getApproveTransaction, getSetPreSignatureTransaction} from 'utils/gnosis.tools';
import axios from 'axios';
import {useSafeAppsSDK} from '@gnosis.pm/safe-apps-react-sdk';
import {useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {SOLVER_COW_VAULT_RELAYER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TOrderQuoteResponse, TPossibleFlowStep} from 'utils/types';
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

function	notify(orders: TOrderQuoteResponse[], origin: string, txHash: string, safeTx?: TSafeTxHistory): void {
	if (!orders.length) {
		return;
	}

	const	messages = [] as string[];
	let		from = '';
	let		to = '';
	for (const order of orders) {
		from = toAddress(order.from);
		to = toAddress(order.quote.receiver);
		const	buyAmount = formatAmount(
			toNormalizedBN(
				order?.quote?.buyAmount || '',
				order?.request?.outputToken?.decimals || 18
			).normalized, 6, 6);
		const	sellAmount = formatAmount(
			toNormalizedBN(
				order?.quote?.sellAmount || '',
				order?.request?.inputToken?.decimals || 18
			).normalized, 6, 6);
		const	feeAmount = formatAmount(
			toNormalizedBN(
				order?.quote?.feeAmount || '',
				order?.request?.inputToken?.decimals || 18
			).normalized, 6, 6);
		const	buyToken = order.request.outputToken.symbol;
		const	sellToken = order.request.inputToken.symbol;

		messages.push(
			`\t\t\t\t${sellAmount} [${sellToken.toUpperCase()}](https://etherscan.io/address/${order.request.inputToken.value}) ▶ ${buyAmount} [${buyToken.toUpperCase()}](https://etherscan.io/address/${order.request.outputToken.value}) | ${feeAmount} [${sellToken.toUpperCase()}](https://etherscan.io/address/${order.request.inputToken.value}) | [Order](https://explorer.cow.fi/orders/${order.orderUID})`
		);
	}

	const	extra = [] as string[];
	if (txHash) {
		extra.push(...[
			'\n*📇 - Safe:*',
			`\t\t\t\tSafeTx: [${truncateHex(txHash, 6)}](https://safe-transaction-mainnet.safe.global/api/v1/multisig-transactions/${txHash})`,
			`\t\t\t\tNonce: ${safeTx?.nonce || 'N/A'})`
		]);

	}
	axios.post('/api/notify', {
		messages: [
			'*🥟 New dump detected*',
			'\n*🧹 - Orders:*',
			...messages,
			'\n*👀 - Meta:*',
			`\t\t\t\tFrom: [${truncateHex(from, 4)}](https://etherscan.io/address/${from})`,
			`\t\t\t\tTo: [${truncateHex(to, 4)}](https://etherscan.io/address/${to})`,
			`\t\t\t\tWallet: ${origin}`,
			...extra
		]
	});
}

function	GnosisBatchedFlow({onUpdateSignStep}: {onUpdateSignStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>}): ReactElement {
	const	{provider} = useWeb3();
	const	cowswap = useSolverCowswap();
	const	{selected, amounts, quotes, set_quotes} = useSweepooor();
	const	[isApproving, set_isApproving] = useState(false);
	const	[isRefreshingQuotes, set_isRefreshingQuotes] = useState(false);
	const	[existingTransactions, set_existingTransactions] = useState<TDict<TExistingTx>>({});
	const	{sdk} = useSafeAppsSDK();

	/* 🔵 - Yearn Finance **************************************************************************
	** Sometimes, the quotes are not valid anymore, or we just want to refresh them after a long
	** time. This function will refresh all the quotes, and update the UI accordingly.
	**********************************************************************************************/
	const	onRefreshAllQuotes = useCallback(async (): Promise<void> => {
		set_isRefreshingQuotes(true);
		for (const currentQuote of Object.values(quotes)) {
			if (currentQuote.orderUID && ['fulfilled', 'pending'].includes(currentQuote?.orderStatus || '')) {
				return; //skip already sent
			}
			const tokenAddress = toAddress(currentQuote?.request?.inputToken?.value);
			set_quotes((quotes: TDict<TOrderQuoteResponse>): TDict<TOrderQuoteResponse> => ({
				...quotes,
				[tokenAddress]: {
					...currentQuote,
					isRefreshing: true
				}
			}));
			const [, order] = await cowswap.init({
				from: currentQuote?.request?.from,
				receiver: currentQuote?.request?.receiver,
				inputToken: currentQuote?.request?.inputToken,
				outputToken: currentQuote?.request?.outputToken,
				inputAmount: currentQuote?.request?.inputAmount
			});
			if (order) {
				set_quotes((quotes: TDict<TOrderQuoteResponse>): TDict<TOrderQuoteResponse> => ({
					...quotes,
					[tokenAddress]: order
				}));
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
	const	onExecuteFromGnosis = useCallback(async (): Promise<void> => {
		const	allSelected = [...selected];
		const	preparedTransactions: BaseTransaction[] = [];
		const	newlyExistingTransactions: TDict<TExistingTx> = {};
		const	executedQuotes = [];

		// Check approvals and add them to the batch if needed
		for (const token of allSelected) {
			const	quoteOrder = quotes[toAddress(token)];
			const	isApproved = await isApprovedERC20(
				provider,
				toAddress(token), //from
				toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //migrator
				amounts[toAddress(token)]?.raw
			);
			if (!isApproved) {
				const newApprovalForBatch = getApproveTransaction(
					amounts[toAddress(token)]?.raw.toString(),
					toAddress(token),
					toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS)
				);
				preparedTransactions.push(newApprovalForBatch);
			}

			quoteOrder.signature = '0x';
			const quoteID = quotes?.[toAddress(token)]?.id;
			if (!quoteID) {
				console.warn(`No quote for ${token}`);
				continue;
			}

			const	existingTx = existingTransactions[String(quoteOrder.id)];
			if (existingTx) {
				//we already have an execute tx for this token in our batch
				console.warn(`Execute for ${token} already in batch`);
				preparedTransactions.push(existingTx.tx);
				executedQuotes.push({...quoteOrder, orderUID: existingTx.orderUID});
				onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
				continue;
			}

			onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'pending'}));
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
	}, [amounts, cowswap, onUpdateSignStep, provider, quotes, sdk.txs, selected, existingTransactions]);


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

function	StandardFlow({onUpdateApprovalStep, onUpdateSignStep}: {
	onUpdateApprovalStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>,
	onUpdateSignStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>
}): ReactElement {
	const	{provider} = useWeb3();
	const	{refresh} = useWallet();
	const	{selected, amounts, quotes, set_quotes} = useSweepooor();
	const	{toast} = yToast();
	const	[approveStatus, set_approveStatus] = useState<TDict<boolean>>({});
	const	[isApproving, set_isApproving] = useState(false);
	const	[isSigning, set_isSigning] = useState(false);
	const	[isRefreshingQuotes, set_isRefreshingQuotes] = useState(false);
	const	[hasSentOrder, set_hasSentOrder] = useState(false);
	const	[, set_txStatus] = useState(defaultTxStatus);
	const	cowswap = useSolverCowswap();

	/* 🔵 - Yearn Finance **************************************************************************
	** Every time the selected tokens change (either a new token is added or the amount is changed),
	** we will check if the allowance is enough for the amount to be swept.
	**********************************************************************************************/
	useUpdateEffect((): void => {
		const	allSelected = [...selected];
		for (const token of allSelected) {
			isApprovedERC20(
				provider,
				toAddress(token), //from
				toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //migrator
				amounts[toAddress(token)]?.raw
			).then((isApproved): void => {
				set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: isApproved}));
			}).catch((error): void => {
				console.error(error);
			});
		}
	}, [selected, amounts]);

	/* 🔵 - Yearn Finance **************************************************************************
	** onApproveERC20 will loop through all the selected tokens and approve them if needed.
	** It will also update the approveStatus state to keep track of the approvals.
	** If the token is already approved, state will be updated to true but approval will not be
	** performed.
	**********************************************************************************************/
	const	onApproveERC20 = useCallback(async (): Promise<void> => {
		performBatchedUpdates((): void => {
			onUpdateApprovalStep({});
			set_isApproving(true);
		});

		const	allSelected = [...selected];
		for (const token of allSelected) {
			const	quoteID = quotes?.[toAddress(token)]?.id;
			if (!quoteID) {
				console.warn(`No quote for ${token}`);
				continue;
			}
			try {
				const	isApproved = await isApprovedERC20(
					provider,
					toAddress(token), //from
					toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //migrator
					amounts[toAddress(token)]?.raw
				);

				if (!isApproved) {
					onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'pending'}));
					const {isSuccessful} = await new Transaction(provider, approveERC20, set_txStatus).populate(
						toAddress(token),
						toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS),
						amounts[toAddress(token)]?.raw
					).onSuccess(async (): Promise<void> => {
						performBatchedUpdates((): void => {
							set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: true}));
							onUpdateApprovalStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
						});
					}).perform();
					if (!isSuccessful) {
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
	}, [amounts, onUpdateApprovalStep, provider, quotes, selected]);

	/* 🔵 - Yearn Finance **************************************************************************
	** onSignQuote will loop through all the selected tokens and sign the quote if needed.
	** It will also update the quote to append the signature to the quote, which will be used
	** to execute the order.
	** If the quote is already signed, state will be updated to true but signing will not be
	** performed.
	**********************************************************************************************/
	const	onSignQuote = useCallback(async (): Promise<void> => {
		for (const token of selected) {
			if (!quotes[toAddress(token)] || !approveStatus[toAddress(token)]) {
				console.log('Missing quote or approval', token, quotes[toAddress(token)], approveStatus[toAddress(token)]);
				return;
			}
		}
		performBatchedUpdates((): void => {
			set_hasSentOrder(false);
			set_isSigning(true);
			onUpdateSignStep({});
		});

		const	allSelected = [...selected];
		for (const token of allSelected) {
			const	quoteID = quotes?.[toAddress(token)]?.id;
			if (!quoteID) {
				console.warn(`No quote for ${token}`);
				continue;
			}

			if ((quotes?.[toAddress(token)]?.signature || '') !== '') {
				onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
				if (token === allSelected[allSelected.length - 1]) {
					set_isSigning(false);
				}
				continue;
			}

			onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'pending'}));
			try {
				const quoteOrder = quotes[toAddress(token)];
				const {signature, signingScheme} = await cowswap.signCowswapOrder(quoteOrder);
				performBatchedUpdates((): void => {
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'valid'}));
					set_quotes((prev): TDict<TOrderQuoteResponse> => ({
						...prev,
						[toAddress(token)]: {
							...quoteOrder,
							signature,
							signingScheme
						}
					}));
				});
			} catch (error) {
				performBatchedUpdates((): void => {
					onUpdateSignStep((prev): TDict<TPossibleFlowStep> => ({...prev, [quoteID]: 'undetermined'}));
					set_quotes((prev): TDict<TOrderQuoteResponse> => ({
						...prev,
						[toAddress(token)]: {
							...quotes[toAddress(token)],
							signature: '',
							signingScheme: '' as string as EcdsaSigningScheme
						}
					}));
				});
			}
		}
		set_isSigning(false);
	}, [approveStatus, cowswap, onUpdateSignStep, quotes, selected, set_quotes]);

	/* 🔵 - Yearn Finance **************************************************************************
	** onSendOrders send the orders to the cowswap API, skipping the ones that are already sent (
	** pending or fulfilled).
	** It will also request an update of the signature if it appears to not be signed, and will
	** update the quote to append the orderUID which will be used to track execution of the order,
	** aka from pending to status (fulfilled, cancelled, etc)
	**********************************************************************************************/
	const	onSendOrders = useCallback(async (): Promise<void> => {
		const	allSelected = [...selected];
		const	allCowswapExecutePromise = [];
		for (const token of allSelected) {
			const	quote = quotes[toAddress(token)];
			if (quote.orderUID && ['fulfilled', 'pending'].includes(quote?.orderStatus || '')) {
				continue; //skip already sent
			}

			//Not signed, force resign
			if ((quote?.signature || '') === '') {
				const quoteOrder = quotes[toAddress(token)];
				const {signature, signingScheme} = await cowswap.signCowswapOrder(quoteOrder);
				set_quotes((prev): TDict<TOrderQuoteResponse> => ({
					...prev,
					[toAddress(token)]: {
						...quoteOrder,
						signature,
						signingScheme
					}
				}));
				quote.signature = signature;
				quote.signingScheme = signingScheme;
			}

			allCowswapExecutePromise.push(
				cowswap.execute(
					quote,
					Boolean(process.env.SHOULD_USE_PRESIGN), // We don't want to use presign, unless specified in env variables (debug mode)
					(orderUID): void => {
						set_quotes((prev): TDict<TOrderQuoteResponse> => ({
							...prev,
							[toAddress(token)]: {...quote, orderUID, orderStatus: 'pending'}
						}));
					})
			);
		}

		//Wait for all promises to be resolved
		const executedQuotes = [];
		const result = await Promise.allSettled(allCowswapExecutePromise);

		for (const okOrKo of result) {
			if (okOrKo.status === 'rejected') {
				toast({type: 'error', content: okOrKo.reason});
				continue;
			}

			const {status, orderUID, quote, error} = okOrKo.value;
			const tokenAddress = toAddress(quote?.quote?.sellToken || '');
			if (error?.message) {
				if (error?.message?.includes('InsufficientAllowance')) {
					set_approveStatus((prev): TDict<boolean> => ({...prev, [tokenAddress]: false}));
				}
				set_quotes((prev): TDict<TOrderQuoteResponse> => ({
					...prev,
					[tokenAddress]: {
						...quotes[tokenAddress],
						quote: {...quotes[tokenAddress].quote, validTo: 0},
						orderStatus: 'invalid',
						signature: '',
						signingScheme: '' as string as EcdsaSigningScheme
					}
				}));
			}

			executedQuotes.push({...quote, orderUID: orderUID, orderStatus: status});
			set_quotes((prev): TDict<TOrderQuoteResponse> => ({
				...prev,
				[tokenAddress]: {...quote, orderUID, orderStatus: status}
			}));
			refresh([
				{
					token: quote.quote.buyToken,
					decimals: quote.request.outputToken.decimals,
					name: quote.request.outputToken.label,
					symbol: quote.request.outputToken.symbol
				},
				{
					token: quote.quote.sellToken,
					decimals: quote.request.inputToken.decimals,
					name: quote.request.inputToken.label,
					symbol: quote.request.inputToken.symbol
				}
			]);
		}
		notify(executedQuotes, 'EOA', '');
	}, [selected, quotes, cowswap, set_quotes, refresh, toast]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Sometimes, the quotes are not valid anymore, or we just want to refresh them after a long
	** time. This function will refresh all the quotes, and update the UI accordingly.
	**********************************************************************************************/
	const	onRefreshAllQuotes = useCallback(async (): Promise<void> => {
		set_isRefreshingQuotes(true);
		for (const currentQuote of Object.values(quotes)) {
			if (currentQuote.orderUID && ['fulfilled', 'pending'].includes(currentQuote?.orderStatus || '')) {
				return; //skip already sent
			}
			const tokenAddress = toAddress(currentQuote?.request?.inputToken?.value);
			set_quotes((quotes: TDict<TOrderQuoteResponse>): TDict<TOrderQuoteResponse> => ({
				...quotes,
				[tokenAddress]: {
					...currentQuote,
					isRefreshing: true
				}
			}));
			const [, order] = await cowswap.init({
				from: currentQuote?.request?.from,
				receiver: currentQuote?.request?.receiver,
				inputToken: currentQuote?.request?.inputToken,
				outputToken: currentQuote?.request?.outputToken,
				inputAmount: currentQuote?.request?.inputAmount
			});
			if (order) {
				set_quotes((quotes: TDict<TOrderQuoteResponse>): TDict<TOrderQuoteResponse> => ({
					...quotes,
					[tokenAddress]: order
				}));
			}
		}
		set_isRefreshingQuotes(false);
	}, [cowswap, quotes, set_quotes]);

	/* 🔵 - Yearn Finance **************************************************************************
	** areAllApproved and areAllSigned are used to determine if all the selected tokens have been
	** approved and signed.
	** If so, the onSendOrders function will be called.
	**********************************************************************************************/
	const	areAllApproved = useMemo((): boolean => {
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

	const	areAllSigned = useMemo((): boolean => {
		if (selected.length === 0) {
			return false;
		}
		const isOk = true;
		for (const token of selected) {
			if ((quotes[toAddress(token)]?.signature || '') === '') {
				return false;
			}
		}
		return isOk;
	}, [quotes, selected]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Trigger the onSendOrders function when all the selected tokens have been approved and signed
	**********************************************************************************************/
	useUpdateEffect((): void => {
		if (hasSentOrder || isSigning) {
			return;
		}
		if (areAllApproved && areAllSigned) {
			set_hasSentOrder(true);
			onSendOrders();
		}
	}, [hasSentOrder, areAllApproved, areAllSigned, isSigning]);

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
				isDisabled={(selected.length === 0) || areAllApproved}
				onClick={onApproveERC20}>
				{'Approve'}
			</Button>
			<Button
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isSigning}
				isDisabled={(selected.length === 0) || !areAllApproved || areAllSigned}
				onClick={onSignQuote}>
				{'Sign'}
			</Button>
		</div>
	);
}

function	ViewApprovalWizard(): ReactElement {
	const	{walletType} = useWeb3();
	const	{selected, quotes} = useSweepooor();
	const	[currentWizardApprovalStep, set_currentWizardApprovalStep] = useState<TDict<TPossibleFlowStep>>({}); // {[orderID]: flowStep}
	const	[currentWizardSignStep, set_currentWizardSignStep] = useState<TDict<TPossibleFlowStep>>({}); // {[orderID]: flowStep}
	const	isGnosisSafe = (
		walletType === 'EMBED_GNOSIS_SAFE'
		// || (((provider as any)?.provider?.connector?._peerMeta?.name || '').toLowerCase()).includes('safe')
	);

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
					return (
						<ApprovalWizardItem
							key={`${token}_${quotes?.[toAddress(token)]?.quote?.buyAmount}_${quotes?.[toAddress(token)]?.quote?.receiver}_${index}`}
							token={token}
							index={index}
							isGnosisSafe={isGnosisSafe}
							hasSignature={(quotes?.[toAddress(token)]?.signature || '') !== ''}
							currentWizardApprovalStep={currentWizardApprovalStep}
							currentWizardSignStep={currentWizardSignStep}/>
					);
				})}
				<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
					<div className={'flex flex-col'} />
					{isGnosisSafe ? (
						<GnosisBatchedFlow
							onUpdateSignStep={set_currentWizardSignStep} />
					) : (
						<StandardFlow
							onUpdateApprovalStep={set_currentWizardApprovalStep}
							onUpdateSignStep={set_currentWizardSignStep} />
					)}
				</div>
			</div>
		</section>
	);
}
export default ViewApprovalWizard;

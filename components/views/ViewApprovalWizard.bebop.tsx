import React, {useCallback, useState} from 'react';
import ApprovalWizardItem from 'components/ApprovalWizardItem';
import IconSpinner from 'components/icons/IconSpinner';
import {useSweepooor} from 'contexts/useSweepooor';
import {isBebopOrder, isCowswapOrder} from 'hooks/assertSolver';
import {getSpender, useSolverCowswap} from 'hooks/useSolverCowswap';
import {isApprovedERC20} from 'utils/actions';
import notify from 'utils/notifier';
import {getApproveTransaction, getSetPreSignatureTransaction} from 'utils/tools.gnosis';
import axios from 'axios';
import {SigningScheme} from '@cowprotocol/cow-sdk';
import {useSafeAppsSDK} from '@gnosis.pm/safe-apps-react-sdk';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {MAX_UINT_256} from '@yearn-finance/web-lib/utils/constants';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TBebopOrderQuoteResponse,TPossibleFlowStep,TToken} from 'utils/types';
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

function BebopBatchedFlow({onUpdateSignStep}: {onUpdateSignStep: Dispatch<SetStateAction<TDict<TPossibleFlowStep>>>}): ReactElement {
	const {provider} = useWeb3();
	const cowswap = useSolverCowswap();
	const {selected, quotes} = useSweepooor();
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
		const allOrders = Object.values(quotes) as TBebopOrderQuoteResponse[];
		const [firstQuote] = allOrders;
		const {quoteResponse} = await cowswap.getQuote({
			from: firstQuote.request.from,
			receiver: firstQuote.receiver,
			inputTokens: allOrders.map((order): TToken => order.request.inputTokens[0]),
			outputToken: firstQuote.request.outputToken,
			inputAmounts: allOrders.map((order): bigint => order.request.inputAmounts[0])
		});

		console.warn(quoteResponse);
		set_isRefreshingQuotes(false);
	}, [cowswap, quotes]);

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
				notify(executedQuotes, 'BEBOP', 'EOA', safeTxHash, tx);
			} catch (error) {
				notify(executedQuotes, 'BEBOP', 'EOA', safeTxHash);
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

function Wrapper(): ReactElement {
	const {walletType} = useWeb3();
	const {selected, quotes} = useSweepooor();
	const [signStep, set_signStep] = useState<TDict<TPossibleFlowStep>>({});
	const isGnosisSafe = (walletType === 'EMBED_GNOSIS_SAFE');

	return (
		<>
			{selected.map((token, index): JSX.Element => {
				const currentQuote = quotes?.[toAddress(token)] as TBebopOrderQuoteResponse;
				const buyPairs = Object.values(currentQuote?.buyTokens || {}).map((token): string => `${token?.contractAddress}_${token?.amount}`);
				return (
					<ApprovalWizardItem
						key={`${token}_${buyPairs}_${currentQuote?.receiver}_${index}`}
						token={token}
						index={index}
						isGnosisSafe={isGnosisSafe}
						signStep={signStep} />
				);
			})}
			<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
				<div className={'flex flex-col'} />
				<BebopBatchedFlow onUpdateSignStep={set_signStep} />
			</div>
		</>
	);
}

export default Wrapper;

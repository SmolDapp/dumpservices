import React, {useCallback, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedCowswapQuote, isCowswapOrder} from 'hooks/assertSolver';
import {addQuote, getSellAmount, setRefreshingQuote} from 'hooks/handleQuote';
import {getSpender, useSolver} from 'hooks/useSolver';
import notify from 'utils/notifier';
import {getApproveTransaction, getSetPreSignatureTransaction} from 'utils/tools.gnosis';
import {TStatus} from 'utils/types';
import {maxUint256} from 'viem';
import axios from 'axios';
import {SigningScheme} from '@cowprotocol/cow-sdk';
import {useSafeAppsSDK} from '@gnosis.pm/safe-apps-react-sdk';
import {IconSpinner} from '@icons/IconSpinner';
import {erc20ABI, readContract} from '@wagmi/core';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {CowswapApprovalWizard} from '../cowswap/ApprovalWizard';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TCowswapOrderQuoteResponse, TRequest} from 'utils/types';
import type {Hex} from 'viem';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {EcdsaSigningScheme} from '@cowprotocol/cow-sdk';
import type {BaseTransaction} from '@gnosis.pm/safe-apps-sdk';

type TExistingTx = {
	tx: BaseTransaction;
	orderUID: string;
};
type TSafeTxHistory = {
	safe: string;
	nonce: number;
};

function SafeXCowswapBatchedFlow(props: {onUpdateSignStep: Dispatch<SetStateAction<TDict<TStatus>>>}): ReactElement {
	const {provider} = useWeb3();
	const solver = useSolver();
	const {quotes, set_quotes} = useSweepooor();
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
		if (isCowswapOrder(quotes)) {
			for (const [key, currentQuote] of Object.entries(quotes.quote)) {
				if (currentQuote.orderUID && ['fulfilled', 'pending'].includes(currentQuote?.orderStatus || '')) {
					return; //skip already sent
				}
				set_quotes((prev): TRequest => setRefreshingQuote(prev, toAddress(key)));
				const {quoteResponse} = await solver.getQuote({
					from: toAddress(currentQuote.from),
					receiver: toAddress(currentQuote.quote.receiver),
					inputTokens: [currentQuote.sellToken],
					outputToken: currentQuote.buyToken,
					inputAmounts: [getSellAmount(quotes, toAddress(key)).raw],
					inputBalances: [0n] // Non relevant here
				});
				if (quoteResponse) {
					set_quotes((prev): TRequest => addQuote(prev, quoteResponse));
				}
			}
		}
		set_isRefreshingQuotes(false);
	}, [solver, quotes, set_quotes]);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** If the signer is a Gnosis Safe, we will use another way to perform the approvals and
	 ** signatures to be able to batch all the txs in one:
	 ** For each token:
	 ** - If it is non-approved, it will be approved
	 ** - The quote will be sent to the Cowswap API with signingScheme set to 'presign'
	 ** - A orderUID will be returned
	 **********************************************************************************************/
	const onExecuteFromGnosis = useCallback(async (): Promise<void> => {
		const preparedTransactions: BaseTransaction[] = [];
		const newlyExistingTransactions: TDict<TExistingTx> = {};
		const executedQuotes = [];

		if (!quotes) {
			return;
		}

		// Check approvals and add them to the batch if needed
		const {safeAddress} = await sdk.safe.getInfo();
		const allQuotes = getTypedCowswapQuote(quotes);
		for (const token of Object.keys(allQuotes.quote)) {
			const currentQuote = getTypedCowswapQuote(quotes);
			const tokenAddress = toAddress(token);
			const quoteOrder = currentQuote.quote[tokenAddress] as TCowswapOrderQuoteResponse;
			const spender = getSpender({chainID: safeChainID});
			const allowance = await readContract({
				abi: erc20ABI,
				address: tokenAddress,
				chainId: safeChainID,
				functionName: 'allowance',
				args: [toAddress(safeAddress), spender]
			});
			const isApproved = toBigInt(allowance) >= toBigInt(quoteOrder.sellToken.amount.raw);
			console.log(`[SafeXCowSwap] - ${tokenAddress} isApproved: ${isApproved} - ${allowance}`);
			if (!isApproved) {
				const newApprovalForBatch = getApproveTransaction(maxUint256, tokenAddress, spender);
				preparedTransactions.push(newApprovalForBatch);
			}

			quoteOrder.signature = '0x';
			quoteOrder.signingScheme = SigningScheme.PRESIGN as unknown as EcdsaSigningScheme;
			const quoteID = quoteOrder.id;
			if (!quoteID) {
				console.warn(`[SafeXCowSwap] - No quote for ${tokenAddress}`);
				continue;
			}

			const existingTx = existingTransactions[String(quoteOrder.id)];
			if (existingTx) {
				//we already have an execute tx for this token in our batch
				console.warn(`[SafeXCowSwap] - Execute for ${tokenAddress} already in batch`);
				preparedTransactions.push(existingTx.tx);
				executedQuotes.push({...quoteOrder, orderUID: existingTx.orderUID});
				props.onUpdateSignStep(
					(prev): TDict<TStatus> => ({
						...prev,
						[tokenAddress]: TStatus.VALID
					})
				);
				continue;
			}

			props.onUpdateSignStep(
				(prev): TDict<TStatus> => ({
					...prev,
					[tokenAddress]: TStatus.PENDING
				})
			);
			try {
				await solver.execute(quotes, tokenAddress, true, (orderUID): void => {
					const newPreSignatureForBatch = getSetPreSignatureTransaction(
						toAddress(process.env.COWSWAP_GPV2SETTLEMENT_ADDRESS),
						orderUID as Hex,
						true
					);
					newlyExistingTransactions[String(quoteOrder.id)] = {
						tx: newPreSignatureForBatch,
						orderUID
					};
					preparedTransactions.push(newPreSignatureForBatch);
					executedQuotes.push({...quoteOrder, orderUID});
					props.onUpdateSignStep(
						(prev): TDict<TStatus> => ({
							...prev,
							[tokenAddress]: TStatus.VALID
						})
					);
				});
			} catch (error) {
				props.onUpdateSignStep(
					(prev): TDict<TStatus> => ({
						...prev,
						[tokenAddress]: TStatus.INVALID
					})
				);
			}
		}

		set_existingTransactions(
			(existingTransactions: TDict<TExistingTx>): TDict<TExistingTx> => ({
				...existingTransactions,
				...newlyExistingTransactions
			})
		);
		try {
			const {safeTxHash} = await sdk.txs.send({txs: Object.values(preparedTransactions)});
			try {
				const tx = (await axios.get(
					`https://safe-transaction-mainnet.safe.global/api/v1/multisig-transactions/${safeTxHash}`
				)) as TSafeTxHistory;
				notify(executedQuotes, 'COWSWAP', 'Safe', safeTxHash, tx);
			} catch (error) {
				notify(executedQuotes, 'COWSWAP', 'Safe', safeTxHash);
			}
			set_isApproving(false);
			console.log(safeTxHash);
		} catch (error) {
			console.error(error);
			set_isApproving(false);
		}
	}, [quotes, provider, safeChainID, existingTransactions, props, solver, sdk.txs]);

	return (
		<div className={'flex flex-row items-center space-x-4'}>
			<button
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
				isDisabled={Object.values(quotes?.quote || {}).length === 0}
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
	const {quotes} = useSweepooor();
	const [approvalStep] = useState<TDict<TStatus>>({});
	const [signStep, set_signStep] = useState<TDict<TStatus>>({});
	const [executeStep] = useState<TDict<TStatus>>({});

	return (
		<>
			{Object.entries(getTypedCowswapQuote(quotes).quote).map(([token, currentQuote], index): JSX.Element => {
				return (
					<CowswapApprovalWizard
						key={`${token}_${currentQuote?.quote?.buyAmount}_${currentQuote?.quote?.receiver}_${index}`}
						token={currentQuote.sellToken}
						index={index}
						hasSignature={((currentQuote as TCowswapOrderQuoteResponse)?.signature || '') !== ''}
						approvalStep={approvalStep}
						signStep={signStep}
						executeStep={executeStep}
					/>
				);
			})}
			<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
				<div className={'flex flex-col'} />
				<SafeXCowswapBatchedFlow onUpdateSignStep={set_signStep} />
			</div>
		</>
	);
}

export default Wrapper;

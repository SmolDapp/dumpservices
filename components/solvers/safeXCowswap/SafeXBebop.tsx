import React, {useCallback, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedBebopQuote, hasQuote} from 'hooks/assertSolver';
import {addQuote} from 'hooks/handleQuote';
import {getSpender, useSolver} from 'hooks/useSolver';
import {isApprovedERC20} from 'utils/actions';
import {getApproveTransaction, getSetPreSignatureTransaction} from 'utils/tools.gnosis';
import {maxUint256, stringToHex} from 'viem';
import {useSafeAppsSDK} from '@gnosis.pm/safe-apps-react-sdk';
import {IconSpinner} from '@icons/IconSpinner';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';

import {BebopApprovalWizard} from '../bebop/ApprovalWizard';
import {SuccessModal} from '../bebop/ApprovalWizard.SuccessModal';

import type {ReactElement} from 'react';
import type {TQuote, TRequestArgs, TStatus, TToken, TTokenWithAmount} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {BaseTransaction} from '@gnosis.pm/safe-apps-sdk';

function SafeXBebopBatchedFlow(props: {onRefreshQuote: () => Promise<void>}): ReactElement {
	const {provider} = useWeb3();
	const solver = useSolver();
	const {quotes} = useSweepooor();
	const [isApproving, set_isApproving] = useState(false);
	const [isRefreshingQuotes] = useState(false);
	const {safeChainID} = useChainID();
	const {sdk} = useSafeAppsSDK();

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

		if (!quotes) {
			return;
		}

		// Check approvals and add them to the batch if needed
		const currentQuote = getTypedBebopQuote(quotes);
		for (const token of Object.values(currentQuote.sellTokens)) {
			const tokenAddress = toAddress(token.address);
			const spender = getSpender({chainID: safeChainID});
			const isApproved = await isApprovedERC20({
				connector: provider,
				chainID: safeChainID,
				contractAddress: tokenAddress,
				spenderAddress: spender,
				amount: maxUint256
			});
			if (!isApproved) {
				const newApprovalForBatch = getApproveTransaction(maxUint256, tokenAddress, spender);
				preparedTransactions.push(newApprovalForBatch);
			}

			try {
				await solver.execute(quotes, tokenAddress, true, (orderUID): void => {
					const newPreSignatureForBatch = getSetPreSignatureTransaction(
						toAddress(process.env.COWSWAP_GPV2SETTLEMENT_ADDRESS),
						stringToHex(orderUID),
						true
					);
					preparedTransactions.push(newPreSignatureForBatch);
				});
			} catch (error) {
				console.error(error);
			}
		}

		try {
			const {safeTxHash} = await sdk.txs.send({txs: Object.values(preparedTransactions)});
			console.warn(safeTxHash);
			try {
				// const tx = (await axios.get(
				// 	`https://safe-transaction-mainnet.safe.global/api/v1/multisig-transactions/${safeTxHash}`
				// )) as TSafeTxHistory;
				// notify(executedQuotes, 'BEBOP', 'Safe', safeTxHash, tx);
			} catch (error) {
				// notify(executedQuotes, 'BEBOP', 'Safe', safeTxHash);
			}
			set_isApproving(false);
			console.log(safeTxHash);
		} catch (error) {
			console.error(error);
			set_isApproving(false);
		}
	}, [quotes, provider, safeChainID, solver, sdk.txs]);

	return (
		<div className={'flex flex-row items-center space-x-4'}>
			<button
				onClick={props.onRefreshQuote}
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
	const {address} = useWeb3();
	const {quotes, set_quotes, receiver, destination, onReset} = useSweepooor();
	const [approvalStep] = useState<TDict<TStatus>>({});
	const solver = useSolver();
	const currentQuote = getTypedBebopQuote(quotes);

	const prepareRequest = useCallback((): TRequestArgs => {
		const previousInputTokens = Object.values(quotes?.sellTokens || []).map((token: TTokenWithAmount): TToken => {
			return {
				address: token.address,
				name: token.name,
				symbol: token.symbol,
				decimals: token.decimals,
				chainId: token.chainId
			};
		});
		const previousInputAmounts = Object.values(quotes?.sellTokens || []).map((token: TTokenWithAmount): bigint => {
			return toBigInt(token.amount.raw);
		});

		const request: TRequestArgs = {
			from: toAddress(address),
			receiver: toAddress(receiver),
			inputTokens: previousInputTokens,
			outputToken: {
				address: destination.address,
				name: destination.name,
				symbol: destination.symbol,
				decimals: destination.decimals,
				chainId: destination.chainId
			},
			inputAmounts: previousInputAmounts,
			inputBalances: previousInputAmounts
		};
		return request;
	}, [
		address,
		destination.address,
		destination.chainId,
		destination.decimals,
		destination.name,
		destination.symbol,
		quotes?.sellTokens,
		receiver
	]);

	const onHandleQuote = useCallback(async (): Promise<void> => {
		if (currentQuote.quote.isExecuted || currentQuote.quote.isExecuting) {
			return;
		}
		const request = prepareRequest();
		const {quoteResponse, isSuccess, error} = await solver.getQuote(request);
		if (isSuccess && quoteResponse) {
			set_quotes((q): TQuote => addQuote(q, quoteResponse));
			return;
		}
		if (error) {
			toast({type: 'error', content: error.message});
		}
		return;
	}, [currentQuote, prepareRequest, set_quotes, solver]);

	if (!hasQuote(quotes, '') || toBigInt(getTypedBebopQuote(quotes).quote.buyToken.amount.raw) === 0n) {
		return (
			<div className={'py-20'}>
				<p className={'text-sm text-neutral-400/60'}>{'Select a token to dump'}</p>
			</div>
		);
	}

	return (
		<>
			<BebopApprovalWizard
				onRefreshQuote={onHandleQuote}
				approvalStep={approvalStep}
			/>
			<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
				<div className={'flex flex-col'} />
				<SafeXBebopBatchedFlow onRefreshQuote={onHandleQuote} />
			</div>
			<SuccessModal
				txHashURI={`${getNetwork(currentQuote.quote.chainId).blockExplorers?.etherscan?.url}/tx/${
					currentQuote.quote.txHash
				}`}
				isOpen={currentQuote.quote.isExecuted}
				onClose={(): void => onReset()}
			/>
		</>
	);
}

export default Wrapper;

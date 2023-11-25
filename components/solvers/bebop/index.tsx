import React, {useCallback, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedBebopQuote, hasQuote} from 'hooks/assertSolver';
import {addQuote} from 'hooks/handleQuote';
import {useSolver} from 'hooks/useSolver';
import {serialize} from 'wagmi';
import {useDeepCompareMemo} from '@react-hookz/web';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';

import {BebopApprovalWizard} from './ApprovalWizard';
import {BebopButtons} from './ApprovalWizard.Buttons';
import {SuccessModal} from './ApprovalWizard.SuccessModal';

import type {ReactElement} from 'react';
import type {TBebopRequest, TQuote, TRequest, TRequestArgs, TStatus, TToken, TTokenWithAmount} from 'utils/types';
import type {Hex} from 'viem';
import type {TDict} from '@yearn-finance/web-lib/types';

function Wrapper(): ReactElement {
	const {address} = useWeb3();
	const {quotes, set_quotes, receiver, destination, onReset} = useSweepooor();
	const [approvalStep, set_approvalStep] = useState<TDict<TStatus>>({});
	const solver = useSolver();
	const currentQuote = useDeepCompareMemo((): TRequest & TBebopRequest => {
		return getTypedBebopQuote(quotes);
	}, [serialize(quotes)]);

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

	const onUpdateSignStep = useCallback(
		(isSuccess: boolean, isSigning: boolean, hasError: boolean, signature: Hex) => {
			set_quotes((q): TRequest & TBebopRequest => {
				const previousQuote = getTypedBebopQuote(q);
				return {
					...previousQuote,
					quote: {
						...previousQuote.quote,
						isSigned: isSuccess,
						isSigning: isSigning,
						hasSignatureError: hasError,
						signature
					}
				};
			});
		},
		[set_quotes]
	);

	const onUpdateExecuteStep = useCallback(
		(isSuccess: boolean, isExecuting: boolean, hasError: boolean, txHash: Hex) => {
			set_quotes((q): TRequest & TBebopRequest => {
				const previousQuote = getTypedBebopQuote(q);
				return {
					...previousQuote,
					quote: {
						...previousQuote.quote,
						isExecuted: isSuccess,
						isExecuting: isExecuting,
						hasExecutionError: hasError,
						txHash
					}
				};
			});
		},
		[set_quotes]
	);

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
			<div className={'flex w-full flex-row items-center justify-between p-4 md:relative md:px-0 md:pb-0'}>
				<BebopButtons
					onRefreshQuote={onHandleQuote}
					isRefreshingQuote={currentQuote.quote.isRefreshing}
					approvals={approvalStep}
					onUpdateApprovalStep={set_approvalStep}
					onUpdateSignStep={onUpdateSignStep}
					onUpdateExecuteStep={onUpdateExecuteStep}
				/>
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

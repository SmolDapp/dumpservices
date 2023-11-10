import React, {useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedBebopQuote} from 'hooks/assertSolver';
import {useAsyncTrigger} from 'hooks/useAsyncEffect';
import {serialize} from 'wagmi';
import axios from 'axios';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {IconLoader} from '@yearn-finance/web-lib/icons/IconLoader';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {BebopApprovalWizard} from './ApprovalWizard';
import {BebopButtons} from './Buttons';

import type {ReactElement} from 'react';
import type {TBebopJamQuoteAPIResp, TStatus} from 'utils/types';
import type {Hex} from 'viem';
import type {TDict} from '@yearn-finance/web-lib/types';

function Wrapper(): ReactElement {
	const {address} = useWeb3();
	const {quotes, receiver} = useSweepooor();
	const [approvalStep, set_approvalStep] = useState<TDict<TStatus>>({});
	const [aggregatedQuote, set_aggregatedQuote] = useState<TBebopJamQuoteAPIResp | null>(null);
	const [isRefreshingQuote, set_isRefreshingQuote] = useState(false);
	const listOfQuotes = useMemo(
		() =>
			Object.values(getTypedBebopQuote(quotes).quote).filter(
				quote => toBigInt(quote?.buyToken?.amount?.raw) > 0n
			),
		[quotes]
	);

	const onRefreshAggregatedQuote = useAsyncTrigger(async (): Promise<void> => {
		if (!quotes) {
			return;
		}
		const hasNoActualQuotes = Object.values(quotes.sellTokens).every(({amount}) => toBigInt(amount.raw) === 0n);
		if (hasNoActualQuotes) {
			return;
		}
		set_isRefreshingQuote(true);
		const requestURI = new URL(`http://${'localhost:3000'}/api/jamProxy`);
		requestURI.searchParams.append('buy_tokens', quotes.buyToken.address);
		requestURI.searchParams.append(
			'sell_tokens',
			Object.values(quotes.sellTokens)
				.map(({address}): string => address)
				.join(',')
		);
		requestURI.searchParams.append(
			'sell_amounts',
			Object.values(quotes.sellTokens)
				.map(({amount}): string => toBigInt(amount.raw).toString())
				.join(',')
		);
		requestURI.searchParams.append('taker_address', toAddress(address));
		requestURI.searchParams.append('receiver_address', toAddress(receiver));
		requestURI.searchParams.append('approval_type', 'Standard');
		requestURI.searchParams.append('source', 'smol');
		const {data} = await axios.get(requestURI.toString());
		set_aggregatedQuote(data);
		set_isRefreshingQuote(false);
	}, [address, serialize(quotes), receiver]);

	if (listOfQuotes.length === 0) {
		return (
			<div className={'py-20'}>
				<p className={'text-sm text-neutral-400/60'}>{'Select a token to dump'}</p>
			</div>
		);
	}
	if (!aggregatedQuote) {
		return (
			<div className={'py-20'}>
				<IconLoader className={`h-4 w-4 animate-spin text-neutral-900`} />
			</div>
		);
	}

	return (
		<>
			<BebopApprovalWizard
				aggregatedQuote={aggregatedQuote}
				onRefreshAggregatedQuote={onRefreshAggregatedQuote}
				approvalStep={approvalStep}
			/>
			<div className={'flex w-full flex-row items-center justify-between p-4 md:relative md:px-0 md:pb-0'}>
				<BebopButtons
					aggregatedQuote={aggregatedQuote}
					onRefreshAggregatedQuote={onRefreshAggregatedQuote}
					isRefreshingQuote={isRefreshingQuote}
					approvals={approvalStep}
					onUpdateApprovalStep={set_approvalStep}
					onUpdateSignStep={(isSuccess: boolean, isSigning: boolean, hasError: boolean, signature: Hex) =>
						set_aggregatedQuote((q): TBebopJamQuoteAPIResp => {
							return {
								...(q as TBebopJamQuoteAPIResp),
								isSigned: isSuccess,
								isSigning: isSigning,
								hasSignatureError: hasError,
								signature
							};
						})
					}
					onUpdateExecuteStep={(isSuccess: boolean, isExecuting: boolean, hasError: boolean, txHash: Hex) =>
						set_aggregatedQuote((q): TBebopJamQuoteAPIResp => {
							return {
								...(q as TBebopJamQuoteAPIResp),
								isExecuted: isSuccess,
								isExecuting: isExecuting,
								hasExecutionError: hasError,
								txHash
							};
						})
					}
				/>
			</div>
		</>
	);
}

export default Wrapper;

import React, {useState} from 'react';
import IconCheck from 'components/icons/IconCheck';
import IconChevronBoth from 'components/icons/IconChevronBoth';
import IconCircleCross from 'components/icons/IconCircleCross';
import IconSpinner from 'components/icons/IconSpinner';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {getBuyAmount, getValidTo, isBebopOrder, isCowswapOrder, shouldRefreshQuote} from 'hooks/assertSolver';
import {getSpender} from 'hooks/useSolverCowswap';
import {TPossibleFlowStep,TPossibleStatus} from 'utils/types';
import {erc20ABI, useContractRead} from 'wagmi';
import {useIntervalEffect, useUpdateEffect} from '@react-hookz/web';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate, formatDuration} from '@yearn-finance/web-lib/utils/format.time';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';

import type {ReactElement} from 'react';
import type {TCowswapOrderQuoteResponse, TOrderQuote} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

type TApprovalWizardItem = {
	token: TAddress,
	index: number,
	isGnosisSafe: boolean,
	hasSignature: boolean,
	approvalStep: TDict<TPossibleFlowStep>,
	signStep: TDict<TPossibleFlowStep>,
	executeStep: TDict<TPossibleFlowStep>,
}

function SumaryExpiration({currentQuote, token, isGnosisSafe}: {
	currentQuote: TOrderQuote,
	token: TAddress,
	isGnosisSafe: boolean
}): ReactElement {
	const [expireIn, set_expireIn] = useState(0);
	const hasQuote = Boolean(currentQuote);
	const quoteExpiration = Number(isGnosisSafe ? getValidTo(currentQuote) : (currentQuote?.expirationTimestamp || 0)) * 1000;

	useIntervalEffect((): void => {
		set_expireIn(quoteExpiration - new Date().valueOf());
		if (shouldRefreshQuote(currentQuote, isGnosisSafe)) {
			document?.getElementById(`quote-refresh-${toAddress(token)}`)?.click();
		}
	}, (!hasQuote ? undefined : 1000));

	useUpdateEffect((): void => {
		set_expireIn(quoteExpiration - new Date().valueOf());
		if (shouldRefreshQuote(currentQuote, isGnosisSafe)) {
			document?.getElementById(`quote-refresh-${toAddress(token)}`)?.click();
		}
	}, [quoteExpiration]);

	function renderExpiration(): ReactElement {
		if (currentQuote?.orderUID) {
			return (
				<small className={'text-xs tabular-nums text-neutral-500'}>
					&nbsp;
				</small>
			);
		}

		if (Math.floor(expireIn / 1000) <= 0) {
			return (
				<div className={'tooltip'}>
					<small className={'text-xs tabular-nums text-[#f97316]'}>
						{'Updating quote...'}
					</small>
				</div>
			);
		}
		if (Math.floor(expireIn / 1000) < 60) {
			return (
				<div className={'tooltip'}>
					<small className={'text-xs tabular-nums text-neutral-500'}>
						{`The quote will be updated in ${Math.floor(expireIn / 1000)}s`}
					</small>
					<span className={'tooltiptext z-[100000] text-xs'}>
						<p suppressHydrationWarning>{'After 60 seconds, an automated request for a new quote will be made.'}</p>
					</span>
				</div>
			);
		}
		return (
			<div className={'tooltip'}>
				<small className={'text-xs tabular-nums text-neutral-500'}>
					{`The quote will be updated in ${formatDuration(expireIn)}`}
				</small>
				<span className={'tooltiptext z-[100000] text-xs'}>
					<p suppressHydrationWarning>{'After 60 seconds, an automated request for a new quote will be made.'}</p>
				</span>
			</div>
		);

	}

	return (
		<div className={'flex flex-row items-center space-x-2'}>
			{renderExpiration()}
			<IconChevronBoth className={'mt-0.5 h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900'} />
		</div>
	);
}

function SummaryIndicator({token, isGnosisSafe, hasSignature, approvalStep, signStep, executeStep}: TApprovalWizardItem): ReactElement {
	const {amounts, quotes, destination} = useSweepooor();
	const [step, set_step] = useState<'Approve' | 'Sign' | 'Execute'>(isGnosisSafe ? 'Sign' : 'Approve');
	const currentQuote = quotes[toAddress(token)];
	const {safeChainID} = useChainID();

	const {data: allowance} = useContractRead({
		address: toAddress(token),
		abi: erc20ABI,
		functionName: 'allowance',
		args: [getSpender({chainID: safeChainID}), toAddress(token)]
	});
	const hasAllowance = toBigInt(allowance) >= amounts[toAddress(token)]?.raw;

	useUpdateEffect((): void => {
		if (hasAllowance) {
			set_step('Sign');
		}
	}, [hasAllowance, step]);

	function renderExplorerLink(): ReactElement {
		if (isCowswapOrder(currentQuote)) {
			return (
				<a
					href={`https://explorer.cow.fi/orders/${currentQuote.orderUID}`}
					target={'_blank'}
					className={'text-neutral-500 hover:underline'}
					rel={'noreferrer'}>
					{'(see order)'}
				</a>
			);
		}

		if (isBebopOrder(currentQuote)) {
			const explorer = getNetwork(safeChainID)?.defaultBlockExplorer;
			return (
				<a
					href={`${explorer}/tx/${currentQuote.orderUID}`}
					target={'_blank'}
					className={'text-neutral-500 hover:underline'}
					rel={'noreferrer'}>
					{'(see transaction)'}
				</a>
			);
		}

		return <span />;
	}

	function renderApprovalIndication(): ReactElement {
		if (hasAllowance) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (!currentQuote?.id || !approvalStep[currentQuote?.id] || approvalStep[currentQuote?.id] === 'undetermined') {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (approvalStep[currentQuote?.id] === 'pending') {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	function renderSignatureIndication(): ReactElement {
		if (!currentQuote?.id) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (step !== 'Sign' || !signStep[currentQuote?.id] || signStep[currentQuote?.id] === 'undetermined') {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (hasSignature) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (signStep[currentQuote?.id] === 'pending') {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	function renderExecuteIndication(): ReactElement {
		if (!currentQuote?.orderStatus) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (currentQuote.orderStatus === TPossibleStatus.COWSWAP_FULFILLED) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (currentQuote.orderStatus === TPossibleStatus.BEBOP_CONFIRMED) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (executeStep[currentQuote?.id || ''] === TPossibleFlowStep.VALID) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}

		if (currentQuote.orderStatus === TPossibleStatus.PENDING) {
			return <IconSpinner />;
		}
		if (executeStep[currentQuote?.id || ''] === TPossibleFlowStep.PENDING) {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	if (isGnosisSafe) {
		return (
			<div className={'flex flex-row items-center space-x-2 pt-2 md:space-x-4'}>
				<div className={'flex flex-row items-center justify-center space-x-2'}>
					{renderSignatureIndication()}
					<small>{'Signed'}</small>
				</div>
				<div className={'text-neutral-600'} style={{paddingBottom: 1}}>&rarr;</div>
				<div className={'flex flex-row items-center space-x-2'}>
					{renderExecuteIndication()}
					<small>
						{'Executed '}
						{renderExplorerLink()}
					</small>
				</div>
			</div>
		);
	}
	return (
		<div className={'flex flex-row items-center space-x-2 pt-2 md:space-x-4'}>
			<div className={'flex flex-row items-center justify-center space-x-2'}>
				{renderApprovalIndication()}
				<small>{'Approved'}</small>
			</div>
			<div className={'text-neutral-600'} style={{paddingBottom: 1}}>&rarr;</div>
			<div className={'flex flex-row items-center space-x-2'}>
				{renderSignatureIndication()}
				<small>
					{'Signed for '}
					<span className={'font-bold tabular-nums'}>
						{formatAmount(Number(getBuyAmount(currentQuote).normalized), 6, 6)}
					</span>
					{` ${destination.symbol}`}
				</small>
			</div>
			<div className={'text-neutral-600'} style={{paddingBottom: 1}}>&rarr;</div>
			<div className={'flex flex-row items-center space-x-2'}>
				{renderExecuteIndication()}
				<small>
					{'Executed '}
					{renderExplorerLink()}
				</small>
			</div>
		</div>
	);
}

function CowswapTXDetails({currentQuote, token}: {currentQuote: TCowswapOrderQuoteResponse, token: TAddress}): ReactElement {
	const {balances} = useWallet();

	return (
		<div className={'font-number space-y-2 border-t-0 p-4 text-xs md:text-sm'}>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Kind'}</b>
				<p className={'font-number'}>{currentQuote?.quote?.kind || ''}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'From'}</b>
				<p className={'font-number'}>{toAddress(currentQuote?.from || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Receiver'}</b>
				<p className={'font-number'}>{toAddress(currentQuote?.quote?.receiver || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'BuyAmount'}</b>
				<p className={'font-number'}>
					{`${getBuyAmount(currentQuote).normalized} (${getBuyAmount(currentQuote).raw || ''})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'BuyToken'}</b>
				<p className={'font-number'}>
					{`${balances?.[toAddress(currentQuote?.quote?.buyToken)]?.symbol || ''} (${toAddress(currentQuote?.quote?.buyToken || '')})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'SellAmount'}</b>
				<p className={'font-number'}>
					{`${toNormalizedBN(
						currentQuote?.quote?.sellAmount || '',
						currentQuote?.request?.inputToken?.decimals || 18
					).normalized} (${currentQuote?.quote?.sellAmount || ''})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'FeeAmount'}</b>
				<p className={'font-number'}>
					{`${toNormalizedBN(
						currentQuote?.quote?.feeAmount || '',
						currentQuote?.request?.inputToken?.decimals || 18
					).normalized} (${currentQuote?.quote?.feeAmount || ''})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'SellToken'}</b>
				<p className={'font-number'}>
					{`${balances?.[toAddress(token)]?.symbol || ''} (${toAddress(currentQuote?.quote?.sellToken || '')})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'ValidTo'}</b>
				<p className={'font-number'}>
					{formatDate(getValidTo(currentQuote))}
				</p>
			</span>
		</div>
	);
}

function ApprovalWizardItem(props: TApprovalWizardItem): ReactElement {
	const {amounts, quotes, destination} = useSweepooor();
	const {balances} = useWallet();
	const currentQuote = quotes[toAddress(props.token)];

	return (
		<details
			key={props.index}
			className={'group mb-0 flex w-full flex-col justify-center rounded-none border border-x-0 border-neutral-200 bg-neutral-0 transition-colors hover:bg-neutral-100 md:mb-2 md:rounded-md md:border-x'}>
			<summary className={'flex flex-col items-start py-2'}>
				<div className={'flex w-full flex-col items-start justify-between md:flex-row md:items-center'}>
					<div className={'text-left text-sm'}>
						{'Swapping '}
						<span className={'font-number font-bold'}>
							{formatAmount(Number(amounts[toAddress(props.token)]?.normalized || 0), 6, 6)}
						</span>
						{` ${balances?.[toAddress(props.token)]?.symbol || 'Tokens'} for at least `}
						<span className={'font-number font-bold'}>
							{formatAmount(Number(getBuyAmount(currentQuote).normalized), 6, 6)}
						</span>
						{` ${destination.symbol}`}
					</div>
					<SumaryExpiration
						currentQuote={currentQuote}
						token={props.token}
						isGnosisSafe={props.isGnosisSafe}
					/>
				</div>
				<SummaryIndicator {...props} />
			</summary>

			{isCowswapOrder(currentQuote) && <CowswapTXDetails currentQuote={currentQuote} token={props.token} />}
		</details>
	);
}

export default ApprovalWizardItem;

import React, {useEffect, useState} from 'react';
import IconCheck from 'components/icons/IconCheck';
import IconChevronBoth from 'components/icons/IconChevronBoth';
import IconCircleCross from 'components/icons/IconCircleCross';
import IconSpinner from 'components/icons/IconSpinner';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {getSpender} from 'hooks/useSolverCowswap';
import {isApprovedERC20} from 'utils/actions';
import {useAsync, useIntervalEffect, useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate, formatDuration} from '@yearn-finance/web-lib/utils/format.time';

import type {ReactElement} from 'react';
import type {TPossibleFlowStep} from 'utils/types';
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
function ApprovalWizardItem({
	token,
	index,
	isGnosisSafe,
	hasSignature,
	approvalStep,
	signStep,
	executeStep
}: TApprovalWizardItem): ReactElement {
	const {provider} = useWeb3();
	const {amounts, quotes, destination} = useSweepooor();
	const {balances} = useWallet();
	const [expireIn, set_expireIn] = useState(0);
	const [step, set_step] = useState<'Approve' | 'Sign' | 'Execute'>(isGnosisSafe ? 'Sign' : 'Approve');
	const hasQuote = Boolean(quotes[toAddress(token)]);
	const currentQuote = quotes[toAddress(token)];
	const quoteExpiration = Number(isGnosisSafe ? (currentQuote?.quote?.validTo || 0) : (currentQuote?.expirationTimestamp || 0)) * 1000;
	const {safeChainID} = useChainID();

	const [{result: hasAllowance}, triggerAllowanceCheck] = useAsync(async (): Promise<boolean> => {
		return await isApprovedERC20({
			connector: provider,
			contractAddress: toAddress(token),
			spenderAddress: getSpender({chainID: safeChainID}),
			amount: amounts[toAddress(token)]?.raw
		});
	}, false);

	useEffect((): void => {
		triggerAllowanceCheck.execute();
	}, [triggerAllowanceCheck, token, approvalStep]);

	useIntervalEffect((): void => {
		set_expireIn(quoteExpiration - new Date().valueOf());
		if (quoteExpiration < new Date().valueOf() && !currentQuote?.orderUID) {
			document?.getElementById(`quote-refresh-${toAddress(toAddress(token))}`)?.click();
		}
	}, (!hasQuote ? undefined : 1000));

	useUpdateEffect((): void => {
		set_expireIn(quoteExpiration - new Date().valueOf());
		if (quoteExpiration < new Date().valueOf() && !currentQuote?.orderUID) {
			document?.getElementById(`quote-refresh-${toAddress(toAddress(token))}`)?.click();
		}
	}, [quoteExpiration]);

	useUpdateEffect((): void => {
		if (hasAllowance) {
			set_step('Sign');
		}
	}, [hasAllowance, step]);

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
		if (currentQuote.orderStatus === 'fulfilled' || executeStep[currentQuote?.id || ''] === 'valid') {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (currentQuote.orderStatus === 'pending' || executeStep[currentQuote?.id || ''] === 'pending') {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	function renderIndicators(): ReactElement {
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
							{currentQuote?.orderUID ? (
								<a
									href={`https://explorer.cow.fi/orders/${currentQuote?.orderUID}`}
									target={'_blank'}
									className={'text-neutral-500 hover:underline'}
									rel={'noreferrer'}>
									{'(see order)'}
								</a>
							) : null}
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
							{formatAmount(Number(toNormalizedBN(
								currentQuote?.quote?.buyAmount || '',
								currentQuote?.request?.outputToken?.decimals || 18
							).normalized), 6, 6)}
						</span>
						{` ${destination.symbol}`}
					</small>
				</div>
				<div className={'text-neutral-600'} style={{paddingBottom: 1}}>&rarr;</div>
				<div className={'flex flex-row items-center space-x-2'}>
					{renderExecuteIndication()}
					<small>
						{'Executed '}
						{currentQuote?.orderUID ? (
							<a
								href={`https://explorer.cow.fi/orders/${currentQuote?.orderUID}`}
								target={'_blank'}
								className={'text-neutral-500 hover:underline'}
								rel={'noreferrer'}>
								{'(see order)'}
							</a>
						) : null}
					</small>
				</div>
			</div>
		);
	}

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
		<details
			key={index}
			className={'group mb-0 flex w-full flex-col justify-center rounded-none border border-x-0 border-neutral-200 bg-neutral-0 transition-colors hover:bg-neutral-100 md:mb-2 md:rounded-md md:border-x'}>
			<summary className={'flex flex-col items-start py-2'}>
				<div className={'flex w-full flex-col items-start justify-between md:flex-row md:items-center'}>
					<div className={'text-left text-sm'}>
						{'Swapping '}
						<span className={'font-number font-bold'}>
							{formatAmount(Number(amounts[toAddress(token)]?.normalized || 0), 6, 6)}
						</span>
						{` ${balances?.[toAddress(token)]?.symbol || 'Tokens'} for at least `}
						<span className={'font-number font-bold'}>
							{formatAmount(Number(toNormalizedBN(
								currentQuote?.quote?.buyAmount || '',
								currentQuote?.request?.outputToken?.decimals || 18
							).normalized), 6, 6)}
						</span>
						{` ${destination.symbol}`}
					</div>
					<div className={'flex flex-row items-center space-x-2'}>
						{renderExpiration()}
						<IconChevronBoth className={'mt-0.5 h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900'} />
					</div>
				</div>
				{renderIndicators()}
			</summary>
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
						{`${toNormalizedBN(
							currentQuote?.quote?.buyAmount || '',
							currentQuote?.request?.outputToken?.decimals || 18
						).normalized} (${currentQuote?.quote?.buyAmount || ''})`}
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
						{formatDate(currentQuote?.quote?.validTo || 0)}
					</p>
				</span>
			</div>
		</details>
	);
}

export default ApprovalWizardItem;

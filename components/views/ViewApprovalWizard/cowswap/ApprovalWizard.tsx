import React, {useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {isQuote} from 'hooks/assertSolver';
import {refreshQuote} from 'hooks/handleQuote';
import {getBuyAmount, getSellAmount, getValidTo, shouldRefreshQuote} from 'hooks/helperWithSolver';
import {getSpender} from 'hooks/useSolverCowswap';
import {TPossibleStatus, TStatus} from 'utils/types';
import {erc20ABI, useContractRead} from 'wagmi';
import {IconCheck} from '@icons/IconCheck';
import {IconChevronBoth} from '@icons/IconChevronBoth';
import {IconCircleCross} from '@icons/IconCircleCross';
import {IconSpinner} from '@icons/IconSpinner';
import {useIntervalEffect, useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDuration} from '@yearn-finance/web-lib/utils/format.time';

import {CowswapDetails} from './DropdownDetails';

import type {ReactElement} from 'react';
import type {TRequest} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';

function Expiration({quotes, token}: {quotes: TRequest; token: TAddress}): ReactElement {
	const {isWalletSafe} = useWeb3();
	const [expireIn, set_expireIn] = useState(0);
	const currentQuote = quotes.quote[token];
	const hasQuote = Boolean(currentQuote);
	const quoteExpiration = getValidTo(quotes, token, isWalletSafe);

	useIntervalEffect(
		(): void => {
			set_expireIn(quoteExpiration - new Date().valueOf());
			if (shouldRefreshQuote(quotes, token, isWalletSafe)) {
				refreshQuote(token);
			}
		},
		!hasQuote ? undefined : 1000
	);

	useUpdateEffect((): void => {
		set_expireIn(quoteExpiration - new Date().valueOf());
		if (shouldRefreshQuote(quotes, token, isWalletSafe)) {
			refreshQuote(token);
		}
	}, [quoteExpiration]);

	function renderExpiration(): ReactElement {
		if (currentQuote.orderUID) {
			return <small className={'text-xs tabular-nums text-neutral-500'}>&nbsp;</small>;
		}

		if (Math.floor(expireIn) <= 0) {
			return (
				<div className={'tooltip'}>
					<small className={'text-xs tabular-nums text-[#f97316]'}>{'Updating quote...'}</small>
				</div>
			);
		}
		if (Math.floor(expireIn) < 60_000) {
			return (
				<div className={'tooltip'}>
					<small
						className={'text-xs tabular-nums text-neutral-500'}>{`The quote will be updated in ${Math.floor(
						expireIn / 1000
					)}s`}</small>
					<span className={'tooltiptext z-[100000] text-xs'}>
						<p suppressHydrationWarning>
							{'After 60 seconds, an automated request for a new quote will be made.'}
						</p>
					</span>
				</div>
			);
		}
		return (
			<div className={'tooltip'}>
				<small
					className={'text-xs tabular-nums text-neutral-500'}>{`The quote will be updated in ${formatDuration(
					expireIn
				)}`}</small>
				<span className={'tooltiptext z-[100000] text-xs'}>
					<p suppressHydrationWarning>
						{'After 60 seconds, an automated request for a new quote will be made.'}
					</p>
				</span>
			</div>
		);
	}

	return (
		<div className={'flex flex-row items-center space-x-2'}>
			{renderExpiration()}
			<IconChevronBoth
				className={'mt-0.5 h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900'}
			/>
		</div>
	);
}

function Indicators({token, hasSignature, approvalStep, signStep, executeStep}: TCowswapApprovalWizard): ReactElement {
	const {address, isWalletSafe} = useWeb3();
	const {quotes, destination} = useSweepooor();
	const {safeChainID} = useChainID();
	const shouldApprove = useMemo((): boolean => {
		return !token || !approvalStep[token] || approvalStep[token] === TStatus.UNDETERMINED;
	}, [approvalStep, token]);
	const shouldSign = useMemo((): boolean => {
		return !token || !signStep[token] || signStep[token] === TStatus.UNDETERMINED;
	}, [signStep, token]);

	const {data: hasAllowance} = useContractRead({
		address: token,
		abi: erc20ABI,
		functionName: 'allowance',
		args: [toAddress(address), getSpender({chainID: safeChainID})],
		select: (data): boolean => toBigInt(data) >= toBigInt(quotes?.sellTokens?.[token]?.amount?.raw)
	});

	function renderExplorerLink(): ReactElement {
		const currentQuote = quotes?.quote[token];
		if (currentQuote?.orderUID) {
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
		return <span />;
	}

	function renderApprovalIndication(): ReactElement {
		if (!isQuote(quotes)) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}

		if (hasAllowance || approvalStep[token] === TStatus.VALID) {
			return <IconCheck className={'h-4 w-4 text-[#16a34a]'} />;
		}
		if (shouldApprove) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}
		if (approvalStep[token] === TStatus.PENDING) {
			return <IconSpinner />;
		}
		return <IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />;
	}

	function renderSignatureIndication(): ReactElement {
		if (!isQuote(quotes)) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}

		if (shouldSign || shouldApprove) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}
		if (!hasSignature && signStep[token] === TStatus.VALID) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}
		if (hasSignature) {
			return <IconCheck className={'h-4 w-4 text-[#16a34a]'} />;
		}
		if (signStep[token] === TStatus.PENDING) {
			return <IconSpinner />;
		}
		return <IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />;
	}

	function renderExecuteIndication(): ReactElement {
		if (!isQuote(quotes)) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}

		const currentQuote = quotes.quote[token];
		if (!currentQuote.orderStatus) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}
		if (currentQuote.orderStatus === TPossibleStatus.COWSWAP_FULFILLED) {
			return <IconCheck className={'h-4 w-4 text-[#16a34a]'} />;
		}
		if (currentQuote.orderStatus === TPossibleStatus.BEBOP_CONFIRMED) {
			return <IconCheck className={'h-4 w-4 text-[#16a34a]'} />;
		}
		if (executeStep[token] === TStatus.VALID) {
			return <IconCheck className={'h-4 w-4 text-[#16a34a]'} />;
		}
		if (currentQuote.orderStatus === TPossibleStatus.PENDING) {
			return <IconSpinner />;
		}
		if (executeStep[token] === TStatus.PENDING) {
			return <IconSpinner />;
		}
		return <IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />;
	}

	if (isWalletSafe) {
		return (
			<div className={'flex flex-row items-center space-x-2 pt-2 md:space-x-4'}>
				<div className={'flex flex-row items-center justify-center space-x-2'}>
					{renderSignatureIndication()}
					<small>{'Signed'}</small>
				</div>
				<div
					className={'text-neutral-600'}
					style={{paddingBottom: 1}}>
					&rarr;
				</div>
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
			<div
				className={'text-neutral-600'}
				style={{paddingBottom: 1}}>
				&rarr;
			</div>
			<div className={'flex flex-row items-center space-x-2'}>
				{renderSignatureIndication()}
				<small>
					{'Signed for '}
					<span className={'font-bold tabular-nums'}>
						{formatAmount(getBuyAmount(quotes, token).normalized, 6, 6)}
					</span>
					{` ${destination.symbol}`}
				</small>
			</div>
			<div
				className={'text-neutral-600'}
				style={{paddingBottom: 1}}>
				&rarr;
			</div>
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

type TCowswapApprovalWizard = {
	token: TAddress;
	index: number;
	hasSignature: boolean;
	approvalStep: {[key: TAddress]: TStatus};
	signStep: {[key: TAddress]: TStatus};
	executeStep: {[key: TAddress]: TStatus};
};

function CowswapApprovalWizard(props: TCowswapApprovalWizard): ReactElement {
	const {quotes, destination} = useSweepooor();
	const {balances} = useWallet();
	const currentQuote = quotes?.quote?.[props.token];

	if (!currentQuote) {
		return <></>;
	}

	return (
		<details
			key={props.index}
			className={
				'group mb-0 flex w-full flex-col justify-center rounded-none border border-x-0 border-neutral-200 bg-neutral-0 transition-colors hover:bg-neutral-100 md:mb-2 md:rounded-md md:border-x'
			}>
			<summary className={'flex flex-col items-start py-2'}>
				<div className={'flex w-full flex-col items-start justify-between md:flex-row md:items-center'}>
					<div className={'text-left text-sm'}>
						{'Swapping '}

						<span className={'font-number font-bold'}>
							{formatAmount(getSellAmount(quotes, props.token).normalized, 6, 6)}
						</span>

						{` ${balances?.[props.token]?.symbol || 'Tokens'} for at least `}

						<span className={'font-number font-bold'}>
							{formatAmount(getBuyAmount(quotes, props.token).normalized, 6, 6)}
						</span>

						{` ${destination.symbol}`}
					</div>
					{quotes && (
						<Expiration
							quotes={quotes}
							token={props.token}
						/>
					)}
				</div>
				<Indicators {...props} />
			</summary>

			<CowswapDetails
				quotes={quotes}
				token={props.token}
			/>
		</details>
	);
}

export {CowswapApprovalWizard};

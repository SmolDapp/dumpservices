import React, {useMemo, useRef, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedBebopQuote, hasQuote, isQuote} from 'hooks/assertSolver';
import {getSellAmount} from 'hooks/handleQuote';
import {getSpender} from 'hooks/useSolver';
import {TStatus} from 'utils/types';
import {erc20ABI, useContractRead} from 'wagmi';
import {IconCheck} from '@icons/IconCheck';
import {IconChevronBoth} from '@icons/IconChevronBoth';
import {IconCircleCross} from '@icons/IconCircleCross';
import {IconSpinner} from '@icons/IconSpinner';
import {useIntervalEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDuration} from '@yearn-finance/web-lib/utils/format.time';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';

import {BebopDetails} from './ApprovalWizard.DropdownDetails';

import type {ReactElement} from 'react';
import type {TBebopRequest, TRequest} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';

type TBebopApprovalWizard = {
	onRefreshQuote: () => Promise<void>;
	approvalStep: {[key: TAddress]: TStatus};
};

function Expiration(props: TBebopApprovalWizard & {currentQuote: TRequest & TBebopRequest}): ReactElement {
	const [expireIn, set_expireIn] = useState(0);
	const isRefreshingQuoteForExp = useRef(0);
	const quoteExpiration = props.currentQuote.quote.expirationTimestamp * 1000;

	useMemo((): void => {
		isRefreshingQuoteForExp.current = props.currentQuote.quote.expirationTimestamp;
	}, [props.currentQuote.quote.expirationTimestamp]);

	useIntervalEffect((): void => {
		set_expireIn(quoteExpiration - new Date().valueOf());
		if (
			quoteExpiration < new Date().valueOf() &&
			isRefreshingQuoteForExp.current === props.currentQuote.quote.expirationTimestamp
		) {
			isRefreshingQuoteForExp.current = 0;
			props.onRefreshQuote();
		}
	}, 1000);

	function renderExpiration(): ReactElement {
		if (props.currentQuote.quote.txHash !== '0x') {
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

function EachTokenApprovalIndicator(
	props: {
		tokenAddress: TAddress;
		tokenSymbol: string;
		tokenDecimals: number;
	} & TBebopApprovalWizard
): ReactElement {
	const {address} = useWeb3();
	const {quotes} = useSweepooor();
	const {safeChainID} = useChainID();
	const shouldApprove = useMemo((): boolean => {
		return (
			(!props.tokenAddress ||
				!props.approvalStep[props.tokenAddress] ||
				props.approvalStep[props.tokenAddress] === TStatus.UNDETERMINED) &&
			toAddress(props.tokenAddress) !== ETH_TOKEN_ADDRESS
		);
	}, [props.approvalStep, props.tokenAddress]);

	const {data: hasAllowance} = useContractRead({
		address: props.tokenAddress,
		abi: erc20ABI,
		functionName: 'allowance',
		args: [toAddress(address), getSpender({chainID: safeChainID})],
		select: (data): boolean => toBigInt(data) >= toBigInt(quotes?.sellTokens?.[props.tokenAddress]?.amount?.raw)
	});

	function renderApprovalIndication(): ReactElement {
		if (!isQuote(quotes)) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}

		if (
			hasAllowance ||
			props.approvalStep[props.tokenAddress] === TStatus.VALID ||
			toAddress(props.tokenAddress) === ETH_TOKEN_ADDRESS
		) {
			return <IconCheck className={'h-4 w-4 text-[#16a34a]'} />;
		}
		if (shouldApprove) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}
		if (props.approvalStep[props.tokenAddress] === TStatus.PENDING) {
			return <IconSpinner />;
		}
		return <IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />;
	}

	return (
		<div className={'flex flex-row items-center space-x-2'}>
			{renderApprovalIndication()}
			<small>
				{'Approved for '}
				<span className={'font-bold tabular-nums'}>
					{formatAmount(getSellAmount(quotes, props.tokenAddress).normalized, 6, 6)}
				</span>
				{` ${props.tokenSymbol}`}
			</small>
		</div>
	);
}

function Indicators(props: TBebopApprovalWizard & {currentQuote: TRequest & TBebopRequest}): ReactElement {
	function renderExplorerLink(): ReactElement {
		if (props.currentQuote.quote?.txHash && props.currentQuote.quote.txHash !== '0x') {
			return (
				<a
					href={`${getNetwork(props.currentQuote.quote?.chainId || 137).blockExplorers?.default.url}/tx/${
						props.currentQuote.quote.txHash
					}`}
					target={'_blank'}
					className={'text-neutral-500 hover:underline'}
					rel={'noreferrer'}>
					{'(see order)'}
				</a>
			);
		}
		return <span />;
	}

	function renderSignatureIndication(): ReactElement {
		if (props.currentQuote.quote.isSigning) {
			return <IconSpinner />;
		}
		if (props.currentQuote.quote.hasSignatureError) {
			return <IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />;
		}
		if (!props.currentQuote.quote.isSigned) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}
		if (props.currentQuote.quote.isSigned) {
			return <IconCheck className={'h-4 w-4 text-[#16a34a]'} />;
		}
		return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
	}

	function renderExecuteIndication(): ReactElement {
		if (props.currentQuote.quote.isExecuting) {
			return <IconSpinner />;
		}
		if (props.currentQuote.quote.hasExecutionError) {
			return <IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />;
		}
		if (!props.currentQuote.quote.isExecuted) {
			return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
		}
		if (props.currentQuote.quote.isExecuted) {
			return <IconCheck className={'h-4 w-4 text-[#16a34a]'} />;
		}
		return <div className={'h-4 w-4 rounded-full bg-neutral-300'} />;
	}

	return (
		<div className={'flex flex-row items-start space-x-2 pt-2 md:space-x-4'}>
			<div className={'flex flex-col gap-1'}>
				{Object.entries(props.currentQuote?.sellTokens || {}).map(([key, value]) => {
					return (
						<EachTokenApprovalIndicator
							key={key}
							tokenAddress={toAddress(key)}
							tokenDecimals={value.decimals}
							tokenSymbol={value.symbol}
							{...props}
						/>
					);
				})}
			</div>
			<div
				className={'text-neutral-600'}
				style={{marginTop: -4}}>
				&rarr;
			</div>
			<div className={'flex flex-row items-center space-x-2'}>
				{renderSignatureIndication()}
				<small>{'Signed'}</small>
			</div>
			<div
				className={'text-neutral-600'}
				style={{marginTop: -4}}>
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

function BebopApprovalWizard(props: TBebopApprovalWizard): ReactElement {
	const {quotes} = useSweepooor();
	if (!hasQuote(quotes, '')) {
		return <></>;
	}

	const currentQuote = getTypedBebopQuote(quotes);
	const tokensToSell = Object.values(currentQuote.sellTokens || []);

	return (
		<details
			className={
				'group mb-0 flex w-full flex-col justify-center rounded-none border border-x-0 border-neutral-200 bg-neutral-0 transition-colors hover:bg-neutral-100 md:mb-2 md:rounded-md md:border-x'
			}>
			<summary className={'flex flex-col items-start py-2'}>
				<div className={'flex w-full flex-col items-start justify-between md:flex-row md:items-center'}>
					<div className={'text-left text-sm'}>
						{'Dumping '}
						{tokensToSell.length > 1 ? (
							<span>
								<span className={'font-bold'}>{`${tokensToSell.length} tokens`}</span>
							</span>
						) : (
							tokensToSell.map((token, index) => {
								return (
									<span key={index}>
										<span className={'font-number font-bold'}>
											{formatAmount(token.amount.normalized, 6, 6)}
										</span>
										<span>{` ${token.symbol}`}</span>
									</span>
								);
							})
						)}
						{' for at least '}

						<span className={'font-number font-bold'}>
							{formatAmount(currentQuote.quote.buyToken.amount.normalized, 6, 6)}
						</span>

						{` ${currentQuote.quote.buyToken.symbol}`}
					</div>
					{currentQuote && (
						<Expiration
							currentQuote={currentQuote}
							{...props}
						/>
					)}
				</div>

				<Indicators
					currentQuote={currentQuote}
					{...props}
				/>
			</summary>

			<BebopDetails currentQuote={currentQuote} />
		</details>
	);
}

export {BebopApprovalWizard};

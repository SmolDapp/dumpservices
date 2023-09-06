import React, {useState} from 'react';
import {IconCheck} from 'components/icons/IconCheck';
import {IconChevronBoth} from 'components/icons/IconChevronBoth';
import {IconCircleCross} from 'components/icons/IconCircleCross';
import {IconSpinner} from 'components/icons/IconSpinner';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {getTypedCowswapQuote, isBebopOrder, isCowswapOrder, isQuote} from 'hooks/assertSolver';
import {refreshQuote} from 'hooks/handleQuote';
import {getBuyAmount, getValidTo, shouldRefreshQuote} from 'hooks/helperWithSolver';
import {getSpender} from 'hooks/useSolverCowswap';
import {TPossibleFlowStep,TPossibleStatus} from 'utils/types';
import {erc20ABI, useContractRead} from 'wagmi';
import {useIntervalEffect, useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate, formatDuration} from '@yearn-finance/web-lib/utils/format.time';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';

import type {TApprovalWizardItem} from 'components/ApprovalWizardItem';
import type {ReactElement} from 'react';
import type {TBebopQuoteAPIResp, TRequest} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';

function SumaryExpiration({quotes, token}: {
	quotes: TRequest,
	token: TAddress,
}): ReactElement {
	const {isWalletSafe} = useWeb3();
	const [expireIn, set_expireIn] = useState(0);
	const currentQuote = quotes.quote[token];
	const hasQuote = Boolean(currentQuote);
	const quoteExpiration = getValidTo(quotes, token, isWalletSafe) * 1000;

	useIntervalEffect((): void => {
		set_expireIn(quoteExpiration - new Date().valueOf());
		if (shouldRefreshQuote(quotes, token, isWalletSafe)) {
			refreshQuote(token);
		}
	}, (!hasQuote ? undefined : 1000));

	useUpdateEffect((): void => {
		set_expireIn(quoteExpiration - new Date().valueOf());
		if (shouldRefreshQuote(quotes, token, isWalletSafe)) {
			refreshQuote(token);
		}
	}, [quoteExpiration]);

	function renderExpiration(): ReactElement {
		if (currentQuote.orderUID) {
			return (
				<small className={'text-xs tabular-nums text-neutral-500'}>
					&nbsp;
				</small>
			);
		}

		if (Math.floor(expireIn) <= 0) {
			return (
				<div className={'tooltip'}>
					<small className={'text-xs tabular-nums text-[#f97316]'}>
						{'Updating quote...'}
					</small>
				</div>
			);
		}
		if (Math.floor(expireIn) < 60) {
			return (
				<div className={'tooltip'}>
					<small className={'text-xs tabular-nums text-neutral-500'}>
						{`The quote will be updated in ${Math.floor(expireIn)}s`}
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

function SummaryIndicator({token, isWalletSafe, hasSignature, approvalStep, signStep, executeStep}: TApprovalWizardItem): ReactElement {
	const {address} = useWeb3();
	const {quotes, destination} = useSweepooor();
	const [step, set_step] = useState<'Approve' | 'Sign' | 'Execute'>(isWalletSafe ? 'Sign' : 'Approve');
	const {safeChainID} = useChainID();

	const {data: allowance} = useContractRead({
		address: token,
		abi: erc20ABI,
		functionName: 'allowance',
		args: [toAddress(address), getSpender({chainID: safeChainID})]
	});
	const hasAllowance = toBigInt(allowance) >= toBigInt(quotes?.sellTokens?.[token]?.amount?.raw);

	useUpdateEffect((): void => {
		if (hasAllowance) {
			set_step('Sign');
		}
	}, [hasAllowance, step]);

	function renderExplorerLink(): ReactElement {
		if (isCowswapOrder(quotes)) {
			const currentQuote = quotes.quote[token];
			if (currentQuote.orderUID) {
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
		}

		if (isBebopOrder(quotes)) {
			const currentQuote = quotes.quote[token];
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
		if (!isQuote(quotes)) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}

		if (hasAllowance || approvalStep[token] === TPossibleFlowStep.VALID) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (!token) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (!approvalStep[token]) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (approvalStep[token] === TPossibleFlowStep.UNDETERMINED) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (approvalStep[token] === TPossibleFlowStep.PENDING) {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	function renderSignatureIndication(): ReactElement {
		if (!isQuote(quotes)) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}

		if (!token) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (step !== 'Sign' ) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (!signStep[token]) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (signStep[token] === TPossibleFlowStep.UNDETERMINED) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (hasSignature) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (signStep[token] === TPossibleFlowStep.PENDING) {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	function renderExecuteIndication(): ReactElement {
		if (!isQuote(quotes)) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}

		const currentQuote = quotes.quote[token];
		if (!currentQuote.orderStatus) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (currentQuote.orderStatus === TPossibleStatus.COWSWAP_FULFILLED) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (currentQuote.orderStatus === TPossibleStatus.BEBOP_CONFIRMED) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (executeStep[token] === TPossibleFlowStep.VALID) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (currentQuote.orderStatus === TPossibleStatus.PENDING) {
			return <IconSpinner />;
		}
		if (executeStep[token] === TPossibleFlowStep.PENDING) {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	if (isWalletSafe) {
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
						{formatAmount(getBuyAmount(quotes, token).normalized, 6, 6)}
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

function CowswapTXDetails({quotes, token}: {
	quotes: TRequest,
	token: TAddress
}): ReactElement {
	const {balances} = useWallet();
	const currentQuote = getTypedCowswapQuote(quotes).quote[token];
	const currentSellToken = getTypedCowswapQuote(quotes).sellTokens[token];

	if (!currentQuote.quote) {
		return (<div />);
	}

	return (
		<div className={'font-number space-y-2 border-t-0 p-4 text-xs md:text-sm'}>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Kind'}</b>
				<p className={'font-number'}>{currentQuote.quote.kind || ''}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'From'}</b>
				<p className={'font-number'}>{toAddress(currentQuote.from || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Receiver'}</b>
				<p className={'font-number'}>{toAddress(currentQuote.quote.receiver || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'BuyAmount'}</b>
				<p className={'font-number'}>
					{`${getBuyAmount(quotes, token).normalized} (${getBuyAmount(quotes, token).raw || ''})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'BuyToken'}</b>
				<p className={'font-number'}>
					{`${balances?.[toAddress(currentQuote.quote.buyToken)]?.symbol || ''} (${toAddress(currentQuote.quote.buyToken || '')})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'SellAmount'}</b>
				<p className={'font-number'}>
					{`${currentSellToken.amount.normalized} (${currentSellToken.amount.raw || ''})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'FeeAmount'}</b>
				<p className={'font-number'}>
					{`${toNormalizedBN(
						currentQuote.quote.feeAmount || '',
						currentSellToken.decimals
					).normalized} (${currentQuote.quote.feeAmount || ''})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'SellToken'}</b>
				<p className={'font-number'}>
					{`${balances?.[token]?.symbol || ''} (${toAddress(currentQuote.quote.sellToken || '')})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'ValidTo'}</b>
				<p className={'font-number'}>
					{formatDate(getValidTo(quotes, token))}
				</p>
			</span>
		</div>
	);
}

function ApprovalWizardItemBebop({quote}: {
	isWalletSafe: boolean,
	quote: TBebopQuoteAPIResp
}): ReactElement {
	const {quotes, destination} = useSweepooor();
	const {balances} = useWallet();

	function findTokenSymbol(address: TAddress): string {
		return balances?.[toAddress(address)]?.symbol || 'Tokens';
	}

	function findTokenDecimals(address: TAddress): number {
		return balances?.[toAddress(address)]?.decimals || 18;
	}

	console.warn(quote);
	if (!quote) {
		return <div />;
	}

	return (
		<>
			{Object.values(quote?.sellTokens || {}).map((item): ReactElement => (
				<details
					key={item.contractAddress}
					className={'group mb-0 flex w-full flex-col justify-center rounded-none border border-x-0 border-neutral-200 bg-neutral-0 transition-colors hover:bg-neutral-100 md:mb-2 md:rounded-md md:border-x'}>
					<summary
						className={'flex flex-col items-start py-2'}>
						<div className={'flex w-full flex-col items-start justify-between md:flex-row md:items-center'}>
							<div className={'text-left text-sm'}>
								{'Swapping '}

								<span className={'font-number font-bold'}>
									{formatAmount(toNormalizedBN(item.amount, findTokenDecimals(item.contractAddress)).normalized, 6, 6)}
								</span>

								{` ${findTokenSymbol(item.contractAddress)} for ~`}

								<span className={'font-number font-bold'}>
									{formatAmount(
										Number(toNormalizedBN(item.amount, findTokenDecimals(item.contractAddress)).normalized)
									*
									item.rate
										, 6, 6)}
								</span>

								{` ${destination.symbol}`}
							</div>
						</div>
					</summary>
				</details>
			))}
		</>
	);
}

export default ApprovalWizardItemBebop;

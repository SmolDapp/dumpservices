import React, {useCallback, useEffect, useState} from 'react';
import IconCheck from 'components/icons/IconCheck';
import IconChevronBoth from 'components/icons/IconChevronBoth';
import IconCircleCross from 'components/icons/IconCircleCross';
import IconSpinner from 'components/icons/IconSpinner';
import IconWarning from 'components/icons/IconWarning';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {useSolverCowswap} from 'hooks/useSolverCowswap';
import {isApprovedERC20} from 'utils/actions/approveERC20';
import {useAsync, useIntervalEffect, useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {SOLVER_COW_VAULT_RELAYER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate, formatDuration} from '@yearn-finance/web-lib/utils/format.time';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {ethers} from 'ethers';
import type {ReactElement} from 'react';
import type {TOrderQuoteResponse, TPossibleFlowStep} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

type TApprovalWizardItem = {
	token: TAddress,
	index: number,
	isGnosisSafe: boolean,
	hasSignature: boolean,
	currentWizardApprovalStep: TDict<TPossibleFlowStep>,
	currentWizardSignStep: TDict<TPossibleFlowStep>,
}
function	ApprovalWizardItem({
	token,
	index,
	isGnosisSafe,
	hasSignature,
	currentWizardApprovalStep,
	currentWizardSignStep
}: TApprovalWizardItem): ReactElement {
	const	{provider} = useWeb3();
	const	{amounts, quotes, set_quotes, destination, receiver} = useSweepooor();
	const	{balances} = useWallet();
	const	cowswap = useSolverCowswap();
	const	[isQuoteExpired, set_isQuoteExpired] = useState<boolean>((Number(quotes[toAddress(token)]?.quote?.validTo || 0) * 1000) < new Date().valueOf());
	const	[expireIn, set_expireIn] = useState((Number(quotes[toAddress(token)]?.quote?.validTo || 0) * 1000) - new Date().valueOf());
	const	[step, set_step] = useState<'Approve' | 'Sign' | 'Execute'>(isGnosisSafe ? 'Sign' : 'Approve');
	const	[isRefreshingQuote, set_isRefreshingQuote] = useState(false);
	const	hasQuote = Boolean(quotes[toAddress(token)]);
	const	currentQuote = quotes[toAddress(token)];

	const	[{result: hasAllowance}, triggerAllowanceCheck] = useAsync(async (): Promise<boolean> => {
		return await isApprovedERC20(
			provider as ethers.providers.Web3Provider,
			toAddress(token), //from
			toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //migrator
			amounts[toAddress(token)]?.raw
		);
	}, false);

	useUpdateEffect((): void => {
		set_expireIn((Number(currentQuote?.quote?.validTo || 0) * 1000) - new Date().valueOf());
	}, [currentQuote?.quote?.validTo]);

	useEffect((): void => {
		triggerAllowanceCheck.execute();
	}, [triggerAllowanceCheck, token, currentWizardApprovalStep]);

	useIntervalEffect((): void => {
		const	now = new Date().valueOf();
		const	expiration = Number(currentQuote?.quote?.validTo || 0) * 1000;
		set_expireIn(expiration - now);
		set_isQuoteExpired((Number(currentQuote?.quote?.validTo || 0) * 1000) < new Date().valueOf());
	}, !hasQuote || isQuoteExpired ? undefined : 1000);

	useUpdateEffect((): void => {
		set_isQuoteExpired((Number(currentQuote?.quote?.validTo || 0) * 1000) < new Date().valueOf());
	}, [hasQuote]);

	useUpdateEffect((): void => {
		if (hasAllowance && isQuoteExpired) {
			set_step('Sign');
		} else if (hasAllowance && step === 'Approve') {
			set_step('Sign');
		}
	}, [hasAllowance, isQuoteExpired, step]);

	const	estimateQuote = useCallback(async (): Promise<void> => {
		set_isRefreshingQuote(true);
		const [, order] = await cowswap.init({
			from: toAddress(currentQuote?.from),
			receiver: toAddress(currentQuote?.quote?.receiver),
			inputToken: currentQuote?.request?.inputToken,
			outputToken: currentQuote?.request?.outputToken,
			inputAmount: currentQuote?.request?.inputAmount
		});
		performBatchedUpdates((): void => {
			if (order) {
				set_quotes((quotes: TDict<TOrderQuoteResponse>): TDict<TOrderQuoteResponse> => ({...quotes, [toAddress(token)]: order}));
				set_expireIn((Number(order.quote?.validTo || 0) * 1000) - new Date().valueOf());
				set_isQuoteExpired(false);
			}
			set_isRefreshingQuote(false);
		});
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cowswap.init, currentQuote?.from, currentQuote?.request?.inputAmount, currentQuote?.request?.inputToken, currentQuote?.request?.outputToken, set_quotes, token, receiver]);

	function	renderApprovalIndication(): ReactElement {
		if (hasAllowance) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (!currentQuote?.id || !currentWizardApprovalStep[currentQuote?.id] || currentWizardApprovalStep[currentQuote?.id] === 'undetermined') {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (currentWizardApprovalStep[currentQuote?.id] === 'pending') {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	function	renderSignatureIndication(): ReactElement {
		if (!currentQuote?.id) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (step !== 'Sign' || !currentWizardSignStep[currentQuote?.id] ||currentWizardSignStep[currentQuote?.id] === 'undetermined') {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (isQuoteExpired) {
			return (<IconWarning className={'h-4 w-4 text-[#f97316]'} />);
		}
		if (hasSignature) {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (currentWizardSignStep[currentQuote?.id] === 'pending') {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	function	renderExecuteIndication(): ReactElement {
		if (!currentQuote?.orderStatus) {
			return (<div className={'h-4 w-4 rounded-full bg-neutral-300'} />);
		}
		if (currentQuote.orderStatus === 'fulfilled') {
			return (<IconCheck className={'h-4 w-4 text-[#16a34a]'} />);
		}
		if (currentQuote.orderStatus === 'pending') {
			return <IconSpinner />;
		}
		return (<IconCircleCross className={'h-4 w-4 text-[#e11d48]'} />);
	}

	function	renderIndicators(): ReactElement {
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
						{(expireIn < 0 && isRefreshingQuote) || currentQuote?.isRefreshing ? (
							<button onClick={estimateQuote}>
								<small className={'text-xs tabular-nums text-[#f97316]'}>
									{'Updating quote...'}
								</small>
							</button>
						) : expireIn < 0 ? (
							<button onClick={estimateQuote}>
								<small className={'text-xs tabular-nums text-[#f97316]'}>
									{'Quote expired. Click to update'}
								</small>
							</button>
						) : (
							<button disabled>
								<small className={'text-xs tabular-nums text-neutral-500'}>
									{expireIn < 0 ? 'Expired' : `Expires in ${Math.floor(expireIn / 1000) < 60 ? `${Math.floor(expireIn / 1000)}s` : formatDuration(expireIn)}`}
								</small>
							</button>
						)}
						<IconChevronBoth className={'h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900'} />
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
						{formatDate(Number(currentQuote?.quote?.validTo || 0) * 1000)}
						{isQuoteExpired ? (
							<span className={'font-number pl-2 text-[#f97316]'}>
								{'Expired'}
							</span>
						) : null}
					</p>
				</span>

			</div>
		</details>
	);
}

export default ApprovalWizardItem;

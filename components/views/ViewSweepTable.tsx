import React, {Fragment, useCallback, useMemo, useRef, useState} from 'react';
import AddTokenPopover from 'components/AddTokenPopover';
import TokenInput from 'components/common/TokenInput';
import SettingsPopover from 'components/SettingsPopover';
import {useSweepooor} from 'contexts/useSweepooor';
import {useTokenList} from 'contexts/useTokenList';
import {useWallet} from 'contexts/useWallet';
import {hasQuote} from 'hooks/assertSolver';
import {addQuote, deleteQuote, initQuote, refreshQuote, resetQuote} from 'hooks/handleQuote';
import {getBuyAmount} from 'hooks/helperWithSolver';
import {useSolverCowswap} from 'hooks/useSolverCowswap';
import {DENYLIST_COWSWAP} from 'utils/denyList.cowswap';
import {type Maybe, type TRequest, type TRequestArgs} from 'utils/types';
import {IconChevronPlain} from '@icons/IconChevronPlain';
import {IconRefresh} from '@icons/IconRefresh';
import {IconSpinner} from '@icons/IconSpinner';
import {useDebouncedEffect, useMountEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function TableLine({
	tokenAddress,
	balance,
	index
}: {
	tokenAddress: TAddress;
	balance: TBalanceData;
	index: number;
}): ReactElement {
	const cowswap = useSolverCowswap();
	const {address} = useWeb3();
	const {quotes, set_quotes, destination, receiver} = useSweepooor();
	const {safeChainID} = useChainID();
	const {tokenList} = useTokenList();
	const inputRef = useRef<HTMLInputElement>(null);
	const [amount, set_amount] = useState<TNormalizedBN>(toNormalizedBN(0n, balance.decimals));
	const isSelected = Boolean(hasQuote(quotes, tokenAddress) || false);
	const quoteFetchNonce = useRef<number>(0);

	const onDisable = useCallback((force = false): void => {
		if (!inputRef.current) {
			return;
		}
		if (force) {
			inputRef.current.ariaBusy = 'false';
			inputRef.current.ariaInvalid = 'true';
		} else {
			inputRef.current.ariaBusy = 'false';
			inputRef.current.indeterminate = true;
		}
	}, []);

	const onHandleQuote = useCallback(
		async (rawAmount: bigint, nonce: number): Promise<void> => {
			if (rawAmount === 0n) {
				// set_amount(toNormalizedBN(balance.raw, balance.decimals));
				// return onHandleQuote(balance.raw, ++quoteFetchNonce.current);
				return;
			}
			if (inputRef.current) {
				inputRef.current.ariaBusy = 'true';
				inputRef.current.ariaInvalid = 'false';
				inputRef.current.indeterminate = false;
			}
			const request: TRequestArgs = {
				from: toAddress(address),
				receiver: toAddress(receiver),
				inputTokens: [
					{
						address: tokenAddress,
						name: balance.name,
						symbol: balance.symbol,
						decimals: balance.decimals,
						chainId: safeChainID
					}
				],
				outputToken: {
					address: destination.address,
					name: destination.name,
					symbol: destination.symbol,
					decimals: destination.decimals,
					chainId: safeChainID
				},
				inputAmounts: [toBigInt(rawAmount)],
				inputBalances: [toBigInt(balance.raw)]
			};

			set_quotes((q): Maybe<TRequest> => {
				return initQuote(q, tokenAddress, request, safeChainID === 1 ? 'COWSWAP' : 'BEBOP');
			});

			const {quoteResponse, isSuccess, error} = await cowswap.getQuote(request);
			if (nonce !== quoteFetchNonce.current) {
				return;
			}
			if (isSuccess && quoteResponse) {
				set_quotes((q): Maybe<TRequest> => addQuote(q, quoteResponse));
				if (inputRef.current) {
					inputRef.current.ariaBusy = 'false';
					inputRef.current.ariaInvalid = 'false';
					inputRef.current.indeterminate = false;
				}
			} else {
				set_quotes((q): Maybe<TRequest> => deleteQuote(q, tokenAddress));
				if (error) {
					toast({type: 'error', content: error.message});
					onDisable(error.shouldDisable);
				}
			}
		},
		[
			address,
			receiver,
			tokenAddress,
			balance.name,
			balance.symbol,
			balance.decimals,
			balance.raw,
			safeChainID,
			destination.address,
			destination.name,
			destination.symbol,
			destination.decimals,
			cowswap,
			set_quotes,
			onDisable
		]
	);

	useMountEffect((): void => {
		if (!hasQuote(quotes, tokenAddress)) {
			set_amount(toNormalizedBN(balance.raw, balance.decimals));
		}
	});

	useDebouncedEffect(
		(): void => {
			if (isSelected) {
				onHandleQuote(amount?.raw, ++quoteFetchNonce.current);
			}
		},
		[amount, isSelected, onHandleQuote],
		500
	);

	return (
		<Fragment>
			<div className={'col-span-8 ml-1 flex w-full flex-row items-center gap-3'}>
				<input
					ref={inputRef}
					type={'checkbox'}
					className={'checkbox cursor-pointer'}
					tabIndex={-1}
					checked={isSelected}
					onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
						if (!event.target.checked || inputRef?.current?.ariaInvalid === 'true') {
							if (inputRef.current) {
								inputRef.current.ariaBusy = 'false';
								inputRef.current.ariaInvalid = 'false';
								inputRef.current.indeterminate = false;
							}
							set_quotes((q): Maybe<TRequest> => deleteQuote(q, toAddress(tokenAddress)));
							resetQuote(toAddress(tokenAddress));
						} else {
							refreshQuote(toAddress(tokenAddress));
						}
					}}
				/>
				<TokenInput
					index={index}
					allowance={-1}
					token={tokenList[toAddress(tokenAddress)]}
					shouldCheckAllowance={isSelected}
					value={amount}
					onChange={(v): void => {
						if (v.raw > 0n && !isSelected) {
							refreshQuote(toAddress(tokenAddress));
						} else if (v.raw === 0n) {
							if (inputRef.current) {
								inputRef.current.ariaBusy = 'false';
								inputRef.current.ariaInvalid = 'false';
								inputRef.current.indeterminate = false;
								set_quotes((q): Maybe<TRequest> => deleteQuote(q, toAddress(tokenAddress)));
								resetQuote(toAddress(tokenAddress));
							}
						}
						set_amount(v);
					}}
				/>
			</div>
			<div className={'col-span-4 flex flex-row items-center space-x-4'}>
				<div>
					<IconChevronPlain className={'h-4 w-4 -rotate-90 text-neutral-900/30'} />
				</div>
				<div
					className={cl(
						'grow-1 col-span-7 flex h-10 w-full items-center justify-between rounded-md p-2 border font-mono text-sm border-neutral-200',
						'bg-neutral-0'
					)}>
					{hasQuote(quotes, tokenAddress) && !quotes?.quote[tokenAddress].isFetching ? (
						<div>{`${formatAmount(getBuyAmount(quotes, tokenAddress).normalized, 4, 4)} ${quotes?.buyToken
							.symbol}`}</div>
					) : (
						<div className={'text-neutral-300'}>{`${formatAmount(0, 4, 4)}`}</div>
					)}
					<div>
						<button
							id={`quote-refresh-${tokenAddress}`}
							tabIndex={-1}
							className={'cursor-pointer text-neutral-200 transition-colors hover:text-neutral-900'}
							onClick={(): void => {
								onHandleQuote(amount?.raw, ++quoteFetchNonce.current);
							}}>
							<IconRefresh
								className={cl(
									'h-3 w-3',
									quotes?.quote?.[tokenAddress]?.isFetching
										? 'text-neutral-900 animate-spin'
										: 'text-neutral-200'
								)}
							/>
						</button>
						<button
							id={`quote-reset-${tokenAddress}`}
							// onClick={onResetClick}
							className={'pointer-events-none invisible absolute h-0 w-0'}></button>
					</div>
				</div>
			</div>
		</Fragment>
	);
}

function ViewSweepTable({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const {isActive, address, chainID} = useWeb3();
	const {quotes, destination, receiver} = useSweepooor();
	const {balances, balancesNonce, isLoading} = useWallet();
	const [search, set_search] = useState<string>('');

	const hasQuoteForEverySelectedToken = useMemo((): boolean => {
		if (!quotes) {
			return false;
		}
		const allQuotes = Object.values(quotes.quote);
		return allQuotes.length > 0;
	}, [quotes]);

	const balancesToDisplay = useMemo((): [string, TBalanceData][] => {
		balancesNonce;
		return Object.entries(balances || [])
			.filter(([tokenAddress]: [string, TBalanceData]): boolean => {
				return !DENYLIST_COWSWAP.includes(toAddress(tokenAddress));
			})
			.filter(([tokenAddress, tokenData]: [string, TBalanceData]): boolean => {
				if (search) {
					const searchArray = search.split(/[\s,]+/);
					return searchArray.some((searchTerm: string): boolean => {
						if (searchTerm === '') {
							return false;
						}
						return (
							tokenData.symbol.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
							tokenData.name.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
							tokenAddress.toLowerCase().startsWith(searchTerm.toLowerCase())
						);
					});
				}
				return true;
			})
			.filter(
				([, balance]: [string, TBalanceData]): boolean =>
					(balance?.raw && balance.raw !== 0n) || balance?.force || false
			)
			.filter(
				([tokenAddress]: [string, TBalanceData]): boolean =>
					toAddress(tokenAddress) !== destination.address && toAddress(tokenAddress) !== ETH_TOKEN_ADDRESS
			)
			.filter(([tokenAddress]: [string, TBalanceData]): boolean =>
				destination.address === ETH_TOKEN_ADDRESS ? toAddress(tokenAddress) !== WETH_TOKEN_ADDRESS : true
			);
	}, [balancesNonce, balances, search, destination.address]);

	return (
		<section>
			<div className={'box-0 relative grid w-full grid-cols-12'}>
				<div className={'absolute right-4 top-4'}>
					<SettingsPopover />
				</div>
				<div className={'col-span-12 flex flex-col p-4 text-neutral-900 md:p-6 md:pb-2'}>
					<div className={'w-full md:w-3/4'}>
						<b>{'Which tokens do you want to dump?'}</b>
						<p className={'text-sm text-neutral-500'}>
							{
								'Select the token(s) that you’d like to dump. In exchange you’ll receive whatever token you selected in the first step.'
							}
						</p>
					</div>
					<div className={'mt-4 w-full'}>
						<input
							onChange={(event): void => set_search(event.target.value)}
							value={search}
							className={
								'h-10 w-full rounded-md border border-neutral-200 px-4 py-2 text-sm focus:border-neutral-400 focus:outline-none'
							}
							type={'text'}
							placeholder={'Filter tokens...'}
						/>
					</div>
				</div>

				{balancesToDisplay.length === 0 && isLoading ? (
					<div className={'col-span-12 flex min-h-[200px] flex-col items-center justify-center'}>
						<IconSpinner />
						<p className={'mt-6 text-sm text-neutral-500'}>{'We are looking for your tokens ...'}</p>
					</div>
				) : balancesToDisplay.length === 0 ? (
					<div className={'col-span-12 flex min-h-[200px] flex-col items-center justify-center'}>
						<svg
							className={'h-4 w-4 text-neutral-400'}
							xmlns={'http://www.w3.org/2000/svg'}
							viewBox={'0 0 512 512'}>
							<path
								d={
									'M505 41c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L396.5 81.5C358.1 50.6 309.2 32 256 32C132.3 32 32 132.3 32 256c0 53.2 18.6 102.1 49.5 140.5L7 471c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l74.5-74.5c38.4 31 87.3 49.5 140.5 49.5c123.7 0 224-100.3 224-224c0-53.2-18.6-102.1-49.5-140.5L505 41zM362.3 115.7L115.7 362.3C93.3 332.8 80 295.9 80 256c0-97.2 78.8-176 176-176c39.9 0 76.8 13.3 106.3 35.7zM149.7 396.3L396.3 149.7C418.7 179.2 432 216.1 432 256c0 97.2-78.8 176-176 176c-39.9 0-76.8-13.3-106.3-35.7z'
								}
								fill={'currentcolor'}
							/>
						</svg>
						<p className={'mt-6 text-sm text-neutral-500'}>{'Oh no, you have nothing to dump!'}</p>
					</div>
				) : (
					<div className={'col-span-12 px-6 pb-6'}>
						{balancesToDisplay.map(
							([tokenAddress, balance]: [string, TBalanceData], index): ReactElement => {
								return (
									<div
										key={`${tokenAddress}-${chainID}-${balance.symbol}-${address}-${destination.address}-${receiver}`}
										className={'col-span-12 grid w-full grid-cols-12 gap-4 py-2'}>
										<TableLine
											index={10_000 - index}
											tokenAddress={toAddress(tokenAddress)}
											balance={balance}
										/>
									</div>
								);
							}
						)}
					</div>
				)}

				<div
					className={
						'relative col-span-12 flex w-full max-w-4xl flex-row items-center justify-between rounded-b bg-neutral-900 p-4 text-neutral-0 md:px-6 md:py-4'
					}>
					<div className={'flex flex-col'}>
						<AddTokenPopover />
					</div>
					<div className={'flex flex-col'}>
						<Button
							className={'yearn--button !w-fit !px-6 !text-sm'}
							variant={'reverted'}
							isDisabled={
								!isActive ||
								Object.values(quotes?.quote || {}).length === 0 ||
								!hasQuoteForEverySelectedToken
							}
							onClick={onProceed}>
							{'Confirm'}
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
export default ViewSweepTable;

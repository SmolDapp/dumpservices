import React, {Fragment, useCallback, useState} from 'react';
import TokenInput from 'components/common/TokenInput';
import {useSweepooor} from 'contexts/useSweepooor';
import {useTokenList} from 'contexts/useTokenList';
import {deleteQuote} from 'hooks/handleQuote';
import {IconChevronPlain} from '@icons/IconChevronPlain';
import {IconRefresh} from '@icons/IconRefresh';
import {useAsyncAbortable} from '@react-hookz/web';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import type {LegacyRef, MutableRefObject, ReactElement} from 'react';
import type {Maybe, TRequest, TToken} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function TokenRow({
	tokenAddress,
	perTokenInputRef,
	onHandleQuote,
	balance,
	index
}: {
	tokenAddress: TAddress;
	perTokenInputRef: MutableRefObject<TDict<HTMLInputElement>>;
	onHandleQuote: (token: TToken, rawAmount: bigint) => Promise<TNormalizedBN>;
	balance: TBalanceData;
	index: number;
}): ReactElement {
	const {quotes, set_quotes} = useSweepooor();
	const {tokenList, getToken} = useTokenList();
	const [amount, set_amount] = useState<TNormalizedBN | undefined>(undefined);
	const token = getToken(tokenAddress);

	const [{status, result: estimateOut}, actions] = useAsyncAbortable(
		async (signal, newAmount: TNormalizedBN | undefined, withDelay: boolean): Promise<TNormalizedBN | undefined> =>
			new Promise<TNormalizedBN | undefined>(async (resolve, reject): Promise<void> => {
				set_amount(newAmount);
				setTimeout(
					async (): Promise<void> => {
						if (signal.aborted) {
							console.log('aborted');
							reject(new Error('Aborted!'));
						} else {
							if (newAmount === undefined) {
								if (perTokenInputRef.current[tokenAddress]) {
									perTokenInputRef.current[tokenAddress].ariaBusy = 'false';
									perTokenInputRef.current[tokenAddress].ariaInvalid = 'false';
									perTokenInputRef.current[tokenAddress].indeterminate = false;
								}
								set_quotes((q): Maybe<TRequest> => deleteQuote(q, toAddress(tokenAddress)));
								resolve(undefined);
							} else if (perTokenInputRef.current?.[tokenAddress]?.ariaBusy !== 'true') {
								const estimate = await onHandleQuote(token as TToken, toBigInt(newAmount?.raw));
								console.warn({estimate});
								resolve(estimate);
							}
						}
					},
					withDelay ? 500 : 0
				);
			}),
		undefined
	);

	const onHandleAmount = useCallback(
		(newAmount: TNormalizedBN | undefined): void => {
			actions.abort();
			actions.execute(newAmount, true);
		},
		[actions]
	);

	console.warn({estimateOut});
	// const onDebouncedHandleAmount = useDebouncedCallback(onHandleAmount, [onHandleAmount], 500);

	// useEffect((): void => {
	// 	if (amount === undefined) {
	// 		if (perTokenInputRef.current[tokenAddress]) {
	// 			perTokenInputRef.current[tokenAddress].ariaBusy = 'false';
	// 			perTokenInputRef.current[tokenAddress].ariaInvalid = 'false';
	// 			perTokenInputRef.current[tokenAddress].indeterminate = false;
	// 		}
	// 		set_quotes((q): Maybe<TRequest> => deleteQuote(q, toAddress(tokenAddress)));
	// 	} else if (perTokenInputRef.current?.[tokenAddress]?.ariaBusy !== 'true') {
	// 		onHandleQuote(token as TToken, toBigInt(amount?.raw));
	// 	}
	// }, [amount, onHandleQuote, perTokenInputRef, set_quotes, token, tokenAddress]);

	if (!token) {
		return <Fragment />;
	}

	return (
		<Fragment>
			<div className={'col-span-8 ml-1 flex w-full flex-row items-center gap-3'}>
				<input
					ref={perTokenInputRef.current[tokenAddress] as unknown as LegacyRef<HTMLInputElement>}
					type={'checkbox'}
					className={'checkbox cursor-pointer'}
					tabIndex={-1}
					checked={toBigInt(amount?.raw) > 0n}
					onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
						if (!event.target.checked || perTokenInputRef.current[tokenAddress]?.ariaInvalid === 'true') {
							onHandleAmount(undefined);
						} else {
							onHandleAmount(toNormalizedBN(balance.raw, balance.decimals));
						}
					}}
				/>
				<TokenInput
					index={index}
					allowance={-1}
					token={tokenList[toAddress(tokenAddress)]}
					shouldCheckAllowance={false}
					placeholder={`${toNormalizedBN(balance.raw, balance.decimals).normalized}`}
					value={amount}
					onChange={(v): void => {
						if (v.raw === 0n) {
							onHandleAmount(undefined);
						} else {
							onHandleAmount(v);
						}
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
					<div className={estimateOut === undefined ? 'text-neutral-300' : ''}>
						{`${formatAmount(estimateOut?.normalized || 0, 4, 4)} ${quotes?.buyToken.symbol}`}
					</div>
					<div>
						<button
							id={`quote-refresh-${tokenAddress}`}
							tabIndex={-1}
							className={'cursor-pointer text-neutral-200 transition-colors hover:text-neutral-900'}
							onClick={async (): Promise<void> => onHandleAmount(amount)}>
							<IconRefresh
								className={cl(
									'h-3 w-3',
									status === 'loading'
										? // quotes?.quote?.[tokenAddress]?.isFetching
										  'text-neutral-900 animate-spin'
										: 'text-neutral-200'
								)}
							/>
						</button>
						<button
							id={`quote-reset-${tokenAddress}`}
							onClick={(): void => onHandleAmount(undefined)}
							className={'pointer-events-none invisible absolute h-0 w-0'}
						/>
					</div>
				</div>
			</div>
		</Fragment>
	);
}

export {TokenRow};

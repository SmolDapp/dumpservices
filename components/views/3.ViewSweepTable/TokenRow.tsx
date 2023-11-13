import React, {Fragment, useCallback, useState} from 'react';
import TokenInput from 'components/common/TokenInput';
import {useSweepooor} from 'contexts/useSweepooor';
import {deleteQuote} from 'hooks/handleQuote';
import {IconChevronPlain} from '@icons/IconChevronPlain';
import {IconRefresh} from '@icons/IconRefresh';
import {useAsyncAbortable} from '@react-hookz/web';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import type {LegacyRef, MutableRefObject, ReactElement} from 'react';
import type {TQuote, TToken} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function TokenRow(props: {
	fromToken: TToken;
	toToken: TToken;
	perTokenInputRef: MutableRefObject<TDict<HTMLInputElement>>;
	onHandleQuote: (token: TToken, rawAmount: bigint) => Promise<TNormalizedBN>;
	balance: TBalanceData;
	index: number;
}): ReactElement {
	const {set_quotes} = useSweepooor();
	const [amount, set_amount] = useState<TNormalizedBN | undefined>(undefined);

	const [{status, result: estimateOut}, actions] = useAsyncAbortable(
		async (signal, newAmount: TNormalizedBN | undefined, withDelay: boolean): Promise<TNormalizedBN | undefined> =>
			new Promise<TNormalizedBN | undefined>(async (resolve, reject): Promise<void> => {
				set_amount(newAmount);
				setTimeout(
					async (): Promise<void> => {
						if (signal.aborted) {
							reject(new Error('Aborted!'));
						} else {
							const tokenAddress = toAddress(props.fromToken.address);
							if (newAmount === undefined) {
								if (props.perTokenInputRef.current[tokenAddress]) {
									props.perTokenInputRef.current[tokenAddress].ariaBusy = 'false';
									props.perTokenInputRef.current[tokenAddress].ariaInvalid = 'false';
									props.perTokenInputRef.current[tokenAddress].indeterminate = false;
								}
								set_quotes((q): TQuote => deleteQuote(q, toAddress(tokenAddress)));
								resolve(undefined);
							} else if (props.perTokenInputRef.current?.[tokenAddress]?.ariaBusy !== 'true') {
								if (toBigInt(newAmount?.raw) === 0n) {
									return resolve(undefined);
								}
								const estimate = await props.onHandleQuote(props.fromToken, toBigInt(newAmount?.raw));
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
			actions.execute(newAmount, toBigInt(newAmount?.raw) > 0n);
		},
		[actions]
	);

	return (
		<Fragment>
			<div className={'col-span-8 ml-1 flex w-full flex-row items-center gap-3'}>
				<input
					ref={
						props.perTokenInputRef.current[
							toAddress(props.fromToken.address)
						] as unknown as LegacyRef<HTMLInputElement>
					}
					type={'checkbox'}
					className={'checkbox cursor-pointer'}
					tabIndex={-1}
					checked={toBigInt(amount?.raw) > 0n}
					onChange={(event: React.ChangeEvent<HTMLInputElement>): void => {
						if (
							!event.target.checked ||
							props.perTokenInputRef.current[toAddress(props.fromToken.address)]?.ariaInvalid === 'true'
						) {
							onHandleAmount(undefined);
						} else {
							onHandleAmount(toNormalizedBN(props.balance.raw, props.balance.decimals));
						}
					}}
				/>
				<TokenInput
					allowance={-1}
					index={props.index}
					token={props.fromToken}
					shouldCheckAllowance={false}
					placeholder={`${toNormalizedBN(props.balance.raw, props.balance.decimals).normalized}`}
					value={amount}
					onChange={(v): void => onHandleAmount(v)}
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
						{`${formatAmount(estimateOut?.normalized || 0, 4, 4)} ${props.toToken.symbol}`}
					</div>
					<div>
						<button
							id={`quote-refresh-${toAddress(props.fromToken.address)}`}
							tabIndex={-1}
							className={'cursor-pointer text-neutral-200 transition-colors hover:text-neutral-900'}
							onClick={async (): Promise<void> => onHandleAmount(amount)}>
							<IconRefresh
								className={cl(
									'h-3 w-3',
									status === 'loading' ? 'text-neutral-900 animate-spin' : 'text-neutral-200'
								)}
							/>
						</button>
						<button
							id={`quote-reset-${toAddress(props.fromToken.address)}`}
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

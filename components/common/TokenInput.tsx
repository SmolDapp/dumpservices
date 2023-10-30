import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {useWallet} from 'contexts/useWallet';
import {getSpender} from 'hooks/useSolver';
import handleInputChangeEventValue from 'utils/handleInputChangeEventValue';
import {erc20ABI, useContractRead} from 'wagmi';
import {useAnimate} from 'framer-motion';
import {IconCircleCross} from '@icons/IconCircleCross';
import {IconInfo} from '@icons/IconInfo';
import {useClickOutside} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import {ImageWithFallback} from './ImageWithFallback';

import type {ChangeEvent, ReactElement} from 'react';
import type {TToken} from 'utils/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

type TViewFromToken = {
	token: TToken;
	value: TNormalizedBN;
	allowance: TNormalizedBN | -1;
	onChange: (value: TNormalizedBN) => void;
	label?: string;
	tokens?: TToken[];
	onChangeToken?: (token: TToken) => void;
	shouldCheckBalance?: boolean;
	shouldCheckAllowance?: boolean;
	isDisabled?: boolean;
	index?: number;
};
function TokenInput({
	token,
	value,
	onChange,
	tokens,
	onChangeToken,
	allowance,
	label,
	shouldCheckAllowance = true,
	shouldCheckBalance = true,
	isDisabled = false,
	index
}: TViewFromToken): ReactElement {
	const [scope, animate] = useAnimate();
	const inputRef = useRef<HTMLInputElement>(null);
	const {address} = useWeb3();
	const {getBalance} = useWallet();
	const {safeChainID} = useChainID();

	const balanceOf = useMemo((): TNormalizedBN => {
		return getBalance(toAddress(token?.address));
	}, [getBalance, token?.address]);

	const {data: allowanceForSpender, refetch: refetchAllowance} = useContractRead({
		address: token.address,
		abi: erc20ABI,
		functionName: 'allowance',
		args: [toAddress(address), getSpender({chainID: safeChainID})],
		enabled: false
	});

	const onChangeAmount = useCallback(
		(e: ChangeEvent<HTMLInputElement>): void => {
			const element = document.getElementById('amountToSend') as HTMLInputElement;
			const newAmount = handleInputChangeEventValue(e, token?.decimals || 18);
			if (newAmount.raw > balanceOf?.raw) {
				if (element?.value) {
					element.value = formatAmount(balanceOf?.normalized, 0, 18);
				}
				return onChange(toNormalizedBN(balanceOf?.raw || 0, token?.decimals || 18));
			}
			onChange(newAmount);
		},
		[balanceOf, onChange, token?.decimals]
	);

	useEffect((): void => {
		animate('button', {opacity: 0, x: 112, pointerEvents: 'none'}, {duration: 0.3});
		animate('span', {opacity: 1, x: 48}, {duration: 0.3});
	}, [animate]);

	useEffect((): void => {
		if (allowance === -1 && shouldCheckAllowance) {
			refetchAllowance();
		}
	}, [refetchAllowance, shouldCheckAllowance, allowance]);

	useClickOutside(inputRef, (): void => {
		animate('button', {opacity: 0, x: 112, pointerEvents: 'none'}, {duration: 0.3});
		animate('span', {opacity: 1, x: 48}, {duration: 0.3});
	});

	const onFocus = useCallback((): void => {
		animate('button', {opacity: 1, x: 0, pointerEvents: 'auto'}, {duration: 0.3});
		animate('span', {opacity: 1, x: 0}, {duration: 0.3});
	}, [animate]);

	const effectiveAllowance = allowance === -1 ? toNormalizedBN(allowanceForSpender || 0) : allowance;
	return (
		<div className={'grid w-full grid-cols-12 gap-x-2'}>
			{label && <div className={'col-span-12 mb-1 flex w-full text-neutral-600'}>{label}</div>}
			<div
				className={cl(
					'grow-1 col-span-5 flex h-10 w-full items-center justify-start rounded-md p-2 bg-neutral-0 border border-neutral-200'
				)}>
				<div className={'mr-2 h-6 w-6 min-w-[24px]'}>
					<ImageWithFallback
						alt={token.name}
						unoptimized
						src={token.logoURI || ''}
						width={24}
						height={24}
					/>
				</div>
				{tokens && tokens?.length > 0 ? (
					<select
						onChange={(e): void =>
							onChangeToken?.(
								(tokens || []).find((lst): boolean => lst.address === e.target.value) || token
							)
						}
						className={
							'w-full overflow-x-scroll border-none bg-transparent px-0 py-4 outline-none scrollbar-none'
						}
						value={token.address}
						defaultValue={token.symbol}>
						{(tokens || []).map(
							(lst): ReactElement => (
								<option
									key={lst.address}
									value={lst.address}>
									{lst.symbol}
								</option>
							)
						)}
					</select>
				) : (
					<div className={'overflow-hidden'}>
						<p className={'text-sm'}>{token.symbol}</p>
						<p className={'truncate text-[8px] text-neutral-600'}>
							{truncateHex(toAddress(token.address), 10)}
						</p>
					</div>
				)}
			</div>

			<label className={'grow-1 col-span-7 flex h-10 w-full'}>
				<div
					ref={inputRef}
					className={cl(
						'flex w-full items-center justify-between rounded-md p-2 border border-neutral-200 cursor-text',
						isDisabled ? 'bg-neutral-200' : 'bg-neutral-0'
					)}>
					<input
						className={
							'w-full overflow-x-scroll border-none bg-transparent px-0 py-4 font-mono text-sm outline-none scrollbar-none'
						}
						type={'number'}
						min={0}
						maxLength={20}
						max={balanceOf?.normalized || 0}
						step={1 / 10 ** (token?.decimals || 18)}
						inputMode={'numeric'}
						disabled={isDisabled}
						placeholder={`0.000000 ${token.symbol}`}
						pattern={'^((?:0|[1-9]+)(?:.(?:d+?[1-9]|[1-9]))?)$'}
						value={value?.normalized || ''}
						onChange={onChangeAmount}
						onFocus={onFocus}
					/>
					<div
						ref={scope}
						className={'ml-2 flex flex-row items-center space-x-2'}>
						<span
							className={'relative block h-4 w-4'}
							style={{zIndex: index}}>
							{shouldCheckAllowance && (
								<div className={'absolute inset-0'}>
									<span
										className={'tooltip'}
										style={{
											pointerEvents:
												value.raw > effectiveAllowance.raw && value.raw <= balanceOf.raw
													? 'auto'
													: 'none'
										}}>
										<IconInfo
											style={{
												opacity:
													value.raw > effectiveAllowance.raw && value.raw <= balanceOf.raw
														? 1
														: 0
											}}
											className={'h-4 w-4 text-neutral-400 transition-opacity'}
										/>
										<span className={'tooltipLight !-inset-x-24 top-full mt-2 !w-auto'}>
											<div
												suppressHydrationWarning
												className={
													'w-fit rounded-md border border-neutral-700 bg-neutral-900 p-1 px-2 text-center text-xs font-medium text-neutral-0'
												}>
												{`You will be prompted to approve spending of ${formatAmount(
													value.normalized,
													6,
													6
												)} ${token.symbol}`}
											</div>
										</span>
									</span>
								</div>
							)}
							{shouldCheckBalance && (
								<IconCircleCross
									style={{
										opacity: value.raw > balanceOf.raw ? 1 : 0,
										pointerEvents: value.raw > balanceOf.raw ? 'auto' : 'none'
									}}
									className={'absolute inset-0 h-4 w-4 text-red-900 transition-opacity'}
								/>
							)}
						</span>
						<button
							type={'button'}
							tabIndex={-1}
							onClick={(): void => onChange(balanceOf)}
							className={cl(
								'px-2 py-1 text-xs rounded-md border border-neutral-900 transition-colors bg-neutral-900 text-neutral-0',
								'opacity-0 pointer-events-none'
							)}>
							{'Max'}
						</button>
					</div>
				</div>
			</label>
		</div>
	);
}

export default TokenInput;

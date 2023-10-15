import React, {Fragment, useCallback, useMemo, useState} from 'react';
import {useWallet} from 'contexts/useWallet';
import {isAddress} from 'viem';
import {erc20ABI} from 'wagmi';
import {Combobox, Transition} from '@headlessui/react';
import {IconCheck} from '@icons/IconCheck';
import {IconChevronBoth} from '@icons/IconChevronBoth';
import {IconSpinner} from '@icons/IconSpinner';
import {useThrottledState} from '@react-hookz/web';
import {multicall} from '@wagmi/core';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {decodeAsNumber, decodeAsString} from '@yearn-finance/web-lib/utils/decoder';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {ImageWithFallback} from '@common/ImageWithFallback';

import type {ChangeEvent, Dispatch, ReactElement, SetStateAction} from 'react';
import type {TToken} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

function useFilterTokens(tokens: TToken[], query: string): TToken[] {
	const filteredTokens = useMemo((): TToken[] => {
		if (query === '' || tokens.length === 0) {
			return tokens;
		}
		return tokens.filter(
			(token): boolean =>
				token.name.toLowerCase().startsWith(query.toLowerCase()) ||
				token.symbol.toLowerCase().startsWith(query.toLowerCase()) ||
				token.address.toLowerCase().startsWith(query.toLowerCase())
		);
	}, [query, tokens]);
	return filteredTokens;
}

type TComboboxAddressInput = {
	value: TToken | null;
	possibleValues: TDict<TToken>;
	onChangeValue: (value: TToken) => void;
	onAddValue: Dispatch<SetStateAction<TDict<TToken>>>;
	shouldSort?: boolean;
};

type TElement = {
	address: TAddress;
	logoURI: string;
	symbol: string;
	chainID: number;
};
function PossibleElement({address, logoURI, symbol, chainID}: TElement): ReactElement {
	return (
		<div className={'flex w-full flex-row items-center space-x-4'}>
			<div className={'h-6 w-6'}>
				<ImageWithFallback
					alt={''}
					unoptimized
					src={logoURI || ''}
					altSrc={`https://assets.smold.app/api/token/${chainID}/${toAddress(address)}/logo-128.png`}
					width={24}
					height={24}
				/>
			</div>
			<div className={'flex flex-col font-sans text-neutral-900'}>
				<div className={'flex flex-row items-center'}>{symbol}</div>
				<small className={'font-number text-xs text-neutral-500'}>{toAddress(address)}</small>
			</div>
		</div>
	);
}

function SelectedElement({address, logoURI, symbol, chainID, onChange}: TElement & {onChange: (event: ChangeEvent<HTMLInputElement>) => void}): ReactElement {
	return (
		<div className={'relative flex w-full flex-row items-center space-x-4'}>
			<div className={'h-6 w-6'}>
				<ImageWithFallback
					key={`${toAddress(address)}_${chainID}`}
					alt={''}
					unoptimized
					src={logoURI || ''}
					altSrc={`https://assets.smold.app/api/token/${chainID}/${toAddress(address)}/logo-128.png`}
					width={24}
					height={24}
				/>
			</div>
			<div className={'flex w-full flex-col text-left font-sans text-neutral-900'}>
				<p className={'w-full overflow-x-hidden text-ellipsis whitespace-nowrap pr-4 font-normal text-neutral-900 scrollbar-none'}>
					<Combobox.Input
						className={'font-inter w-full cursor-default overflow-x-scroll border-none bg-transparent p-0 outline-none scrollbar-none'}
						displayValue={(): string => symbol}
						placeholder={'0x...'}
						autoComplete={'off'}
						autoCorrect={'off'}
						spellCheck={false}
						onChange={onChange}
					/>
				</p>
			</div>
		</div>
	);
}

function ComboboxOption({option}: {option: TToken}): ReactElement {
	const memorizedElement = useMemo<ReactElement>(
		(): ReactElement => (
			<PossibleElement
				logoURI={option.logoURI || ''}
				chainID={option.chainId}
				symbol={option.symbol || ''}
				address={option.address}
			/>
		),
		[option]
	);
	return (
		<Combobox.Option
			className={({active: isActive}): string => `relative cursor-pointer select-none py-2 px-4 ${isActive ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-900'}`}
			value={option}>
			{({selected: isSelected}): ReactElement => (
				<div>
					{memorizedElement}
					{isSelected ? (
						<span className={'absolute inset-y-0 right-8 flex items-center'}>
							<IconCheck className={'absolute h-4 w-4 text-neutral-900'} />
						</span>
					) : null}
				</div>
			)}
		</Combobox.Option>
	);
}

function Backdrop({isOpen, onClose}: {isOpen: boolean; onClose: VoidFunction}): ReactElement {
	if (!isOpen) {
		return <></>;
	}
	return (
		<div
			className={'fixed inset-0 z-0'}
			onClick={(e): void => {
				e.stopPropagation();
				e.preventDefault();
				onClose();
			}}
		/>
	);
}

function CurrentElement({
	currentValue,
	activeValue,
	query,
	onChange
}: {
	currentValue: TToken | null;
	activeValue: TToken | null;
	query: string;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}): ReactElement {
	/* 🔵 - Smoldapp *******************************************************************************
	 ** Display the active value (hovered one) instead of the selected unless if
	 ** - We have no current value: it's the first time, we don't want auto-populate
	 ** - We have no active value: user isn't searching, we don't want to assume
	 **********************************************************************************************/
	if (activeValue && (currentValue || query !== '')) {
		return (
			<SelectedElement
				address={activeValue.address}
				logoURI={activeValue.logoURI || ''}
				symbol={activeValue.symbol}
				chainID={activeValue.chainId}
				onChange={onChange}
			/>
		);
	}
	return (
		<SelectedElement
			address={toAddress(currentValue?.address)}
			logoURI={currentValue?.logoURI || ''}
			symbol={currentValue?.symbol || ''}
			chainID={currentValue?.chainId || 0}
			onChange={onChange}
		/>
	);
}

function ComboboxAddressInput({possibleValues, value, onChangeValue, onAddValue, shouldSort = true}: TComboboxAddressInput): ReactElement {
	const {safeChainID} = useChainID();
	const {balances, refresh} = useWallet();
	const [query, set_query] = useState<string>('');
	const [isOpen, set_isOpen] = useThrottledState<boolean>(false, 100);
	const [isLoadingTokenData, set_isLoadingTokenData] = useState<boolean>(false);
	const filteredValues = useFilterTokens(Object.values(possibleValues), query);

	const fetchToken = useCallback(
		async (_safeChainID: number, _query: TAddress): Promise<{name: string; symbol: string; decimals: number} | undefined> => {
			if (!isAddress(_query)) {
				return undefined;
			}
			const results = await multicall({
				contracts: [
					{address: _query, abi: erc20ABI, functionName: 'name'},
					{address: _query, abi: erc20ABI, functionName: 'symbol'},
					{address: _query, abi: erc20ABI, functionName: 'decimals'}
				],
				chainId: _safeChainID
			});
			const name = decodeAsString(results[0]);
			const symbol = decodeAsString(results[1]);
			const decimals = decodeAsNumber(results[2]);
			await refresh([{decimals, name, symbol, token: _query}]);
			return {name, symbol, decimals};
		},
		[refresh]
	);

	const onChange = useCallback(
		async (_selected: TToken): Promise<void> => {
			let _tokenData = _selected;
			if (!_tokenData || (!_tokenData.name && !_tokenData.symbol && !_tokenData.decimals)) {
				set_isLoadingTokenData(true);
				const result = await fetchToken(safeChainID, _selected.address);
				_tokenData = {
					..._tokenData,
					name: result?.name || '',
					symbol: result?.symbol || '',
					decimals: result?.decimals || 0,
					chainId: safeChainID,
					logoURI: `https://assets.smold.app/api/token/${_selected.chainId}/${toAddress(_selected.address)}/logo-128.png`
				};
				set_isLoadingTokenData(false);
			}

			onAddValue((prev: TDict<TToken>): TDict<TToken> => {
				if (prev[_selected.address]) {
					return prev;
				}
				return {...prev, [toAddress(_selected.address)]: _tokenData};
			});
			onChangeValue(_tokenData);
			set_isOpen(false);
		},
		[possibleValues, fetchToken, safeChainID, onAddValue, onChangeValue, set_isOpen]
	);

	const filteredBalances = useMemo((): [TToken[], TToken[]] => {
		if (!shouldSort) {
			return [filteredValues, []];
		}
		const withBalance = [];
		const withoutBalance = [];
		for (const dest of filteredValues) {
			if (toBigInt(balances?.[toAddress(dest.address)]?.raw) > 0n) {
				withBalance.push(dest);
			} else {
				withoutBalance.push(dest);
			}
		}
		return [withBalance, withoutBalance];
	}, [balances, filteredValues, shouldSort]);

	return (
		<div className={'w-full'}>
			<Backdrop
				isOpen={isOpen}
				onClose={(): void => set_isOpen(false)}
			/>
			<Combobox<TToken | null>
				value={value}
				onChange={onChange}>
				{({activeOption}): ReactElement => (
					<div className={'relative'}>
						<Combobox.Button
							onClick={(): void => set_isOpen((o: boolean): boolean => !o)}
							className={'box-0 grow-1 col-span-12 flex h-12 w-full items-center p-2 px-4 md:col-span-9'}>
							{/* {selectedElement} */}
							<CurrentElement
								activeValue={activeOption}
								currentValue={value}
								query={query}
								onChange={(event): void => {
									set_isOpen(true);
									set_query(event.target.value);
								}}
							/>
							{isLoadingTokenData && (
								<div className={'absolute right-8'}>
									<IconSpinner className={'h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900'} />
								</div>
							)}
							<div className={'absolute right-2 md:right-3'}>
								<IconChevronBoth className={'h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900'} />
							</div>
						</Combobox.Button>
						<Transition
							as={Fragment}
							show={isOpen}
							enter={'transition duration-100 ease-out'}
							enterFrom={'transform scale-95 opacity-0'}
							enterTo={'transform scale-100 opacity-100'}
							leave={'transition duration-75 ease-out'}
							leaveFrom={'transform scale-100 opacity-100'}
							leaveTo={'transform scale-95 opacity-0'}>
							<Combobox.Options className={'box-0 absolute left-0 z-50 mt-1 flex max-h-60 w-full min-w-fit flex-col overflow-y-auto scrollbar-none'}>
								{filteredValues.length === 0 && query !== '' ? (
									<div className={'relative cursor-default select-none px-4 py-2 text-neutral-500'}>{'No token found.'}</div>
								) : (
									[...filteredBalances[0], ...filteredBalances[1]].slice(0, 100).map(
										(dest): ReactElement => (
											<ComboboxOption
												key={`${dest.address}_${dest.chainId}`}
												option={dest}
											/>
										)
									)
								)}
							</Combobox.Options>
						</Transition>
					</div>
				)}
			</Combobox>
		</div>
	);
}

export default ComboboxAddressInput;

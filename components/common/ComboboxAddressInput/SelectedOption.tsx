import React from 'react';
import {Combobox} from '@headlessui/react';
import {IconChevronBoth} from '@icons/IconChevronBoth';
import {IconSpinner} from '@icons/IconSpinner';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/ImageWithFallback';

import type {ChangeEvent, Dispatch, ReactElement, SetStateAction} from 'react';
import type {TToken} from 'utils/types';
import type {TElement} from './types';

function ComboboxInput(props: TElement & {onChange: (event: ChangeEvent<HTMLInputElement>) => void}): ReactElement {
	return (
		<div className={'relative flex w-full flex-row items-center space-x-4'}>
			<div className={'h-6 w-6'}>
				<ImageWithFallback
					alt={''}
					unoptimized
					src={props.logoURI || ''}
					altSrc={`https://assets.smold.app/api/token/${props.chainId}/${toAddress(props.address)}/logo-128.png`}
					width={24}
					height={24}
				/>
			</div>
			<div className={'flex w-full flex-col text-left font-sans text-neutral-900'}>
				<p className={'w-full overflow-x-hidden text-ellipsis whitespace-nowrap pr-4 font-normal text-neutral-900 scrollbar-none'}>
					<Combobox.Input
						className={'font-inter w-full cursor-default overflow-x-scroll border-none bg-transparent p-0 outline-none scrollbar-none'}
						displayValue={(): string => props.symbol}
						placeholder={'0x...'}
						autoComplete={'off'}
						autoCorrect={'off'}
						spellCheck={false}
						onChange={props.onChange}
					/>
				</p>
			</div>
		</div>
	);
}

function SelectedOption(props: {
	currentValue: TToken | null;
	activeValue: TToken | null;
	query: string;
	isFetchingNewToken: boolean;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onToggleOptions: Dispatch<SetStateAction<boolean>>;
}): ReactElement {
	let source = props.currentValue;
	/* 🔵 - Smoldapp *******************************************************************************
	 ** Display the active value (hovered one) instead of the selected unless if
	 ** - We have no current value: it's the first time, we don't want auto-populate
	 ** - We have no active value: user isn't searching, we don't want to assume
	 **********************************************************************************************/
	if (props.activeValue && (props.currentValue || props.query !== '')) {
		source = props.activeValue;
	}

	return (
		<Combobox.Button
			onClick={(): void => props.onToggleOptions((o: boolean): boolean => !o)}
			className={'box-0 grow-1 col-span-12 flex h-12 w-full items-center p-2 px-4 md:col-span-9'}>
			<ComboboxInput
				address={toAddress(source?.address)}
				logoURI={source?.logoURI || ''}
				symbol={source?.symbol || ''}
				chainId={source?.chainId || 0}
				onChange={props.onChange}
			/>
			{props.isFetchingNewToken && (
				<div className={'absolute right-8'}>
					<IconSpinner className={'h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900'} />
				</div>
			)}
			<div className={'absolute right-2 md:right-3'}>
				<IconChevronBoth className={'h-4 w-4 text-neutral-500 transition-colors group-hover:text-neutral-900'} />
			</div>
		</Combobox.Button>
	);
}

export {SelectedOption};

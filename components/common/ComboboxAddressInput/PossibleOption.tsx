import React, {useMemo} from 'react';
import {Combobox} from '@headlessui/react';
import {IconCheck} from '@icons/IconCheck';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ImageWithFallback} from '@common/ImageWithFallback';

import type {ReactElement} from 'react';
import type {TToken} from 'utils/types';
import type {TElement} from './types';

function Option(props: TElement): ReactElement {
	return (
		<div className={'flex w-full flex-row items-center space-x-4'}>
			<div className={'h-6 w-6'}>
				<ImageWithFallback
					alt={''}
					unoptimized
					src={props.logoURI || ''}
					altSrc={`${process.env.SMOL_ASSETS_URL}/token/${props.chainId}/${props.address}/logo-32.png`}
					width={24}
					height={24}
				/>
			</div>
			<div className={'flex flex-col font-sans text-neutral-900'}>
				<div className={'flex flex-row items-center'}>{props.symbol}</div>
				<small className={'font-number text-xs text-neutral-500'}>{toAddress(props.address)}</small>
			</div>
		</div>
	);
}

function PossibleOption({option}: {option: TToken}): ReactElement {
	const memorizedElement = useMemo<ReactElement>(
		(): ReactElement => <Option {...(option satisfies TElement)} />,
		[option]
	);

	return (
		<Combobox.Option
			className={({active: isActive}): string =>
				`relative cursor-pointer select-none py-2 px-4 ${
					isActive ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-900'
				}`
			}
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

export {PossibleOption};

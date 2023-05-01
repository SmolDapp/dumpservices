import React, {useCallback, useState} from 'react';
import IconCheck from 'components/icons/IconCheck';
import IconCircleCross from 'components/icons/IconCircleCross';
import {isAddress} from 'ethers/lib/utils';
import {checkENSValidity, checkLensValidity} from 'utils';
import lensProtocol from 'utils/lens.tools';
import {useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import IconLoader from '@yearn-finance/web-lib/icons/IconLoader';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function	AddressInput({value, onChangeValue, onConfirm, className}: {
	value: TAddress,
	onChangeValue: (value: TAddress) => void,
	onConfirm: (newReceiver: TAddress) => void,
	className?: string
}): ReactElement {
	const	[isValidValue, set_isValidValue] = useState<boolean | 'undetermined'>('undetermined');
	const	[isValidish, set_isValidish] = useState<boolean | 'undetermined'>('undetermined');
	const	[isLoadingValidish, set_isLoadingValidish] = useState<boolean>(false);
	const	[namedValue, set_namedValue] = useState<string>('');

	const	checkDestinationValidity = useCallback(async (): Promise<void> => {
		set_isValidValue('undetermined');
		if (namedValue && isValidish) {
			set_isValidValue(true);
		} else if (!isZeroAddress(toAddress(value))) {
			set_isValidValue(true);
		} else {
			if (value.endsWith('.eth')) {
				const	resolvedAddress = await getProvider(1).resolveName(value);
				if (resolvedAddress) {
					if (isAddress(resolvedAddress)) {
						performBatchedUpdates((): void => {
							set_namedValue(toAddress(resolvedAddress));
							set_isValidValue(true);
						});
						return;
					}
				}
			}
			if (value.endsWith('.lens')) {
				const	resolvedAddress = await lensProtocol.getAddressFromHandle(value);
				if (resolvedAddress) {
					if (isAddress(resolvedAddress)) {
						performBatchedUpdates((): void => {
							set_namedValue(toAddress(resolvedAddress));
							set_isValidValue(true);
						});
						return;
					}
				}
			}
			set_isValidValue(false);
		}
	}, [namedValue, isValidish, value, set_namedValue]);

	useUpdateEffect((): void => {
		if (namedValue === '' || isZeroAddress(toAddress(namedValue))) {
			set_namedValue(value);
		}
	}, [value]);

	useUpdateEffect((): void => {
		set_isValidValue('undetermined');
		set_isValidish('undetermined');
		if (value.endsWith('.eth')) {
			set_isLoadingValidish(true);
			checkENSValidity(value).then(([validishDest, isValid]): void => {
				performBatchedUpdates((): void => {
					set_isLoadingValidish(false);
					set_isValidish(isValid);
					set_namedValue(validishDest);
				});
			});
		} else if (value.endsWith('.lens')) {
			set_isLoadingValidish(true);
			checkLensValidity(value).then(([validishDest, isValid]): void => {
				performBatchedUpdates((): void => {
					set_isLoadingValidish(false);
					set_isValidish(isValid);
					set_namedValue(validishDest);
				});
			});
		} else if (!isZeroAddress(toAddress(value))) {
			set_isValidValue(true);
		} else {
			set_isValidish(false);
		}
	}, [value]);

	return (
		<form
			onSubmit={async (e): Promise<void> => e.preventDefault()}
			className={`mt-6 grid w-full grid-cols-12 flex-row items-center justify-between gap-4 md:w-3/4 md:gap-6 ${className}`}>
			<div className={'box-0 grow-1 col-span-12 flex h-10 w-full items-center p-2 md:col-span-9'}>
				<input
					aria-invalid={!isValidValue}
					onFocus={async (): Promise<void> => checkDestinationValidity()}
					onBlur={async (): Promise<void> => checkDestinationValidity()}
					required
					spellCheck={false}
					placeholder={'0x...'}
					type={'text'}
					value={value}
					onChange={(e): void => {
						set_isValidValue('undetermined');
						onChangeValue(e.target.value as never);
					}}
					className={'w-full overflow-x-scroll border-none bg-transparent py-4 px-0 font-mono text-sm font-bold outline-none scrollbar-none'} />
				<div className={'pointer-events-none relative h-4 w-4'}>
					<IconCheck
						className={`absolute h-4 w-4 text-[#16a34a] transition-opacity ${isValidValue === true || isValidish === true ? 'opacity-100' : 'opacity-0'}`} />
					<IconCircleCross
						className={`absolute h-4 w-4 text-[#e11d48] transition-opacity ${(isValidValue === false && toAddress(value) !== toAddress() && !isLoadingValidish) ? 'opacity-100' : 'opacity-0'}`} />
					<div className={'absolute inset-0 flex items-center justify-center'}>
						<IconLoader className={`h-4 w-4 animate-spin text-neutral-900 transition-opacity ${isLoadingValidish ? 'opacity-100' : 'opacity-0'}`} />
					</div>
				</div>
			</div>

			<div className={'col-span-12 md:col-span-3'}>
				<Button
					className={'yearn--button !w-[160px] rounded-md !text-sm'}
					onClick={(): void => {
						if (value.endsWith('.eth') || value.endsWith('.lens')) {
							onConfirm(toAddress(namedValue));
						} else if (isAddress(value)) {
							onConfirm(toAddress(value));
						}
					}}
					disabled={!(isValidValue === true || isValidish === true)}>
					{'Confirm'}
				</Button>
			</div>
		</form>
	);
}

export default AddressInput;

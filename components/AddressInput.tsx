import React, {useCallback, useMemo, useRef, useState} from 'react';
import {IconCheck} from 'components/icons/IconCheck';
import {IconCircleCross} from 'components/icons/IconCircleCross';
import {checkENSValidity} from 'utils/tools.ens';
import {checkLensValidity} from 'utils/tools.lens';
import {IconLoader} from '@yearn-finance/web-lib/icons/IconLoader';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import {ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {performBatchedUpdates} from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

export type TInputAddressLike = {
	address: TAddress | undefined,
	label: string,
	isValid: boolean | 'undetermined',
}
export const defaultInputAddressLike: TInputAddressLike = {
	address: undefined,
	label: '',
	isValid: false
};

function AddressInput({value, onChangeValue, className, shouldBeDisabled}: {
	value: TInputAddressLike,
	onChangeValue: (value: TInputAddressLike) => void,
	className?: string
	shouldBeDisabled?: boolean
}): ReactElement {
	const [isLoadingValidish, set_isLoadingValidish] = useState<boolean>(false);
	const currentLabel = useRef<string>(value.label);
	const isFocused = useRef<boolean>(false);
	const status = useMemo((): 'valid' | 'invalid' | 'warning' | 'pending' | 'none' => {
		if (value.isValid === true) {
			return 'valid';
		}
		if (value.isValid === false && value.label !== '' && value.address === ZERO_ADDRESS) {
			return 'invalid';
		}
		if (value.isValid === false && value.label !== '' && !isLoadingValidish && !isFocused.current) {
			return 'invalid';
		}
		if (isLoadingValidish) {
			return 'pending';
		}
		return 'none';
	}, [value, isLoadingValidish, isFocused]);

	const onChange = useCallback(async (label: string): Promise<void> => {
		currentLabel.current = label;

		if (label.endsWith('.eth') && label.length > 4) {
			performBatchedUpdates((): void => {
				onChangeValue({address: undefined, label, isValid: 'undetermined'});
				set_isLoadingValidish(true);
			});
			const [address, isValid] = await checkENSValidity(label);
			performBatchedUpdates((): void => {
				if (currentLabel.current === label) {
					onChangeValue({address, label, isValid});
				}
				set_isLoadingValidish(false);
			});
		} else if (label.endsWith('.lens') && label.length > 5) {
			performBatchedUpdates((): void => {
				onChangeValue({address: undefined, label, isValid: 'undetermined'});
				set_isLoadingValidish(true);
			});
			const [address, isValid] = await checkLensValidity(label);
			performBatchedUpdates((): void => {
				if (currentLabel.current === label) {
					onChangeValue({address, label, isValid});
				}
				set_isLoadingValidish(false);
			});
		} else if (!isZeroAddress(toAddress(label))) {
			onChangeValue({address: toAddress(label), label, isValid: true});
		} else {
			onChangeValue({address: undefined, label, isValid: false});
		}
	}, [onChangeValue, currentLabel]);

	return (
		<div className={cl('box-0 flex h-10 w-full items-center p-2', className)}>
			<div className={'flex h-10 w-full flex-row items-center justify-between px-0 py-4'}>
				<input
					disabled={shouldBeDisabled}
					aria-invalid={status === 'invalid'}
					onFocus={async (): Promise<void> => {
						isFocused.current = true;
						onChange(value.label);
					}}
					onBlur={(): void => {
						isFocused.current = false;
					}}
					onChange={async (e): Promise<void> => onChange(e.target.value)}
					required
					autoComplete={'off'}
					spellCheck={false}
					placeholder={'0x...'}
					type={'text'}
					value={value.label}
					className={'w-full overflow-x-scroll border-none bg-transparent px-0 py-4 font-mono text-sm font-bold outline-none scrollbar-none'} />
			</div>
			<label
				className={status === 'invalid' || status === 'warning' ? 'relative' : 'pointer-events-none relative h-4 w-4'}>
				<span className={status === 'invalid' || status === 'warning' ? 'tooltip' : 'pointer-events-none'}>
					<div className={'pointer-events-none relative h-4 w-4'}>
						<IconCheck
							className={`absolute h-4 w-4 text-[#16a34a] transition-opacity ${status === 'valid' ? 'opacity-100' : 'opacity-0'}`} />
						<IconCircleCross
							className={`absolute h-4 w-4 text-[#e11d48] transition-opacity ${status === 'invalid' ? 'opacity-100' : 'opacity-0'}`} />
						<div className={'absolute inset-0 flex items-center justify-center'}>
							<IconLoader className={`h-4 w-4 animate-spin text-neutral-900 transition-opacity ${status === 'pending' ? 'opacity-100' : 'opacity-0'}`} />
						</div>
					</div>
					<span className={'tooltiptextsmall'}>
						{status === 'invalid' && 'This address is invalid'}
						{status === 'warning' && 'This address is already in use'}
					</span>
				</span>
			</label>
		</div>
	);
}

export default AddressInput;

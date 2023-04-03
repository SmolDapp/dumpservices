import React, {useCallback, useState} from 'react';
import IconCheck from 'components/icons/IconCheck';
import IconCircleCross from 'components/icons/IconCircleCross';
import {useSweepooor} from 'contexts/useSweepooor';
import {ethers} from 'ethers';
import {isAddress} from 'ethers/lib/utils';
import lensProtocol from 'utils/lens.tools';
import {useUpdateEffect} from '@react-hookz/web';
import IconLoader from '@yearn-finance/web-lib/icons/IconLoader';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function	AddressInput(): ReactElement {
	const	{receiver, set_receiver} = useSweepooor();
	const	[validishDestination, set_validishDestination] = useState<string>('');
	const	[isValidDestination, set_isValidDestination] = useState<boolean | 'undetermined'>('undetermined');
	const	[isValidish, set_isValidish] = useState<boolean | 'undetermined'>('undetermined');
	const	[isLoadingValidish, set_isLoadingValidish] = useState<boolean>(false);

	const	checkDestinationValidity = useCallback(async (): Promise<void> => {
		set_isValidDestination('undetermined');
		if (validishDestination && isValidish) {
			set_isValidDestination(true);
		} else if (!isZeroAddress(toAddress(receiver))) {
			set_isValidDestination(true);
		} else {
			if (receiver.endsWith('.eth')) {
				const	resolvedAddress = await getProvider(1).resolveName(receiver);
				if (resolvedAddress) {
					if (isAddress(resolvedAddress)) {
						performBatchedUpdates((): void => {
							set_validishDestination(toAddress(resolvedAddress));
							set_isValidDestination(true);
						});
						return;
					}
				}
			}
			if (receiver.endsWith('.lens')) {
				const	resolvedAddress = await lensProtocol.getAddressFromHandle(receiver);
				if (resolvedAddress) {
					if (isAddress(resolvedAddress)) {
						performBatchedUpdates((): void => {
							set_validishDestination(toAddress(resolvedAddress));
							set_isValidDestination(true);
						});
						return;
					}
				}
			}
			set_isValidDestination(false);
		}
	}, [receiver, validishDestination, isValidish]);

	useUpdateEffect((): void => {
		async function checkENSValidity(ens: string): Promise<[TAddress, boolean]> {
			const	resolvedName = await getProvider(1).resolveName(ens);
			if (resolvedName) {
				if (isAddress(resolvedName)) {
					return [toAddress(resolvedName), true];
				}
			}
			return [toAddress(ethers.constants.AddressZero), false];
		}

		async function checkLensValidity(lens: string): Promise<[TAddress, boolean]> {
			const	resolvedName = await lensProtocol.getAddressFromHandle(lens);
			if (resolvedName) {
				if (isAddress(resolvedName)) {
					return [toAddress(resolvedName), true];
				}
			}
			return [toAddress(ethers.constants.AddressZero), false];
		}


		set_isValidDestination('undetermined');
		set_isValidish('undetermined');
		if (receiver.endsWith('.eth')) {
			set_isLoadingValidish(true);
			checkENSValidity(receiver).then(([validishDest, isValid]): void => {
				performBatchedUpdates((): void => {
					set_isLoadingValidish(false);
					set_isValidish(isValid);
					set_validishDestination(validishDest);
				});
			});
		} else if (receiver.endsWith('.lens')) {
			set_isLoadingValidish(true);
			checkLensValidity(receiver).then(([validishDest, isValid]): void => {
				performBatchedUpdates((): void => {
					set_isLoadingValidish(false);
					set_isValidish(isValid);
					set_validishDestination(validishDest);
				});
			});
		} else if (!isZeroAddress(toAddress(receiver))) {
			set_isValidDestination(true);
		} else {
			set_isValidish(false);
		}
	}, [receiver]);

	return (
		<div className={'relative flex h-8 w-full flex-row items-center rounded-md border border-neutral-0 bg-neutral-0 pr-4 md:w-[416px]'}>
			<input
				aria-invalid={!isValidDestination}
				onFocus={async (): Promise<void> => checkDestinationValidity()}
				onBlur={async (): Promise<void> => checkDestinationValidity()}
				required
				spellCheck={false}
				placeholder={'0x...'}
				value={receiver}
				onChange={(e): void => {
					set_isValidDestination('undetermined');
					set_receiver(e.target.value as never);
				}}
				className={'h-8 w-full overflow-x-scroll border-none bg-transparent px-2 font-mono text-xs text-neutral-900 outline-none scrollbar-none'}
				type={'text'} />
			<div className={'pointer-events-none relative h-3 w-3'}>
				<IconCheck
					className={`absolute h-3 w-3 text-[#16a34a] transition-opacity ${isValidDestination === true || isValidish === true ? 'opacity-100' : 'opacity-0'}`} />
				<IconCircleCross
					className={`absolute h-3 w-3 text-[#e11d48] transition-opacity ${(isValidDestination === false && toAddress(receiver) !== toAddress() && !isLoadingValidish) ? 'opacity-100' : 'opacity-0'}`} />
				<div className={'absolute inset-0 flex items-center justify-center'}>
					<IconLoader className={`h-3 w-3 animate-spin text-neutral-900 transition-opacity ${isLoadingValidish ? 'opacity-100' : 'opacity-0'}`} />
				</div>
			</div>
		</div>
	);
}

export default AddressInput;

import React, {useCallback, useState} from 'react';
import IconCheck from 'components/icons/IconCheck';
import IconCircleCross from 'components/icons/IconCircleCross';
import {useSweepooor} from 'contexts/useSweepooor';
import {ethers} from 'ethers';
import {isAddress} from 'ethers/lib/utils';
import lensProtocol from 'utils/lens.tools';
import {useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import IconLoader from '@yearn-finance/web-lib/icons/IconLoader';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function	ViewReceiver({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const	{receiver, set_receiver} = useSweepooor();
	const	[expectedReceiver, set_expectedReceiver] = useState<string>(receiver);
	const	[validishReceiver, set_validishReceiver] = useState<string>('');
	const	[isValidReceiver, set_isValidReceiver] = useState<boolean | 'undetermined'>('undetermined');
	const	[isValidish, set_isValidish] = useState<boolean | 'undetermined'>('undetermined');
	const	[isLoadingValidish, set_isLoadingValidish] = useState<boolean>(false);

	useUpdateEffect((): void => {
		if (expectedReceiver === '' || isZeroAddress(toAddress(expectedReceiver))) {
			set_expectedReceiver(receiver);
		}
	}, [receiver]);

	const	checkDestinationValidity = useCallback(async (): Promise<void> => {
		set_isValidReceiver('undetermined');
		if (validishReceiver && isValidish) {
			set_isValidReceiver(true);
		} else if (!isZeroAddress(toAddress(expectedReceiver))) {
			set_isValidReceiver(true);
		} else {
			if (expectedReceiver.endsWith('.eth')) {
				const	resolvedAddress = await getProvider(1).resolveName(expectedReceiver);
				if (resolvedAddress) {
					if (isAddress(resolvedAddress)) {
						performBatchedUpdates((): void => {
							set_validishReceiver(toAddress(resolvedAddress));
							set_isValidReceiver(true);
						});
						return;
					}
				}
			}
			if (expectedReceiver.endsWith('.lens')) {
				const	resolvedAddress = await lensProtocol.getAddressFromHandle(expectedReceiver);
				if (resolvedAddress) {
					if (isAddress(resolvedAddress)) {
						performBatchedUpdates((): void => {
							set_validishReceiver(toAddress(resolvedAddress));
							set_isValidReceiver(true);
						});
						return;
					}
				}
			}
			set_isValidReceiver(false);
		}
	}, [expectedReceiver, validishReceiver, isValidish]);

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


		set_isValidReceiver('undetermined');
		set_isValidish('undetermined');
		if (expectedReceiver.endsWith('.eth')) {
			set_isLoadingValidish(true);
			checkENSValidity(expectedReceiver).then(([validishDest, isValid]): void => {
				performBatchedUpdates((): void => {
					set_isLoadingValidish(false);
					set_isValidish(isValid);
					set_validishReceiver(validishDest);
				});
			});
		} else if (expectedReceiver.endsWith('.lens')) {
			set_isLoadingValidish(true);
			checkLensValidity(expectedReceiver).then(([validishDest, isValid]): void => {
				performBatchedUpdates((): void => {
					set_isLoadingValidish(false);
					set_isValidish(isValid);
					set_validishReceiver(validishDest);
				});
			});
		} else if (!isZeroAddress(toAddress(expectedReceiver))) {
			set_isValidReceiver(true);
		} else {
			set_isValidish(false);
		}
	}, [expectedReceiver]);

	return (
		<section>
			<div className={'box-0 grid w-full grid-cols-12 overflow-hidden'}>
				<div className={'col-span-12 flex flex-col p-4 text-neutral-900 md:p-6'}>
					<div className={'w-full md:w-3/4'}>
						<b>{'Recipient'}</b>
						<p className={'text-sm text-neutral-500'}>
							{'You can change the address to which the funds will be sent to. Be careful, this is irreversible!'}
						</p>
					</div>
					<form
						onSubmit={async (e): Promise<void> => e.preventDefault()}
						className={'mt-6 grid w-full grid-cols-12 flex-row items-center justify-between gap-4 md:w-3/4 md:gap-6'}>
						<div className={'box-100 grow-1 col-span-12 flex h-10 w-full items-center p-2 md:col-span-9'}>
							<div className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}>
								<input
									aria-invalid={!isValidReceiver}
									onFocus={async (): Promise<void> => checkDestinationValidity()}
									onBlur={async (): Promise<void> => checkDestinationValidity()}
									required
									spellCheck={false}
									placeholder={'0x...'}
									value={expectedReceiver}
									onChange={(e): void => {
										set_isValidReceiver('undetermined');
										set_expectedReceiver(e.target.value);
									}}
									className={'w-full overflow-x-scroll border-none bg-transparent py-4 px-0 font-mono text-sm font-bold outline-none scrollbar-none'}
									type={'text'} />
							</div>
							<div className={'pointer-events-none relative h-4 w-4'}>
								<IconCheck
									className={`absolute h-4 w-4 text-[#16a34a] transition-opacity ${isValidReceiver === true || isValidish === true ? 'opacity-100' : 'opacity-0'}`} />
								<IconCircleCross
									className={`absolute h-4 w-4 text-[#e11d48] transition-opacity ${(isValidReceiver === false && expectedReceiver !== '' && !isLoadingValidish) ? 'opacity-100' : 'opacity-0'}`} />
								<div className={'absolute inset-0 flex items-center justify-center'}>
									<IconLoader className={`h-4 w-4 animate-spin text-neutral-900 transition-opacity ${isLoadingValidish ? 'opacity-100' : 'opacity-0'}`} />
								</div>
							</div>
						</div>
						<div className={'col-span-12 md:col-span-3'}>
							<Button
								className={'yearn--button !w-[160px] rounded-md !text-sm'}
								onClick={(): void => {
									if (expectedReceiver.endsWith('.eth') || expectedReceiver.endsWith('.lens')) {
										set_receiver(toAddress(validishReceiver));
									} else if (isAddress(expectedReceiver)) {
										set_receiver(toAddress(expectedReceiver));
									}
									onProceed();
								}}
								disabled={!(isValidReceiver === true || isValidish === true)}>
								{'Confirm'}
							</Button>
						</div>
					</form>
				</div>
			</div>
		</section>
	);
}

export default ViewReceiver;

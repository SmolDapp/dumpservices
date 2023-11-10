import React, {useEffect, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import AddressInput, {defaultInputAddressLike} from '@common/AddressInput';

import type {ReactElement} from 'react';
import type {TInputAddressLike} from '@common/AddressInput';

function ViewReceiver({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const {address} = useWeb3();
	const {receiver, set_receiver} = useSweepooor();
	const [tokenReceiver, set_tokenReceiver] = useState<TInputAddressLike>(defaultInputAddressLike);
	const [hasBeenConfirmed, set_hasBeenConfirmed] = useState(false);

	useEffect((): void => {
		if (!tokenReceiver?.label && toAddress(address) !== toAddress()) {
			set_tokenReceiver({address, isValid: true, label: address as string});
		}
	}, [tokenReceiver, address]);

	return (
		<section>
			<div className={'box-0 grid w-full grid-cols-12 overflow-hidden'}>
				<div className={'col-span-12 flex flex-col p-4 text-neutral-900 md:p-6'}>
					<div className={'w-full md:w-3/4'}>
						<b>{'Recipient'}</b>
						<p className={'text-sm text-neutral-500'}>
							{
								'You can change the address to which the funds will be sent to. Be careful, this is irreversible!'
							}
						</p>
					</div>
					<form
						onSubmit={async (e): Promise<void> => e.preventDefault()}
						className={
							'mt-6 grid w-full grid-cols-12 flex-row items-center justify-between gap-4 md:w-3/4 md:gap-6'
						}>
						<div className={'col-span-12 md:col-span-9'}>
							<AddressInput
								value={tokenReceiver}
								onChangeValue={(e): void => set_tokenReceiver(e)}
							/>
						</div>

						<div className={'col-span-12 md:col-span-3'}>
							<Button
								className={'yearn--button !w-[160px] rounded-md !text-sm'}
								onClick={(): void => {
									set_receiver(toAddress(tokenReceiver.address));
									set_hasBeenConfirmed(true);
									onProceed();
								}}
								isDisabled={hasBeenConfirmed && toAddress(tokenReceiver.address) === receiver}>
								{'Next'}
							</Button>
						</div>
					</form>
				</div>
			</div>
		</section>
	);
}

export default ViewReceiver;

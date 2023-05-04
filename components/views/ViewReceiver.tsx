import React, {useState} from 'react';
import AddressInput from 'components/AddressInput';
import {useSweepooor} from 'contexts/useSweepooor';
import {useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function	ViewReceiver({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const	{address} = useWeb3();
	const	{receiver, set_receiver} = useSweepooor();
	const	[tokenReceiver, set_tokenReceiver] = useState('');
	const	[hasBeenConfirmed, set_hasBeenConfirmed] = useState(false);

	useUpdateEffect((): void => {
		if (tokenReceiver === '') {
			set_tokenReceiver(toAddress(address));
		}
	}, [tokenReceiver, address]);

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
					<AddressInput
						value={tokenReceiver as TAddress}
						onChangeValue={set_tokenReceiver}
						shouldBeDisabled={hasBeenConfirmed && tokenReceiver === receiver}
						onConfirm={(newReceiver: TAddress): void => {
							performBatchedUpdates((): void => {
								set_receiver(newReceiver);
								set_tokenReceiver(newReceiver);
								set_hasBeenConfirmed(true);
								onProceed();
							});
						}}/>
				</div>
			</div>
		</section>
	);
}

export default ViewReceiver;

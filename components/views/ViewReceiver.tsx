import React from 'react';
import AddressInput from 'components/AddressInput';
import {useSweepooor} from 'contexts/useSweepooor';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function	ViewReceiver({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const	{receiver, set_receiver} = useSweepooor();

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
						value={receiver}
						onChangeValue={set_receiver}
						onConfirm={(newReceiver: TAddress): void => {
							set_receiver(newReceiver);
							onProceed();
						}}/>
				</div>
			</div>
		</section>
	);
}

export default ViewReceiver;

import React from 'react';
import ViewSectionHeading from '@common/ViewSectionHeading';

import {WalletCard} from './WalletCard';

import type {ReactElement} from 'react';

type TViewWalletProps = {
	onSelect: () => void;
};

function ViewWallet({onSelect}: TViewWalletProps): ReactElement {
	return (
		<section
			id={'wallet'}
			className={'pt-10'}>
			<div className={'box-0 relative grid w-full grid-cols-12 overflow-hidden'}>
				<div
					className={
						'absolute right-6 top-6 flex flex-row items-center justify-center space-x-2 text-xs text-neutral-400'
					}>
					<p className={''}>{'Powered by CoW Protocol'}</p>
				</div>
				<ViewSectionHeading
					title={'Connect your Wallet'}
					content={'Connect your wallet to start using this app.'}
				/>
				<div className={'col-span-12 grid grid-cols-12 gap-4 p-4 pt-0 md:gap-6 md:p-6 md:pt-0'}>
					<WalletCard onSelect={onSelect} />
				</div>
			</div>
		</section>
	);
}

export default ViewWallet;

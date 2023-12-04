import React from 'react';
import CardWithIcon from 'components/common/CardWithIcon';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {IconWalletWalletConnect} from '@yearn-finance/web-lib/icons/IconWalletWalletConnect';

import type {ReactElement} from 'react';

type TViewWalletProps = {
	onSelect: () => void;
};

function WalletCard({onSelect}: TViewWalletProps): ReactElement {
	const {isActive, onConnect} = useWeb3();

	return (
		<div className={'relative col-span-6 flex md:col-span-4'}>
			<CardWithIcon
				isSelected={isActive}
				icon={<IconWalletWalletConnect />}
				label={'WalletConnect'}
				onClick={async (): Promise<void> => {
					await onConnect();
					onSelect();
				}}
			/>
		</div>
	);
}

export {WalletCard};

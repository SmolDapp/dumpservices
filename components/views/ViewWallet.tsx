import React, {useCallback} from 'react';
import dynamic from 'next/dynamic';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {IconWalletWalletConnect} from '@yearn-finance/web-lib/icons/IconWalletWalletConnect';

import type {TCardWithIcon} from 'components/CardWithIcon';
import type {LoaderComponent} from 'next/dynamic';
import type {ReactElement} from 'react';

const CardWithIcon = dynamic<TCardWithIcon>(async (): LoaderComponent<TCardWithIcon> => import('../CardWithIcon'), {ssr: false});

type TViewWalletProps = {
	onSelect: () => void;
};

function ViewWallet({onSelect}: TViewWalletProps): ReactElement {
	const {onConnect, provider} = useWeb3();

	const onSelectWallet = useCallback(async (): Promise<void> => {
		try {
			onSelect();
			await onConnect();
		} catch {
			//
		}
	}, [onConnect, onSelect]);

	return (
		<section id={'wallet'} className={'pt-10'}>
			<div className={'box-0 grid w-full grid-cols-12 overflow-hidden'}>
				<div className={'relative col-span-12 flex flex-col p-4 text-neutral-900 md:p-6'}>
					<div className={'absolute right-6 top-6 flex flex-row items-center justify-center space-x-2 text-xs text-neutral-400'}>
						<p className={''}>{'Powered by CoW Protocol'}</p>
					</div>
					<div className={'w-full md:w-3/4'}>
						<a href={'#wallet'}>
							<b>{'Connect your wallet'}</b>
						</a>
						<p className={'text-sm text-neutral-500'}>
							{'Connect your wallet to start dumping like a pro.'}
						</p>
					</div>
					<div className={'col-span-12 mt-6 grid grid-cols-12 gap-4 md:gap-6'}>
						<div
							suppressHydrationWarning
							className={'relative col-span-6 flex md:col-span-3'}>
							<CardWithIcon
								isSelected={!!provider}
								icon={<IconWalletWalletConnect />}
								label={'WalletConnect'}
								onClick={onSelectWallet} />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export default ViewWallet;

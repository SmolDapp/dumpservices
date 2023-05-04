import React, {useCallback, useMemo} from 'react';
import dynamic from 'next/dynamic';
import {useWallet} from 'contexts/useWallet';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useInjectedWallet} from '@yearn-finance/web-lib/hooks/useInjectedWallet';
import IconWalletLedger from '@yearn-finance/web-lib/icons/IconWalletLedger';
import IconWalletSafe from '@yearn-finance/web-lib/icons/IconWalletSafe';
import IconWalletWalletConnect from '@yearn-finance/web-lib/icons/IconWalletWalletConnect';

import type {TCardWithIcon} from 'components/CardWithIcon';
import type {LoaderComponent} from 'next/dynamic';
import type {ReactElement} from 'react';

const CardWithIcon = dynamic<TCardWithIcon>(async (): LoaderComponent<TCardWithIcon> => import('../CardWithIcon'), {ssr: false});

type TViewWalletProps = {
	onSelect: () => void;
};

function	ViewWallet({onSelect}: TViewWalletProps): ReactElement {
	const	{onConnect, walletType} = useWeb3();
	const	{walletProvider, set_walletProvider} = useWallet();
	const	detectedWalletProvider = useInjectedWallet();
	const	isEmbedWallet = useMemo((): boolean => ['EMBED_LEDGER', 'EMBED_GNOSIS_SAFE'].includes(walletType), [walletType]);

	const	onSelectWallet = useCallback(async (walletType: string): Promise<void> => {
		try {
			set_walletProvider(walletType);
			onSelect();
			await onConnect(walletType, (): void => set_walletProvider('NONE'), (): void => undefined);
		} catch {
			//
		}
	}, [onConnect, onSelect, set_walletProvider]);

	const	detectedWallet = useMemo((): {name: string, icon: ReactElement} => {
		if (walletType === 'EMBED_LEDGER') {
			return ({
				name: 'Ledger',
				icon: <IconWalletLedger />
			});
		} if (walletType === 'EMBED_GNOSIS_SAFE') {
			return ({
				name: 'Safe',
				icon: <IconWalletSafe />
			});
		}
		return ({
			name: detectedWalletProvider.name,
			icon: detectedWalletProvider.icon
		});
	}, [detectedWalletProvider, walletType]);

	return (
		<section id={'wallet'} className={'pt-10'}>
			<div className={'box-0 grid w-full grid-cols-12 overflow-hidden'}>
				<div className={'relative col-span-12 flex flex-col p-4 text-neutral-900 md:p-6'}>
					<div className={'absolute top-6 right-6 flex flex-row items-center justify-center space-x-2 text-xs text-neutral-400'}>
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
						<div className={'relative col-span-6 md:col-span-3'}>
							<CardWithIcon
								isSelected={walletProvider === 'INJECTED' || walletType === 'INJECTED' || isEmbedWallet}
								icon={detectedWallet.icon}
								label={detectedWallet.name}
								onClick={async (): Promise<void> => isEmbedWallet ? undefined : onSelectWallet('INJECTED')} />
						</div>
						<div
							suppressHydrationWarning
							className={`relative col-span-6 md:col-span-3 ${isEmbedWallet ? 'hidden' : 'flex'}`}>
							<CardWithIcon
								isSelected={walletProvider === 'WALLET_CONNECT' || walletType === 'WALLET_CONNECT'}
								icon={<IconWalletWalletConnect />}
								label={'WalletConnect'}
								onClick={async (): Promise<void> => onSelectWallet('WALLET_CONNECT')} />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export default ViewWallet;

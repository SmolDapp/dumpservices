import React, {Fragment, useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/router';
import Logo from 'components/icons/logo';
import {Listbox, Transition} from '@headlessui/react';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChain} from '@yearn-finance/web-lib/hooks/useChain';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import IconChevronBottom from '@yearn-finance/web-lib/icons/IconChevronBottom';
import IconWallet from '@yearn-finance/web-lib/icons/IconWallet';
import {truncateHex} from '@yearn-finance/web-lib/utils/address';

import type {ReactElement} from 'react';

type TMenu = {path: string, label: string | ReactElement, target?: string};
type TNavbar = {nav: TMenu[], currentPathName: string};
type TNetwork = {value: number, label: string};
export type THeader = {
	nav: TMenu[],
	supportedNetworks?: number[],
	currentPathName: string
}

function	Navbar({nav, currentPathName}: TNavbar): ReactElement {
	return (
		<nav className={'yearn--nav'}>
			{nav.map((option): ReactElement => (
				<Link
					key={option.path}
					target={option.target}
					href={option.path}>
					<p className={`yearn--header-nav-item ${currentPathName === option.path ? 'active' : '' }`}>
						{option.label}
					</p>
				</Link>
			))}
		</nav>
	);
}

function	NetworkSelector({supportedChainID}: {supportedChainID: number[]}): ReactElement {
	const chains = useChain();
	const {safeChainID} = useChainID();
	const {onSwitchChain} = useWeb3();

	const supportedNetworks = useMemo((): TNetwork[] => {
		const	noTestnet = supportedChainID.filter((chainID: number): boolean => chainID !== 1337);
		return noTestnet.map((chainID: number): TNetwork => (
			{value: chainID, label: chains.get(chainID)?.displayName || `Chain ${chainID}`}
		));
	}, [chains, supportedChainID]);

	const	currentNetwork = useMemo((): TNetwork | undefined => (
		supportedNetworks.find((network): boolean => network.value === safeChainID)
	), [safeChainID, supportedNetworks]);

	if (supportedNetworks.length === 1) {
		if (currentNetwork?.value === supportedNetworks[0]?.value) {
			return (
				<button
					disabled
					suppressHydrationWarning
					className={'yearn--header-nav-item mr-4 hidden !cursor-default flex-row items-center border-0 p-0 text-sm hover:!text-neutral-500 md:flex'}>
					<div suppressHydrationWarning className={'relative flex flex-row items-center'}>
						{supportedNetworks[0]?.label || 'Ethereum'}
					</div>
				</button>
			);
		}
		return (
			<button
				suppressHydrationWarning
				onClick={(): void => onSwitchChain(supportedNetworks[0].value, true)}
				className={'yearn--header-nav-item mr-4 hidden cursor-pointer flex-row items-center border-0 p-0 text-sm hover:!text-neutral-500 md:flex'}>
				<div suppressHydrationWarning className={'relative flex flex-row items-center'}>
					{'Invalid Network'}
				</div>
			</button>
		);
	}

	return (
		<div className={'relative z-50 mr-4'}>
			<Listbox
				value={safeChainID}
				onChange={(value: any): void => onSwitchChain(value.value, true)}>
				{({open}): ReactElement => (
					<>
						<Listbox.Button
							suppressHydrationWarning
							className={'yearn--header-nav-item hidden flex-row items-center border-0 p-0 text-sm md:flex'}>
							<div suppressHydrationWarning className={'relative flex flex-row items-center'}>
								{currentNetwork?.label || 'Ethereum'}
							</div>
							<div className={'ml-2'}>
								<IconChevronBottom
									className={`h-5 w-4 transition-transform ${open ? '-rotate-180' : 'rotate-0'}`} />
							</div>
						</Listbox.Button>
						<Transition
							as={Fragment}
							show={open}
							enter={'transition duration-100 ease-out'}
							enterFrom={'transform scale-95 opacity-0'}
							enterTo={'transform scale-100 opacity-100'}
							leave={'transition duration-75 ease-out'}
							leaveFrom={'transform scale-100 opacity-100'}
							leaveTo={'transform scale-95 opacity-0'}>
							<Listbox.Options className={'yearn--listbox-menu yearn--shadow -ml-1 bg-neutral-0'}>
								{supportedNetworks.map((network): ReactElement => (
									<Listbox.Option key={network.value} value={network}>
										{({active}): ReactElement => (
											<div
												data-active={active}
												className={'yearn--listbox-menu-item text-sm'}>
												{network?.label || 'Ethereum'}
											</div>
										)}
									</Listbox.Option>
								))}
							</Listbox.Options>
						</Transition>
					</>
				)}
			</Listbox>
		</div>
	);
}

function	WalletSelector(): ReactElement {
	const	{options, isActive, address, ens, lensProtocolHandle, openLoginModal, onDesactivate, onSwitchChain} = useWeb3();
	const	[walletIdentity, set_walletIdentity] = useState<string | undefined>(undefined);

	useEffect((): void => {
		if (!isActive && address) {
			set_walletIdentity('Invalid Network');
		} else if (ens) {
			set_walletIdentity(ens);
		} else if (lensProtocolHandle) {
			set_walletIdentity(lensProtocolHandle);
		} else if (address) {
			set_walletIdentity(truncateHex(address, 4));
		} else {
			set_walletIdentity(undefined);
		}
	}, [ens, lensProtocolHandle, address, isActive]);

	return (
		<div
			onClick={(): void => {
				if (isActive) {
					onDesactivate();
				} else if (!isActive && address) {
					onSwitchChain(options?.defaultChainID || 1, true);
				} else {
					openLoginModal();
				}
			}}>
			<p suppressHydrationWarning className={'yearn--header-nav-item text-sm'}>
				{walletIdentity ? walletIdentity : (
					<span>
						<IconWallet
							className={'yearn--header-nav-item mt-0.5 block h-4 w-4 md:hidden'} />
						<span className={'relative hidden h-8 cursor-pointer items-center justify-center border border-transparent bg-neutral-900 px-2 text-xs font-normal text-neutral-0 transition-all hover:bg-neutral-800 md:flex'}>
							{'Connect wallet'}
						</span>
					</span>
				)}
			</p>
		</div>
	);
}

function	AppHeader(): ReactElement {
	const	{walletType} = useWeb3();
	const	{pathname} = useRouter();
	const	{options} = useWeb3();
	const	supportedNetworks = useMemo((): number[] => walletType === 'EMBED_LEDGER' ? [1] : [1, 10, 137, 250, 42161], [walletType]);

	const supportedChainID = useMemo((): number[] => (
		supportedNetworks || options?.supportedChainID || [1, 10, 250, 42161]
	), [supportedNetworks, options?.supportedChainID]);

	return (
		<div id={'head'} className={'fixed inset-x-0 top-0 z-50 w-full border-b border-neutral-100 bg-neutral-0/95'}>
			<div className={'mx-auto max-w-4xl'}>
				<header className={'yearn--header'}>
					<Navbar
						currentPathName={pathname || ''}
						nav={[{path: '/', label: <Logo className={'h-8 text-neutral-900'} />}]} />
					<div className={'flex w-1/3 md:hidden'}>
						<Logo className={'mt-2 h-6 text-neutral-700'} />
					</div>
					<div className={'flex w-1/3 justify-center'}>
					</div>
					<div className={'flex w-1/3 items-center justify-end'}>
						<NetworkSelector supportedChainID={supportedChainID} />
						<WalletSelector />
					</div>
				</header>
			</div>
		</div>
	);
}

export default AppHeader;

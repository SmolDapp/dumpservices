import React, {Fragment, useMemo, useState} from 'react';
import AddressInput from 'components/AddressInput';
import IconSpinner from 'components/icons/IconSpinner';
import ListHead from 'components/ListHead';
import SettingsPopover from 'components/SettingsPopover';
import TokenRow from 'components/TokenRow';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {Contract} from 'ethcall';
import {BigNumber} from 'ethers';
import {isAddress} from 'ethers/lib/utils';
import {Dialog, Transition} from '@headlessui/react';
import {useAsync} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChain} from '@yearn-finance/web-lib/hooks/useChain';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import IconCross from '@yearn-finance/web-lib/icons/IconCross';
import ERC20_ABI from '@yearn-finance/web-lib/utils/abi/erc20.abi';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getProvider, newEthCallProvider} from '@yearn-finance/web-lib/utils/web3/providers';

import type {providers} from 'ethers';
import type {TMinBalanceData} from 'hooks/useBalances';
import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';

function AddTokenPopover(): ReactElement {
	const	{provider, address} = useWeb3();
	const	{refresh} = useWallet();
	const	{safeChainID} = useChainID();
	const	[isOpen, set_isOpen] = useState(false);
	const	[token, set_token] = useState('');

	const [{result: tokenData}, fetchTokenData] = useAsync(async function fetchToken(
		_provider: providers.JsonRpcProvider,
		_safeChainID: number,
		_query: TAddress,
		_address: TAddress
	): Promise<{name: string, symbol: string, decimals: number, balanceOf: BigNumber} | undefined> {
		if (!isAddress(_query)) {
			return ({name: '', symbol: '', decimals: 0, balanceOf: BigNumber.from(0)});
		}
		const currentProvider = _safeChainID === 1 ? _provider || getProvider(1) : getProvider(1);
		const ethcallProvider = await newEthCallProvider(currentProvider);
		const erc20Contract = new Contract(_query, ERC20_ABI);

		const calls = [erc20Contract.name(), erc20Contract.symbol(), erc20Contract.decimals(), erc20Contract.balanceOf(_address)];
		const [name, symbol, decimals, balanceOf] = await ethcallProvider.tryAll(calls) as [string, string, BigNumber, BigNumber];
		console.log({name, symbol, decimals: decimals.toNumber(), balanceOf});
		return ({name, symbol, decimals: decimals.toNumber(), balanceOf});
	}, undefined);
		// fetchTokenData.execute(provider, safeChainID, toAddress(query));
		// 0x6982508145454Ce325dDbE47a25d4ec3d2311933

	console.log(tokenData);

	return (
		<>
			<button
				onClick={(): void => set_isOpen(true)}
				className={'text-xs text-neutral-200/40 transition-colors before:mr-1 before:text-base before:content-["+"] hover:text-neutral-200'}>
				{'Add custom token'}
			</button>
			<Transition
				appear
				show={isOpen}
				as={Fragment}>
				<Dialog
					as={'div'}
					onClose={(): void => set_isOpen(false)}
					className={'relative z-50 flex'}>
					<Transition.Child
						as={Fragment}
						enter={'ease-out duration-300'}
						enterFrom={'opacity-0'}
						enterTo={'opacity-100'}
						leave={'ease-in duration-200'}
						leaveFrom={'opacity-100'}
						leaveTo={'opacity-0'}>
						<div className={'fixed inset-0 bg-neutral-900/30'} />
					</Transition.Child>
					<div className={'fixed inset-0 overflow-y-auto'}>
						<div className={'flex min-h-full items-center justify-center p-4'}>
							<Transition.Child
								as={Fragment}
								enter={'ease-out duration-300'}
								enterFrom={'opacity-0 scale-95'}
								enterTo={'opacity-100 scale-100'}
								leave={'ease-in duration-200'}
								leaveFrom={'opacity-100 scale-100'}
								leaveTo={'opacity-0 scale-95'}>
								<Dialog.Panel className={'mt-[-27%]'}>
									<div className={'box-0 relative grid w-full max-w-3xl grid-cols-12'}>
										<button
											onClick={(): void => set_isOpen(false)}
											className={'absolute top-4 right-4'}>
											<IconCross className={'h-4 w-4 text-neutral-400 transition-colors hover:text-neutral-900'} />
										</button>
										<div className={'col-span-12 flex flex-col p-4 text-neutral-900 md:p-6 md:pb-4'}>
											<div className={'w-full md:w-3/4'}>
												<b>{'The power to dump is in your hands.'}</b>
												<p className={'pt-2 text-sm text-neutral-500'}>
													{'Want to dump a token that’s not listed? Just enter it’s contract address and we’ll add it to the list so you can dump away.'}
												</p>
											</div>
											<div className={'flex w-full flex-col space-y-2'}>
												<AddressInput
													className={'!w-full'}
													value={token as TAddress}
													onChangeValue={(v): void => {
														set_token(v);
														fetchTokenData.execute(provider, safeChainID, v, toAddress(address));
													}}
													onConfirm={(newToken: TAddress): void => {
														refresh([
															{
																token: newToken,
																decimals: tokenData?.decimals || 18,
																name: tokenData?.name || '',
																symbol: tokenData?.symbol || ''
															}
														], true);
														set_isOpen(false);
													}}/>
												<div
													className={'group mb-0 flex w-full flex-col justify-center rounded-none border border-x-0 border-neutral-200 bg-neutral-100 md:mb-2 md:rounded-md md:border-x'}>
													<div className={'font-number space-y-2 border-t-0 p-4 text-xs md:text-sm'}>
														<span className={'flex flex-col justify-between md:flex-row'}>
															<b>{'Address'}</b>
															<p className={'font-number overflow-hidden text-ellipsis'}>{toAddress(token)}</p>
														</span>
														<span className={'flex flex-col justify-between md:flex-row'}>
															<b>{'Name'}</b>
															<p className={'font-number'}>{tokenData?.name || '-'}</p>
														</span>
														<span className={'flex flex-col justify-between md:flex-row'}>
															<b>{'Symbol'}</b>
															<p className={'font-number'}>{tokenData?.symbol || '-'}</p>
														</span>
														<span className={'flex flex-col justify-between md:flex-row'}>
															<b>{'Balance'}</b>
															<p className={'font-number'}>{toNormalizedValue(tokenData?.balanceOf || 0, tokenData?.decimals)}</p>
														</span>
													</div>
												</div>
											</div>
										</div>
									</div>
								</Dialog.Panel>
							</Transition.Child>
						</div>
					</div>
				</Dialog>
			</Transition>
		</>
	);
}


function	ViewSweepTable({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const	{isActive, address, chainID} = useWeb3();
	const	{selected, quotes, destination, amounts} = useSweepooor();
	const	{balances, balancesNonce, isLoading} = useWallet();
	const	[sortBy, set_sortBy] = useState<string>('apy');
	const	[sortDirection, set_sortDirection] = useState<'asc' | 'desc'>('desc');
	const	[search, set_search] = useState<string>('');
	const	currentChain = useChain().getCurrent();

	const	hasQuoteForEverySelectedToken = useMemo((): boolean => {
		return (selected.length > 0 && selected.every((tokenAddress: string): boolean => (
			quotes[toAddress(tokenAddress)] !== undefined
		)));
	}, [selected, quotes]);

	const	balancesToDisplay = useMemo((): ReactElement[] => {
		balancesNonce;
		return (
			Object.entries(balances || [])
				.filter(([tokenAddress, tokenData]: [string, TMinBalanceData]): boolean => {
					if (search) {
						const searchArray = search.split(/[\s,]+/);
						return searchArray.some((searchTerm: string): boolean => {
							if (searchTerm === '') {
								return false;
							}
							return (`${tokenData.symbol}_${tokenData.name}_${tokenAddress}`.toLowerCase().includes(searchTerm.toLowerCase()));
						});
					}
					return true;
				})
				.filter(([, balance]: [string, TMinBalanceData]): boolean => (
					(balance?.raw && !balance.raw.isZero()) || (balance?.force || false)
				))
				.filter(([tokenAddress]: [string, TMinBalanceData]): boolean => (
					toAddress(tokenAddress) !== destination.address && toAddress(tokenAddress) !== ETH_TOKEN_ADDRESS
				))
				.filter(([tokenAddress]: [string, TMinBalanceData]): boolean => (
					destination.address === ETH_TOKEN_ADDRESS ? toAddress(tokenAddress) !== WETH_TOKEN_ADDRESS : true
				))
				.sort((a: [string, TMinBalanceData], b: [string, TMinBalanceData]): number => {
					const	[, aBalance] = a;
					const	[, bBalance] = b;

					if (sortBy === 'name') {
						return sortDirection === 'asc'
							? aBalance.symbol.localeCompare(bBalance.symbol)
							: bBalance.symbol.localeCompare(aBalance.symbol);
					}
					if (sortBy === 'balance') {
						return sortDirection === 'asc'
							? aBalance.raw.gt(bBalance.raw) ? 1 : -1
							: aBalance.raw.gt(bBalance.raw) ? -1 : 1;
					}
					return 0;
				})
				.map(([tokenAddress, balance]: [string, TMinBalanceData]): ReactElement => {
					return <TokenRow
						key={`${tokenAddress}-${chainID}-${balance.symbol}-${address}`}
						amount={amounts[toAddress(tokenAddress)]}
						explorer={currentChain?.block_explorer}
						balance={balance}
						tokenAddress={toAddress(tokenAddress)} />;
				})
		);
	}, [balancesNonce, balances, destination.address, sortBy, sortDirection, chainID, address, amounts, currentChain?.block_explorer, search]);

	return (
		<section>
			<div className={'box-0 relative grid w-full grid-cols-12'}>
				<div className={'absolute top-4 right-4'}>
					<SettingsPopover />
				</div>
				<div className={'col-span-12 flex flex-col p-4 text-neutral-900 md:p-6 md:pb-4'}>
					<div className={'w-full md:w-3/4'}>
						<b>{'Which tokens do you want to dump?'}</b>
						<p className={'text-sm text-neutral-500'}>
							{'Select the token(s) that you’d like to dump. In exchange you’ll receive whatever token you selected in the first step.'}
						</p>
					</div>
					<div className={'mt-4 w-full'}>
						<input
							onChange={(event): void => set_search(event.target.value)}
							value={search}
							className={'h-10 w-full rounded-md border border-neutral-200 py-2 px-4 text-sm focus:border-neutral-400 focus:outline-none'}
							type={'text'}
							placeholder={'Filter tokens...'} />
					</div>
				</div>

				{balancesToDisplay.length === 0 && isLoading ? (
					<div className={'col-span-12 flex min-h-[200px] flex-col items-center justify-center'}>
						<IconSpinner />
						<p className={'mt-6 text-sm text-neutral-500'}>{'We are looking for your tokens ...'}</p>
					</div>
				) : balancesToDisplay.length === 0 ? (
					<div className={'col-span-12 flex min-h-[200px] flex-col items-center justify-center'}>
						<svg
							className={'h-4 w-4 text-neutral-400'}
							xmlns={'http://www.w3.org/2000/svg'}
							viewBox={'0 0 512 512'}><path d={'M505 41c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0L396.5 81.5C358.1 50.6 309.2 32 256 32C132.3 32 32 132.3 32 256c0 53.2 18.6 102.1 49.5 140.5L7 471c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l74.5-74.5c38.4 31 87.3 49.5 140.5 49.5c123.7 0 224-100.3 224-224c0-53.2-18.6-102.1-49.5-140.5L505 41zM362.3 115.7L115.7 362.3C93.3 332.8 80 295.9 80 256c0-97.2 78.8-176 176-176c39.9 0 76.8 13.3 106.3 35.7zM149.7 396.3L396.3 149.7C418.7 179.2 432 216.1 432 256c0 97.2-78.8 176-176 176c-39.9 0-76.8-13.3-106.3-35.7z'} fill={'currentcolor'} />
						</svg>
						<p className={'mt-6 text-sm text-neutral-500'}>{'Oh no, you have nothing to dump!'}</p>
					</div>
				) : (
					<div className={'col-span-12 border-t border-neutral-200'}>
						<ListHead
							sortBy={sortBy}
							sortDirection={sortDirection}
							onSort={(newSortBy, newSortDirection): void => {
								performBatchedUpdates((): void => {
									set_sortBy(newSortBy);
									set_sortDirection(newSortDirection as 'asc' | 'desc');
								});
							}}
							items={[
								{label: 'Token', value: 'name', sortable: true},
								{label: 'Amount', value: 'balance', sortable: false, className: 'col-span-6 md:pl-5', datatype: 'text'},
								{label: `Output (${destination.symbol})`, value: '', sortable: false, className: 'col-span-6 md:pl-7', datatype: 'text'}
							]} />
						<div>
							{balancesToDisplay}
						</div>
					</div>
				)}

				<div className={'relative col-span-12 flex w-full max-w-4xl flex-row items-center justify-between rounded-b bg-neutral-900 p-4 text-neutral-0 md:px-6 md:py-4'}>
					<div className={'flex flex-col'}>
						<AddTokenPopover />
					</div>
					<div className={'flex flex-col'}>
						<Button
							className={'yearn--button !w-fit !px-6 !text-sm'}
							variant={'reverted'}
							isDisabled={!isActive || ((selected.length === 0)) || !hasQuoteForEverySelectedToken}
							onClick={onProceed}>
							{'Confirm'}
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
export default ViewSweepTable;

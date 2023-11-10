import React, {Fragment, useCallback, useState} from 'react';
import {useWallet} from 'contexts/useWallet';
import {isAddress} from 'ethers/lib/utils';
import {erc20ABI} from 'wagmi';
import {Dialog, Transition} from '@headlessui/react';
import {useAsync} from '@react-hookz/web';
import {multicall} from '@wagmi/core';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {IconCross} from '@yearn-finance/web-lib/icons/IconCross';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {decodeAsBigInt, decodeAsNumber, decodeAsString} from '@yearn-finance/web-lib/utils/decoder';
import {toBigInt, toNormalizedValue} from '@yearn-finance/web-lib/utils/format.bigNumber';
import AddressInput, {defaultInputAddressLike} from '@common/AddressInput';

import type {ReactElement} from 'react';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {TInputAddressLike} from '@common/AddressInput';

function AddTokenPopover(): ReactElement {
	const {refresh} = useWallet();
	const {address} = useWeb3();
	const {safeChainID} = useChainID();
	const [isOpen, set_isOpen] = useState(false);
	const [token, set_token] = useState<TInputAddressLike>(defaultInputAddressLike);

	const fetchToken = useCallback(
		async (
			_safeChainID: number,
			_query: TAddress
		): Promise<{name: string; symbol: string; decimals: number; balanceOf: bigint} | undefined> => {
			if (!isAddress(_query)) {
				return undefined;
			}
			const results = await multicall({
				contracts: [
					{address: _query, abi: erc20ABI, functionName: 'name'},
					{address: _query, abi: erc20ABI, functionName: 'symbol'},
					{address: _query, abi: erc20ABI, functionName: 'decimals'},
					{address: _query, abi: erc20ABI, functionName: 'balanceOf', args: [toAddress(address)]}
				],
				chainId: _safeChainID
			});
			const name = decodeAsString(results[0]);
			const symbol = decodeAsString(results[1]);
			const decimals = decodeAsNumber(results[2]);
			const balanceOf = decodeAsBigInt(results[3]);
			await refresh([{decimals, name, symbol, token: _query}]);
			return {name, symbol, decimals, balanceOf};
		},
		[address, refresh]
	);
	const [{result: tokenData}, fetchTokenData] = useAsync(fetchToken);

	return (
		<>
			<button
				onClick={(): void => set_isOpen(true)}
				className={
					'text-xs text-neutral-200/40 transition-colors before:mr-1 before:text-base before:content-["+"] hover:text-neutral-200'
				}>
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
											className={'absolute right-4 top-4'}>
											<IconCross
												className={
													'h-4 w-4 text-neutral-400 transition-colors hover:text-neutral-900'
												}
											/>
										</button>
										<div
											className={'col-span-12 flex flex-col p-4 text-neutral-900 md:p-6 md:pb-4'}>
											<div className={'w-full md:w-3/4'}>
												<b>{'The power to dump is in your hands.'}</b>
												<p className={'pt-2 text-sm text-neutral-500'}>
													{
														'Want to dump a token that’s not listed? Just enter it’s contract address and we’ll add it to the list so you can dump away.'
													}
												</p>
											</div>
											<div className={'flex w-full flex-col space-y-2'}>
												<AddressInput
													value={token}
													onChangeValue={(e): void => {
														set_token(e);
														fetchTokenData.execute(safeChainID, toAddress(e.address || ''));
													}}
												/>
												<div
													className={
														'group mb-0 flex w-full flex-col justify-center rounded-none border border-x-0 border-neutral-200 bg-neutral-100 md:mb-2 md:rounded-md md:border-x'
													}>
													<div
														className={
															'font-number space-y-2 border-t-0 p-4 text-xs md:text-sm'
														}>
														<span className={'flex flex-col justify-between md:flex-row'}>
															<b>{'Address'}</b>
															<p className={'font-number overflow-hidden text-ellipsis'}>
																{toAddress(token?.address || '')}
															</p>
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
															<p className={'font-number'}>
																{toNormalizedValue(
																	toBigInt(tokenData?.balanceOf),
																	tokenData?.decimals
																)}
															</p>
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

export default AddTokenPopover;

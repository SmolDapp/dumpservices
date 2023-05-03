import React, {useState} from 'react';
import ComboboxAddressInput from 'components/ComboboxAddressInput';
import {Step, useSweepooor} from 'contexts/useSweepooor';
import {isAddress} from 'ethers/lib/utils';
import cowswapTokenList from 'utils/tokenLists.json';
import axios from 'axios';
import {useMountEffect, useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {TTokenInfo, TTokenList} from 'contexts/useTokenList';
import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';

function	ViewTokenToReceive({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const	{currentStep, destination, set_destination} = useSweepooor();
	const	[tokenToReceive, set_tokenToReceive] = useState<string>(ETH_TOKEN_ADDRESS);
	const	[isValidDestination, set_isValidDestination] = useState<boolean | 'undetermined'>('undetermined');
	const	[possibleDestinations, set_possibleDestinations] = useState<TDict<TTokenInfo>>({});

	/* 🔵 - Yearn Finance **************************************************************************
	** On mount, fetch the token list from the tokenlistooor repo for the cowswap token list, which
	** will be used to populate the destination token combobox.
	** Only the tokens in that list will be displayed as possible destinations.
	**********************************************************************************************/
	useMountEffect((): void => {
		axios.all([axios.get('https://raw.githubusercontent.com/Migratooor/tokenLists/main/lists/1/yearn.json')]).then(axios.spread((yearnResponse): void => {
			const	cowswapTokenListResponse = cowswapTokenList as TTokenList;
			const	yearnTokenListResponse = yearnResponse.data as TTokenList;
			const	possibleDestinationsTokens: TDict<TTokenInfo> = {};
			possibleDestinationsTokens[ETH_TOKEN_ADDRESS] = {
				address: ETH_TOKEN_ADDRESS,
				chainId: 1,
				name: 'Ether',
				symbol: 'ETH',
				decimals: 18,
				logoURI: `https://raw.githubusercontent.com/yearn/yearn-assets/master/icons/multichain-tokens/1/${ETH_TOKEN_ADDRESS}/logo-128.png`
			};
			for (const eachToken of cowswapTokenListResponse.tokens) {
				if (eachToken.extra) {
					continue;
				}
				possibleDestinationsTokens[toAddress(eachToken.address)] = eachToken;
			}
			for (const eachToken of yearnTokenListResponse.tokens) {
				if (eachToken.symbol.startsWith('yv')) {
					possibleDestinationsTokens[toAddress(eachToken.address)] = eachToken;
				}
			}
			set_possibleDestinations(possibleDestinationsTokens);
		}));
	});

	/* 🔵 - Yearn Finance **************************************************************************
	** When the destination token changes, check if it is a valid destination token. The check is
	** trivial as we only check if the address is valid.
	**********************************************************************************************/
	useUpdateEffect((): void => {
		set_isValidDestination('undetermined');
		if (!isZeroAddress(toAddress(tokenToReceive))) {
			set_isValidDestination(true);
		}
	}, [tokenToReceive]);

	return (
		<section>
			<div className={'box-0 grid w-full grid-cols-12'}>
				<div className={'col-span-12 flex flex-col p-4 text-neutral-900 md:p-6'}>
					<div className={'w-full md:w-3/4'}>
						<b>{'Select token to receive'}</b>
						<p className={'text-sm text-neutral-500'}>
							{'Choose the token you’d like to receive in exchange for the tokens you’re about to dump. If it’s not listed, you can enter the token address manually.'}
						</p>
					</div>
					<form
						suppressHydrationWarning
						onSubmit={async (e): Promise<void> => e.preventDefault()}
						className={'mt-6 grid w-full grid-cols-12 flex-row items-center justify-between gap-4 md:w-3/4 md:gap-6'}>
						<div className={'grow-1 col-span-12 flex h-10 w-full items-center md:col-span-9'}>
							<ComboboxAddressInput
								possibleDestinations={possibleDestinations}
								onAddPossibleDestination={set_possibleDestinations}
								tokenToReceive={tokenToReceive}
								onChangeDestination={(newToken): void => {
									if ([Step.SELECTOR, Step.APPROVALS, Step.RECEIVER].includes(currentStep)) {
										performBatchedUpdates((): void => {
											set_tokenToReceive(newToken);
											set_destination({
												address: toAddress(newToken as string),
												chainId: 1,
												name: possibleDestinations[toAddress(newToken as string)]?.name || '',
												symbol: possibleDestinations[toAddress(newToken as string)]?.symbol || '',
												decimals: possibleDestinations[toAddress(newToken as string)]?.decimals || 0,
												logoURI: possibleDestinations[toAddress(newToken as string)]?.logoURI || ''
											});
										});
									} else {
										set_tokenToReceive(newToken);
									}
								}} />
						</div>
						<div className={'col-span-12 md:col-span-3'}>
							<Button
								className={'yearn--button !w-[160px] rounded-md !text-sm'}
								onClick={(): void => {
									if (isAddress(tokenToReceive)) {
										set_destination({
											address: toAddress(tokenToReceive),
											chainId: 1,
											name: possibleDestinations[tokenToReceive]?.name || '',
											symbol: possibleDestinations[tokenToReceive]?.symbol || '',
											decimals: possibleDestinations[tokenToReceive]?.decimals || 0,
											logoURI: possibleDestinations[tokenToReceive]?.logoURI || ''
										});
									}
									onProceed();
								}}
								isDisabled={!isValidDestination || (toAddress(tokenToReceive) === toAddress(destination.address) && destination.chainId !== 0)}>
								{'Next'}
							</Button>
						</div>
					</form>
				</div>
			</div>
		</section>
	);
}

export default ViewTokenToReceive;

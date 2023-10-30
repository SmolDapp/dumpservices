import React, {useCallback, useEffect, useState} from 'react';
import {Step, useSweepooor} from 'contexts/useSweepooor';
import {useTokenList} from 'contexts/useTokenList';
import {type TToken} from 'utils/types';
import {useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {IconSettings} from '@yearn-finance/web-lib/icons/IconSettings';
import {isZeroAddress, toAddress, zeroAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';
import ComboboxAddressInput from '@common/ComboboxAddressInput';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';

function ViewTokenToReceive({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const {currentStep, set_destination} = useSweepooor();
	const {safeChainID} = useChainID();
	const {tokenList} = useTokenList();
	const [tokenToSend, set_tokenToSend] = useState<TToken | null>(null);
	const [isValidTokenToReceive, set_isValidTokenToReceive] = useState<boolean | 'undetermined'>(true);
	const [possibleTokenToReceive, set_possibleTokenToReceive] = useState<TDict<TToken>>({});
	const {openTokenListModal} = useTokenList();

	/* 🔵 - Smoldapp *******************************************************************************
	 ** On mount, fetch the token list from the tokenlistooor repo for the cowswap token list, which
	 ** will be used to populate the tokenToDisperse token combobox.
	 ** Only the tokens in that list will be displayed as possible destinations.
	 **********************************************************************************************/
	useEffect((): void => {
		const possibleDestinationsTokens: TDict<TToken> = {};
		const {wrappedToken} = getNetwork(safeChainID).contracts;
		if (wrappedToken) {
			possibleDestinationsTokens[ETH_TOKEN_ADDRESS] = {
				address: ETH_TOKEN_ADDRESS,
				chainId: safeChainID,
				name: wrappedToken.coinName,
				symbol: wrappedToken.coinSymbol,
				decimals: wrappedToken.decimals,
				logoURI: `https://assets.smold.app/api/token/${safeChainID}/${ETH_TOKEN_ADDRESS}/logo-128.png`
			};
		}
		for (const eachToken of Object.values(tokenList)) {
			if (eachToken.address === toAddress(`0x0000000000000000000000000000000000001010`)) {
				continue; //ignore matic erc20
			}
			if (eachToken.chainId === safeChainID) {
				possibleDestinationsTokens[toAddress(eachToken.address)] = eachToken;
			}
		}
		set_possibleTokenToReceive(possibleDestinationsTokens);
	}, [tokenList, safeChainID]);

	/* 🔵 - Smoldapp *******************************************************************************
	 ** When the tokenToDisperse token changes, check if it is a valid tokenToDisperse token. The
	 ** check is trivial as we only check if the address is valid.
	 **********************************************************************************************/
	useUpdateEffect((): void => {
		set_isValidTokenToReceive('undetermined');
		if (!isZeroAddress(tokenToSend?.address)) {
			set_isValidTokenToReceive(true);
		}
	}, [tokenToSend]);

	/* 🔵 - Smoldapp *******************************************************************************
	 ** On selecting a new tokenToDisperse token, update the destination object with the new token
	 **********************************************************************************************/
	const onUpdateToken = useCallback(
		(newToken: TToken): void => {
			if ([Step.SELECTOR].includes(currentStep)) {
				set_tokenToSend(newToken);
				set_destination({
					address: newToken.address,
					chainId: safeChainID,
					name: newToken.name,
					symbol: newToken.symbol,
					decimals: newToken.decimals,
					logoURI: newToken.logoURI
				});
			} else {
				set_tokenToSend(newToken);
			}
		},
		[currentStep, safeChainID, set_destination]
	);

	/* 🔵 - Smoldapp *******************************************************************************
	 ** When the user clicks the "Next" button, check if the tokenToDisperse token is valid. If it is
	 ** then proceed to the next step.
	 **********************************************************************************************/
	const onProceedToNextStep = useCallback((): void => {
		if (tokenToSend) {
			set_destination({
				address: tokenToSend.address,
				chainId: safeChainID,
				name: tokenToSend.name,
				symbol: tokenToSend.symbol,
				decimals: tokenToSend.decimals,
				logoURI: tokenToSend.logoURI
			});
		}
		onProceed();
	}, [onProceed, safeChainID, set_destination, tokenToSend]);

	return (
		<section>
			<div className={'box-0 grid w-full grid-cols-12'}>
				<div className={'relative col-span-12 flex flex-col p-4 text-neutral-900 md:p-6'}>
					<div
						className={'absolute right-4 top-4 cursor-pointer'}
						onClick={openTokenListModal}>
						<IconSettings className={'transition-color h-4 w-4 text-neutral-400 hover:text-neutral-900'} />
					</div>
					<div className={'w-full md:w-3/4'}>
						<b>{'Select token to receive'}</b>
						<p className={'text-sm text-neutral-500'}>
							{
								'Choose the token you’d like to receive in exchange for the tokens you’re about to dump. If it’s not listed, you can enter the token address manually.'
							}
						</p>
					</div>
					<form
						suppressHydrationWarning
						onSubmit={async (e): Promise<void> => e.preventDefault()}
						className={
							'mt-6 grid w-full grid-cols-12 flex-row items-center justify-between gap-4 md:w-3/4 md:gap-6'
						}>
						<div className={'grow-1 col-span-12 flex h-10 w-full items-center md:col-span-9'}>
							<ComboboxAddressInput
								shouldSort={false}
								value={tokenToSend}
								possibleValues={possibleTokenToReceive}
								onAddValue={set_possibleTokenToReceive}
								onChangeValue={(newToken): void => onUpdateToken(newToken)}
							/>
						</div>
						<div className={'col-span-12 md:col-span-3'}>
							<Button
								variant={'filled'}
								className={'yearn--button !w-[160px] rounded-md !text-sm'}
								onClick={onProceedToNextStep}
								isDisabled={
									!isValidTokenToReceive ||
									tokenToSend?.chainId === 0 ||
									tokenToSend?.address === zeroAddress
								}>
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

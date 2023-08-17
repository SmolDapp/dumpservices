import React, {useCallback, useState} from 'react';
import ComboboxAddressInput from 'components/ComboboxAddressInput';
import {Step, useSweepooor} from 'contexts/useSweepooor';
import {type TTokenInfo, useTokenList} from 'contexts/useTokenList';
import {useDeepCompareEffect, useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {isZeroAddress, toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {getNetwork} from '@yearn-finance/web-lib/utils/wagmi/utils';

import type {ReactElement} from 'react';
import type {TDict} from '@yearn-finance/web-lib/types';

function ViewTokenToReceive({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const {currentStep, destination, set_destination} = useSweepooor();
	const {safeChainID} = useChainID();
	const {tokenList} = useTokenList();
	const [tokenToSend, set_tokenToSend] = useState<string>(ZERO_ADDRESS);
	const [isValidTokenToReceive, set_isValidTokenToReceive] = useState<boolean | 'undetermined'>(true);
	const [possibleTokenToReceive, set_possibleTokenToReceive] = useState<TDict<TTokenInfo>>({});


	/* 🔵 - Smoldapp *******************************************************************************
	** On mount, fetch the token list from the tokenlistooor repo for the cowswap token list, which
	** will be used to populate the tokenToDisperse token combobox.
	** Only the tokens in that list will be displayed as possible destinations.
	**********************************************************************************************/
	useDeepCompareEffect((): void => {
		const possibleDestinationsTokens: TDict<TTokenInfo> = {};
		const {wrappedToken} = getNetwork(safeChainID).contracts;
		if (wrappedToken && safeChainID === 1) {
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
		if (!isZeroAddress(toAddress(tokenToSend))) {
			set_isValidTokenToReceive(true);
		}
	}, [tokenToSend]);

	/* 🔵 - Smoldapp *******************************************************************************
	** On selecting a new tokenToDisperse token, update the destination object with the new token
	**********************************************************************************************/
	const onUpdateToken = useCallback((newToken: string): void => {
		if ([Step.SELECTOR].includes(currentStep)) {
			performBatchedUpdates((): void => {
				set_tokenToSend(newToken);
				set_destination({
					address: toAddress(newToken),
					chainId: safeChainID,
					name: possibleTokenToReceive[toAddress(newToken)]?.name || '',
					symbol: possibleTokenToReceive[toAddress(newToken)]?.symbol || '',
					decimals: possibleTokenToReceive[toAddress(newToken)]?.decimals || 0,
					logoURI: possibleTokenToReceive[toAddress(newToken)]?.logoURI || ''
				});
			});
		} else {
			set_tokenToSend(newToken);
		}
	}, [currentStep, possibleTokenToReceive, safeChainID, set_destination]);

	/* 🔵 - Smoldapp *******************************************************************************
	** When the user clicks the "Next" button, check if the tokenToDisperse token is valid. If it is
	** then proceed to the next step.
	**********************************************************************************************/
	const onProceedToNextStep = useCallback((): void => {
		if (toAddress(tokenToSend) !== ZERO_ADDRESS) {
			set_destination({
				address: toAddress(tokenToSend),
				chainId: safeChainID,
				name: possibleTokenToReceive[tokenToSend]?.name || '',
				symbol: possibleTokenToReceive[tokenToSend]?.symbol || '',
				decimals: possibleTokenToReceive[tokenToSend]?.decimals || 0,
				logoURI: possibleTokenToReceive[tokenToSend]?.logoURI || ''
			});
		}
		onProceed();
	}, [onProceed, possibleTokenToReceive, safeChainID, set_destination, tokenToSend]);

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
								shouldSort={false}
								value={tokenToSend}
								possibleValues={possibleTokenToReceive}
								onAddValue={set_possibleTokenToReceive}
								onChangeValue={(newToken): void => onUpdateToken(newToken as string)} />
						</div>
						<div className={'col-span-12 md:col-span-3'}>
							<Button
								variant={'filled'}
								className={'yearn--button !w-[160px] rounded-md !text-sm'}
								onClick={onProceedToNextStep}
								isDisabled={!isValidTokenToReceive || destination.chainId === 0 || tokenToSend === ZERO_ADDRESS}>
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

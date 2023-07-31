import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {scrollToTargetAdjusted} from 'utils/animations';
import {useLocalStorageValue, useMountEffect, useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {Dispatch, SetStateAction} from 'react';
import type {TOrderQuoteResponse} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import type {UseStorageValueResult} from '@react-hookz/web/cjs/useStorageValue';
import type {TTokenInfo} from './useTokenList';

export enum	Step {
	WALLET = 'wallet',
	DESTINATION = 'destination',
	RECEIVER = 'receiver',
	SELECTOR = 'selector',
	APPROVALS = 'approval'
}

export type TSelected = {
	selected: TAddress[],
	amounts: TDict<TNormalizedBN>,
	quotes: TDict<TOrderQuoteResponse>,
	destination: TTokenInfo,
	currentStep: Step,
	receiver: TAddress,
	set_selected: Dispatch<SetStateAction<TAddress[]>>,
	set_amounts: Dispatch<SetStateAction<TDict<TNormalizedBN>>>,
	set_quotes: Dispatch<SetStateAction<TDict<TOrderQuoteResponse>>>,
	set_currentStep: Dispatch<SetStateAction<Step>>,
	set_destination: Dispatch<SetStateAction<TTokenInfo>>,
	set_receiver: Dispatch<SetStateAction<TAddress>>,
	slippage: UseStorageValueResult<number, number>
}

const defaultProps: TSelected = {
	selected: [],
	amounts: {},
	quotes: {},
	destination: {
		chainId: 1,
		address: ETH_TOKEN_ADDRESS,
		name: 'Ether',
		symbol: 'ETH',
		decimals: 18,
		logoURI: `https://raw.githubusercontent.com/yearn/yearn-assets/master/icons/multichain-tokens/1/${ETH_TOKEN_ADDRESS}/logo-128.png`
	},
	currentStep: Step.WALLET,
	receiver: toAddress(),
	set_selected: (): void => undefined,
	set_amounts: (): void => undefined,
	set_quotes: (): void => undefined,
	set_currentStep: (): void => undefined,
	set_destination: (): void => undefined,
	set_receiver: (): void => undefined,
	slippage: {
		value: 0.1,
		set: (): void => undefined,
		remove: (): void => undefined,
		fetch: (): void => undefined
	}
};

const SweepooorContext = createContext<TSelected>(defaultProps);
export const SweepooorContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const {address, isActive, walletType} = useWeb3();
	const [selected, set_selected] = useState<TAddress[]>(defaultProps.selected);
	const [destination, set_destination] = useState<TTokenInfo>(defaultProps.destination);
	const [receiver, set_receiver] = useState<TAddress>(toAddress(address));
	const [quotes, set_quotes] = useState<TDict<TOrderQuoteResponse>>(defaultProps.quotes);
	const [amounts, set_amounts] = useState<TDict<TNormalizedBN>>(defaultProps.amounts);
	const [currentStep, set_currentStep] = useState<Step>(Step.WALLET);
	const slippage = useLocalStorageValue<number>('dump-services/slippage', {defaultValue: 0.1, initializeWithValue: true});

	/**********************************************************************************************
	** If the user is not active, reset the state to the default values.
	**********************************************************************************************/
	useEffect((): void => {
		if (!isActive) {
			performBatchedUpdates((): void => {
				set_selected(defaultProps.selected);
				set_amounts(defaultProps.amounts);
				set_destination(defaultProps.destination);
			});
		} else if (isActive) {
			set_receiver((d): TAddress => d === defaultProps.receiver ? toAddress(address) : d);
		}
	}, [isActive, address]);

	/**********************************************************************************************
	** If the address changes, we need to update the receiver to the connected wallet address.
	**********************************************************************************************/
	useUpdateEffect((): void => {
		performBatchedUpdates((): void => {
			set_selected(defaultProps.selected);
			set_amounts(defaultProps.amounts);
			set_destination(defaultProps.destination);
			set_receiver(toAddress(address));
		});
	}, [address]);

	/**********************************************************************************************
	** We need to set the receiver to the connected wallet address if the receiver is not set.
	**********************************************************************************************/
	useUpdateEffect((): void => {
		if (receiver === toAddress()) {
			set_receiver(toAddress(address));
		}
	}, [address, receiver]);

	/**********************************************************************************************
	** This effect is used to directly jump the UI to the DESTINATION section if the wallet is
	** already connected or if the wallet is a special wallet type (e.g. EMBED_LEDGER).
	** If the wallet is not connected, jump to the WALLET section to connect.
	**********************************************************************************************/
	useEffect((): void => {
		const isEmbedWallet = ['EMBED_LEDGER', 'EMBED_GNOSIS_SAFE'].includes(walletType);
		if ((isActive && address) || isEmbedWallet) {
			set_currentStep(Step.DESTINATION);
		} else if (!isActive || !address) {
			set_currentStep(Step.WALLET);
		}
	}, [address, isActive, walletType]);

	/**********************************************************************************************
	** This effect is used to handle some UI transitions and sections jumps. Once the current step
	** changes, we need to scroll to the correct section.
	** This effect is triggered only on mount to set the initial scroll position.
	**********************************************************************************************/
	useMountEffect((): void => {
		setTimeout((): void => {
			const isEmbedWallet = ['EMBED_LEDGER', 'EMBED_GNOSIS_SAFE'].includes(walletType);
			if (currentStep === Step.WALLET && !isEmbedWallet) {
				document?.getElementById('wallet')?.scrollIntoView({behavior: 'smooth', block: 'start'});
			} else if (currentStep === Step.DESTINATION || isEmbedWallet) {
				document?.getElementById('tokenToReceive')?.scrollIntoView({behavior: 'smooth', block: 'start'});
			} else if (currentStep === Step.RECEIVER) {
				document?.getElementById('receiver')?.scrollIntoView({behavior: 'smooth', block: 'start'});
			} else if (currentStep === Step.SELECTOR) {
				document?.getElementById('selector')?.scrollIntoView({behavior: 'smooth', block: 'start'});
			} else if (currentStep === Step.APPROVALS) {
				document?.getElementById('approvals')?.scrollIntoView({behavior: 'smooth', block: 'start'});
			}
		}, 0);
	});

	/**********************************************************************************************
	** This effect is used to handle some UI transitions and sections jumps. Once the current step
	** changes, we need to scroll to the correct section.
	** This effect is ignored on mount but will be triggered on every update to set the correct
	** scroll position.
	**********************************************************************************************/
	useUpdateEffect((): void => {
		setTimeout((): void => {
			let currentStepContainer;
			const isEmbedWallet = ['EMBED_LEDGER', 'EMBED_GNOSIS_SAFE'].includes(walletType);
			const scalooor = document?.getElementById('scalooor');
			const headerHeight = 96;

			if (currentStep === Step.WALLET && !isEmbedWallet) {
				currentStepContainer = document?.getElementById('wallet');
			} else if (currentStep === Step.DESTINATION || isEmbedWallet) {
				currentStepContainer = document?.getElementById('tokenToReceive');
			} else if (currentStep === Step.RECEIVER) {
				currentStepContainer = document?.getElementById('receiver');
			} else if (currentStep === Step.SELECTOR) {
				currentStepContainer = document?.getElementById('selector');
			} else if (currentStep === Step.APPROVALS) {
				currentStepContainer = document?.getElementById('approvals');
			}
			const currentElementHeight = currentStepContainer?.offsetHeight;
			if (scalooor?.style) {
				scalooor.style.height = `calc(100vh - ${currentElementHeight}px - ${headerHeight}px + 36px)`;
			}
			if (currentStepContainer) {
				scrollToTargetAdjusted(currentStepContainer);
			}
		}, 0);
	}, [currentStep, walletType]);

	const contextValue = useMemo((): TSelected => ({
		selected,
		set_selected,
		amounts,
		set_amounts,
		quotes,
		set_quotes,
		currentStep,
		set_currentStep,
		destination,
		set_destination,
		receiver,
		set_receiver,
		slippage
	}), [selected, amounts, quotes, currentStep, destination, receiver, slippage]);

	return (
		<SweepooorContext.Provider value={contextValue}>
			<div id={'SweepTable'} className={'mx-auto w-full overflow-hidden'}>
				{children}
				<div id={'scalooor'} />
			</div>
		</SweepooorContext.Provider>
	);
};

export const useSweepooor = (): TSelected => useContext(SweepooorContext);

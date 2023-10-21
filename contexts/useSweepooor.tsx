import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {scrollToTargetAdjusted} from 'utils/animations';
import {deserialize, serialize} from 'wagmi';
import {useLocalStorageValue, useMountEffect, useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {Dispatch, SetStateAction} from 'react';
import type {Maybe, TRequest, TToken} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';
import type {UseStorageValueResult} from '@react-hookz/web/cjs/useStorageValue';

export enum Step {
	WALLET = 'wallet',
	DESTINATION = 'destination',
	RECEIVER = 'receiver',
	SELECTOR = 'selector',
	APPROVALS = 'approval'
}

export type TSelected = {
	quotes: Maybe<TRequest>;
	destination: TToken;
	currentStep: Step;
	receiver: TAddress;
	set_quotes: Dispatch<SetStateAction<Maybe<TRequest>>>;
	set_currentStep: Dispatch<SetStateAction<Step>>;
	set_destination: Dispatch<SetStateAction<TToken>>;
	set_receiver: Dispatch<SetStateAction<TAddress>>;
	slippage: UseStorageValueResult<bigint, bigint>;
};

const defaultProps: TSelected = {
	quotes: undefined,
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
	set_quotes: (): void => undefined,
	set_currentStep: (): void => undefined,
	set_destination: (): void => undefined,
	set_receiver: (): void => undefined,
	slippage: {
		value: 10n,
		set: (): void => undefined,
		remove: (): void => undefined,
		fetch: (): void => undefined
	}
};

const SweepooorContext = createContext<TSelected>(defaultProps);
export const SweepooorContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const {address, isActive, isWalletLedger, isWalletSafe} = useWeb3();
	const [destination, set_destination] = useState<TToken>(defaultProps.destination);
	const [receiver, set_receiver] = useState<TAddress>(toAddress(address));
	const [quotes, set_quotes] = useState<Maybe<TRequest>>(defaultProps.quotes);
	const [currentStep, set_currentStep] = useState<Step>(Step.WALLET);
	const slippage = useLocalStorageValue<bigint>('dump-services/slippage-0.0.2', {
		defaultValue: 10n,
		initializeWithValue: true,
		stringify: serialize,
		parse: (v, fallback): bigint => (v ? deserialize(v) : fallback)
	});

	/**********************************************************************************************
	 ** If the user is not active, reset the state to the default values.
	 **********************************************************************************************/
	useEffect((): void => {
		if (!isActive) {
			set_destination(defaultProps.destination);
		} else if (isActive) {
			set_receiver((d): TAddress => (d === defaultProps.receiver ? toAddress(address) : d));
		}
	}, [isActive, address]);

	/**********************************************************************************************
	 ** If the address changes, we need to update the receiver to the connected wallet address.
	 **********************************************************************************************/
	useUpdateEffect((): void => {
		set_destination(defaultProps.destination);
		set_receiver(toAddress(address));
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
		const isEmbedWallet = isWalletLedger || isWalletSafe;
		if ((isActive && address) || isEmbedWallet) {
			set_currentStep(Step.DESTINATION);
		} else if (!isActive || !address) {
			set_currentStep(Step.WALLET);
		}
	}, [address, isActive, isWalletLedger, isWalletSafe]);

	/**********************************************************************************************
	 ** This effect is used to handle some UI transitions and sections jumps. Once the current step
	 ** changes, we need to scroll to the correct section.
	 ** This effect is triggered only on mount to set the initial scroll position.
	 **********************************************************************************************/
	useMountEffect((): void => {
		// setTimeout((): void => {
		// 	const isEmbedWallet = isWalletLedger || isWalletSafe;
		// 	if (currentStep === Step.WALLET && !isEmbedWallet) {
		// 		document?.getElementById('wallet')?.scrollIntoView({behavior: 'smooth', block: 'start'});
		// 	} else if (currentStep === Step.DESTINATION || isEmbedWallet) {
		// 		document?.getElementById('tokenToReceive')?.scrollIntoView({behavior: 'smooth', block: 'start'});
		// 	} else if (currentStep === Step.RECEIVER) {
		// 		document?.getElementById('receiver')?.scrollIntoView({behavior: 'smooth', block: 'start'});
		// 	} else if (currentStep === Step.SELECTOR) {
		// 		document?.getElementById('selector')?.scrollIntoView({behavior: 'smooth', block: 'start'});
		// 	} else if (currentStep === Step.APPROVALS) {
		// 		document?.getElementById('approvals')?.scrollIntoView({behavior: 'smooth', block: 'start'});
		// 	}
		// }, 0);
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
			const isEmbedWallet = isWalletLedger || isWalletSafe;
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
	}, [currentStep, isWalletLedger, isWalletSafe]);

	const contextValue = useMemo(
		(): TSelected => ({
			quotes,
			set_quotes,
			currentStep,
			set_currentStep,
			destination,
			set_destination,
			receiver,
			set_receiver,
			slippage
		}),
		[quotes, currentStep, destination, receiver, slippage]
	);

	return (
		<SweepooorContext.Provider value={contextValue}>
			<div
				id={'SweepTable'}
				className={'mx-auto w-full overflow-hidden'}>
				{children}
				<div id={'scalooor'} />
			</div>
		</SweepooorContext.Provider>
	);
};

export const useSweepooor = (): TSelected => useContext(SweepooorContext);

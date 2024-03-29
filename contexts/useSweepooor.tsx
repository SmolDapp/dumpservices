import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {scrollToTargetAdjusted} from 'utils/animations';
import {deserialize, serialize} from 'wagmi';
import {useLocalStorageValue, useUpdateEffect} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ZERO_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TRequest, TToken} from 'utils/types';
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
	quotes: TRequest;
	destination: TToken;
	currentStep: Step;
	receiver: TAddress;
	set_quotes: Dispatch<SetStateAction<TRequest>>;
	set_currentStep: Dispatch<SetStateAction<Step>>;
	set_destination: Dispatch<SetStateAction<TToken>>;
	set_receiver: Dispatch<SetStateAction<TAddress>>;
	slippage: UseStorageValueResult<bigint, bigint>;
	onReset: VoidFunction;
};

const defaultProps: TSelected = {
	quotes: {} as TRequest,
	destination: {
		chainId: 1,
		address: ZERO_ADDRESS,
		name: 'No token selected',
		symbol: 'N/A',
		decimals: 18,
		logoURI: ``
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
	},
	onReset: (): void => undefined
};

const SweepooorContext = createContext<TSelected>(defaultProps);
export const SweepooorContextApp = ({children}: {children: ReactElement}): ReactElement => {
	const {address, isActive, isWalletLedger, isWalletSafe, chainID} = useWeb3();
	const [destination, set_destination] = useState<TToken>(defaultProps.destination);
	const [receiver, set_receiver] = useState<TAddress>(toAddress(address));
	const [quotes, set_quotes] = useState(defaultProps.quotes);
	const [currentStep, set_currentStep] = useState<Step>(Step.WALLET);
	const slippage = useLocalStorageValue<bigint>('dump-services/slippage-0.0.2', {
		defaultValue: 10n,
		initializeWithValue: true,
		stringify: serialize,
		parse: (v, fallback): bigint => (v ? deserialize(v) : fallback)
	});

	const onReset = useCallback((): void => {
		set_quotes(defaultProps.quotes);
		set_destination(defaultProps.destination);
		set_receiver(defaultProps.receiver);
		set_currentStep(Step.DESTINATION);
	}, []);

	useEffect((): void => {
		if (chainID === 137 && isWalletSafe) {
			set_quotes(defaultProps.quotes);
			set_destination(defaultProps.destination);
			set_receiver(defaultProps.receiver);
			set_currentStep(Step.WALLET);
		}
	}, [isWalletSafe, chainID]);

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
		if (isWalletSafe && chainID === 137) {
			set_currentStep(Step.WALLET);
		} else if ((isActive && address) || isEmbedWallet) {
			set_currentStep(Step.DESTINATION);
		} else if (!isActive || !address) {
			set_currentStep(Step.WALLET);
		}
	}, [address, isActive, isWalletLedger, isWalletSafe, chainID]);

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

			if (isWalletSafe && chainID === 137) {
				currentStepContainer = document?.getElementById('wallet');
			} else if (currentStep === Step.WALLET && !isEmbedWallet) {
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
	}, [currentStep, isWalletLedger, isWalletSafe, chainID]);

	useUpdateEffect((): void => {
		onReset();
	}, [chainID]);

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
			slippage,
			onReset
		}),
		[quotes, currentStep, destination, receiver, slippage, onReset]
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

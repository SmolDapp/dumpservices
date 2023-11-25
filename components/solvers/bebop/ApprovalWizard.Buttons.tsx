import React, {useCallback, useMemo, useRef, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedBebopQuote, hasQuote} from 'hooks/assertSolver';
import {getSellAmount} from 'hooks/handleQuote';
import {useAsyncTrigger} from 'hooks/useAsyncEffect';
import {getSpender} from 'hooks/useSolver';
import {approveERC20, isApprovedERC20} from 'utils/actions';
import {TPossibleStatus, TStatus} from 'utils/types';
import {serialize} from 'wagmi';
import axios from 'axios';
import {IconSpinner} from '@icons/IconSpinner';
import {fetchTransaction, signTypedData} from '@wagmi/core';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';

import type {TPostOrder} from 'pages/api/jamProxyPost';
import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TBebopJamOrderStatusAPIResp, TBebopRequest, TRequest} from 'utils/types';
import type {Hex} from 'viem';
import type {TDict} from '@yearn-finance/web-lib/types';

function BebopApproveButton({
	areAllApproved,
	onUpdateApprovalStep
}: {
	areAllApproved: boolean;
	onUpdateApprovalStep: Dispatch<SetStateAction<TDict<TStatus>>>;
}): ReactElement {
	const {provider} = useWeb3();
	const {safeChainID} = useChainID();
	const {quotes} = useSweepooor();
	const [isApproving, set_isApproving] = useState(false);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** Every time the selected tokens change (either a new token is added or the amount is changed),
	 ** we will check if the allowance is enough for the amount to be swept.
	 **********************************************************************************************/
	useAsyncTrigger(async (): Promise<void> => {
		const currentQuote = getTypedBebopQuote(quotes);
		for (const tokenAddressString of Object.keys(currentQuote.sellTokens)) {
			const tokenAddress = toAddress(tokenAddressString);
			try {
				const isApproved = await isApprovedERC20({
					connector: provider,
					chainID: safeChainID,
					contractAddress: tokenAddress,
					spenderAddress: getSpender({chainID: safeChainID}),
					amount: getSellAmount(quotes, tokenAddress).raw
				});
				onUpdateApprovalStep(prev => ({
					...prev,
					[tokenAddress]: isApproved ? TStatus.VALID : TStatus.UNDETERMINED
				}));
			} catch (error) {
				console.error(error);
			}
		}
	}, [quotes, provider, safeChainID, onUpdateApprovalStep]);

	/* 🔵 - Yearn Finance **************************************************************************
	 ** onApproveERC20 will loop through all the selected tokens and approve them if needed.
	 ** It will also update the approveStatus state to keep track of the approvals.
	 ** If the token is already approved, state will be updated to true but approval will not be
	 ** performed.
	 **********************************************************************************************/
	const onApproveERC20 = useCallback(async (): Promise<void> => {
		if (!quotes) {
			return;
		}
		onUpdateApprovalStep({});
		set_isApproving(true);

		const currentQuote = getTypedBebopQuote(quotes);
		for (const tokenAddressString of Object.keys(currentQuote.sellTokens)) {
			const tokenAddress = toAddress(tokenAddressString);
			try {
				const isApproved = await isApprovedERC20({
					connector: provider,
					chainID: safeChainID,
					contractAddress: tokenAddress,
					spenderAddress: getSpender({chainID: safeChainID}),
					amount: getSellAmount(quotes, tokenAddress).raw
				});

				if (!isApproved) {
					onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.PENDING}));
					const result = await approveERC20({
						connector: provider,
						chainID: safeChainID,
						contractAddress: tokenAddress,
						spenderAddress: getSpender({chainID: safeChainID}),
						amount: getSellAmount(quotes, tokenAddress).raw
					});
					if (result.isSuccessful) {
						onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.VALID}));
					} else {
						onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.INVALID}));
					}
				} else {
					onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.VALID}));
				}
			} catch (error) {
				console.error(error);
				onUpdateApprovalStep(prev => ({...prev, [tokenAddress]: TStatus.UNDETERMINED}));
			}
		}
		set_isApproving(false);
	}, [onUpdateApprovalStep, provider, quotes, safeChainID]);

	return (
		<Button
			id={'TRIGGER_SWEEPOOOR'}
			className={'yearn--button !w-fit !px-6 !text-sm'}
			isBusy={isApproving}
			isDisabled={
				Object.values(quotes.quote.sellToken || {}).length === 0 ||
				quotes.quote.orderStatus === TPossibleStatus.BEBOP_CONFIRMED ||
				areAllApproved
			}
			onClick={onApproveERC20}>
			{'Approve'}
		</Button>
	);
}

function BebopSignButton(props: {
	currentQuote: TRequest & TBebopRequest;
	onUpdateSignStep: (isSuccess: boolean, isSigning: boolean, hasError: boolean, signature: Hex) => void;
}): ReactElement {
	const onSignOrders = useCallback(async (): Promise<void> => {
		try {
			props.onUpdateSignStep(false, true, false, '0x');
			const signature = await signTypedData({
				primaryType: 'JamOrder',
				domain: {
					name: 'JamSettlement',
					version: '1',
					chainId: props.currentQuote.quote.chainId,
					verifyingContract: toAddress(process.env.BEBOP_SETTLEMENT_ADDRESS)
				},
				types: {
					JamOrder: [
						{name: 'taker', type: 'address'},
						{name: 'receiver', type: 'address'},
						{name: 'expiry', type: 'uint256'},
						{name: 'nonce', type: 'uint256'},
						{name: 'executor', type: 'address'},
						{name: 'minFillPercent', type: 'uint16'},
						{name: 'hooksHash', type: 'bytes32'},
						{name: 'sellTokens', type: 'address[]'},
						{name: 'buyTokens', type: 'address[]'},
						{name: 'sellAmounts', type: 'uint256[]'},
						{name: 'buyAmounts', type: 'uint256[]'},
						{name: 'sellNFTIds', type: 'uint256[]'},
						{name: 'buyNFTIds', type: 'uint256[]'},
						{name: 'sellTokenTransfers', type: 'bytes'},
						{name: 'buyTokenTransfers', type: 'bytes'}
					]
				},
				message: props.currentQuote.quote.toSign
			});
			props.onUpdateSignStep(true, false, false, signature);
			setTimeout(() => {
				document.getElementById('TRIGGER_DUMP')?.click();
			}, 100);
		} catch (error) {
			console.error(error);
			props.onUpdateSignStep(false, false, true, '0x');
		}
	}, [props]);

	return (
		<Button
			className={'yearn--button !w-fit !px-6 !text-sm'}
			isBusy={props.currentQuote.quote.isSigning}
			isDisabled={!props.currentQuote.quote || props.currentQuote.quote.isSigned}
			onClick={onSignOrders}>
			<p>{'Sign'}</p>
		</Button>
	);
}

function BebopExecuteButton(props: {
	currentQuote: TRequest & TBebopRequest;
	isSigned: boolean;
	onUpdateExecuteStep: (isSuccess: boolean, isExecuting: boolean, hasError: boolean, txHash: Hex) => void;
}): ReactElement {
	const executeButtonRef = useRef<HTMLButtonElement>(null);
	const checkOrderStatus = useCallback(async (quoteID: string): Promise<{isSuccess: boolean; hash: Hex}> => {
		for (let i = 0; i < 1000; i++) {
			try {
				const {data} = (await axios.get(
					`${process.env.API_ENDPOINT}/api/jamProxyOrderStatus?quote_id=${quoteID}`
				)) as {data: TBebopJamOrderStatusAPIResp};
				if (data?.txHash && data.txHash !== '0x') {
					const transaction = await fetchTransaction({hash: data.txHash});
					if (transaction.blockHash) {
						return {isSuccess: true, hash: data.txHash};
					}
				}
			} catch (error) {
				//
			}
			// Sleep for 3 seconds before checking the status again
			await new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, 3000));
		}
		return {isSuccess: false, hash: '0x'};
	}, []);

	const onSendOrders = useCallback(async (): Promise<void> => {
		try {
			props.onUpdateExecuteStep(false, true, false, '0x');
			const {data: response} = (await axios.post(`${process.env.API_ENDPOINT}/api/jamProxyPost`, {
				signature: props.currentQuote.quote.signature,
				quote_id: props.currentQuote.quote.id
			})) as {
				data: TPostOrder & {
					error?: {
						errorCode: number;
						message: string;
					};
				};
			};
			if (response.error) {
				console.error(response.error);
				toast({type: 'error', content: response.error.message});
				props.onUpdateExecuteStep(false, false, true, '0x');
				return;
			}
			const {isSuccess, hash} = await checkOrderStatus(props.currentQuote.quote.id);
			if (!isSuccess) {
				console.error(`Order failed`);
				props.onUpdateExecuteStep(false, false, true, '0x');
				return;
			}
			props.onUpdateExecuteStep(true, false, false, hash);
		} catch (error) {
			console.error(error);
			props.onUpdateExecuteStep(false, false, true, '0x');
		}
	}, [checkOrderStatus, props]);

	return (
		<Button
			ref={executeButtonRef}
			id={'TRIGGER_DUMP'}
			className={'yearn--button !w-fit !px-6 !text-sm'}
			isBusy={props.currentQuote.quote.isExecuting}
			isDisabled={
				!props.currentQuote.quote || !props.currentQuote.quote.isSigned || props.currentQuote.quote.isExecuted
			}
			onClick={onSendOrders}>
			{'Execute'}
		</Button>
	);
}

function BebopButtons({
	onRefreshQuote,
	isRefreshingQuote,
	approvals,
	onUpdateApprovalStep,
	onUpdateSignStep,
	onUpdateExecuteStep
}: {
	onRefreshQuote: () => Promise<void>;
	isRefreshingQuote: boolean;
	approvals: TDict<TStatus>;
	onUpdateApprovalStep: Dispatch<SetStateAction<TDict<TStatus>>>;
	onUpdateSignStep: (isSuccess: boolean, isSigning: boolean, hasError: boolean, signature: Hex) => void;
	onUpdateExecuteStep: (isSuccess: boolean, isExecuting: boolean, hasError: boolean, txHash: Hex) => void;
}): ReactElement {
	const {quotes} = useSweepooor();

	/* 🔵 - Yearn Finance **************************************************************************
	 ** areAllApproved and areAllSigned are used to determine if all the selected tokens have been
	 ** approved and signed.
	 ** If so, the onSendOrders function will be called.
	 **********************************************************************************************/
	const areAllApproved = useMemo((): boolean => {
		const currentQuote = getTypedBebopQuote(quotes);
		if (Object.keys(currentQuote.sellTokens).length === 0) {
			return false;
		}
		const isOk = true;
		for (const token of Object.keys(currentQuote.sellTokens || {})) {
			if (toAddress(token) === ETH_TOKEN_ADDRESS) {
				continue;
			}
			if (
				!approvals[toAddress(token)] ||
				approvals[toAddress(token)] === TStatus.UNDETERMINED ||
				approvals[toAddress(token)] === TStatus.INVALID ||
				approvals[toAddress(token)] === TStatus.PENDING
			) {
				return false;
			}
		}
		return isOk;
	}, [approvals, serialize(quotes)]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!hasQuote(quotes, '')) {
		return <></>;
	}

	const currentQuote = getTypedBebopQuote(quotes);
	function renderCurrentButton(): ReactElement {
		if (!areAllApproved) {
			return (
				<BebopApproveButton
					areAllApproved={areAllApproved}
					onUpdateApprovalStep={onUpdateApprovalStep}
				/>
			);
		}
		if (!currentQuote.quote.isSigned) {
			return (
				<BebopSignButton
					currentQuote={currentQuote}
					onUpdateSignStep={onUpdateSignStep}
				/>
			);
		}
		if (!currentQuote.quote.isExecuted) {
			return (
				<BebopExecuteButton
					currentQuote={currentQuote}
					isSigned={currentQuote.quote.isSigned}
					onUpdateExecuteStep={onUpdateExecuteStep}
				/>
			);
		}
		return (
			<Button
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isDisabled>
				{'Executed!'}
			</Button>
		);
	}

	return (
		<div className={'flex w-full flex-row items-center justify-between space-x-4'}>
			<button
				id={'TRIGGER_ALL_REFRESH'}
				onClick={onRefreshQuote}
				className={'relative cursor-pointer text-xs text-neutral-400 hover:text-neutral-900'}>
				<p className={`transition-opacity ${isRefreshingQuote ? 'opacity-0' : 'opacity-100'}`}>
					{'Refresh all quotes'}
				</p>
				<span
					className={`absolute inset-0 flex w-full items-center justify-center transition-opacity ${
						isRefreshingQuote ? 'opacity-100' : 'opacity-0'
					}`}>
					<IconSpinner />
				</span>
			</button>
			<div>{renderCurrentButton()}</div>
		</div>
	);
}

export {BebopButtons};

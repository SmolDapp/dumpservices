import React, {useCallback, useMemo, useState} from 'react';
import ApprovalWizardItem from 'components/app/sweepooor/ApprovalWizardItem';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {useSolverCowswap} from 'hooks/useSolverCowswap';
import {approveERC20, isApprovedERC20} from 'utils/actions/approveERC20';
import {getApproveTransaction, getSetPreSignatureTransaction} from 'utils/gnosis.tools';
import {useSafeAppsSDK} from '@gnosis.pm/safe-apps-react-sdk';
import {useUpdateEffect} from '@react-hookz/web';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {yToast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {SOLVER_COW_VAULT_RELAYER_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';
import {defaultTxStatus, Transaction} from '@yearn-finance/web-lib/utils/web3/transaction';

import type {Dispatch, ReactElement, SetStateAction} from 'react';
import type {TOrderQuoteResponse} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {EcdsaSigningScheme} from '@cowprotocol/cow-sdk';
import type {BaseTransaction} from '@gnosis.pm/safe-apps-sdk';

function	GnosisBatchedFlow({onUpdateSignStep}: {onUpdateSignStep: Dispatch<SetStateAction<number>>}): ReactElement {
	const	{provider} = useWeb3();
	const	cowswap = useSolverCowswap();
	const	{selected, amounts, quotes} = useSweepooor();
	const	[isApproving, set_isApproving] = useState(false);
	const	{sdk} = useSafeAppsSDK();

	/* 🔵 - Yearn Finance **************************************************************************
	** If the signer is a Gnosis Safe, we will use another way to perform the approvals and
	** signatures to be able to batch all the txs in one:
	** For each token:
	** - If it is non-approved, it will be approved
	** - The quote will be sent to the Cowswap API with signingScheme set to 'presign'
	** - A orderUID will be returned
	**********************************************************************************************/
	const	onExecuteFromGnosis = useCallback(async (): Promise<void> => {
		const	transactions: BaseTransaction[] = [];
		const	allSelected = [...selected];

		// Check approvals and add them to the batch if needed
		for (const token of allSelected) {
			const	quoteOrder = quotes[toAddress(token)];
			const	isApproved = await isApprovedERC20(
				provider,
				toAddress(token), //from
				toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //migrator
				amounts[toAddress(token)]?.raw
			);
			if (!isApproved) {
				const newApprovalForBatch = getApproveTransaction(
					amounts[toAddress(token)]?.raw.toString(),
					toAddress(token),
					toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS)
				);
				transactions.push(newApprovalForBatch);
			}

			quoteOrder.signature = '0x';
			await cowswap.execute(quoteOrder, true, (orderUID): void => {
				const newPreSignatureForBatch = getSetPreSignatureTransaction(
					toAddress(process.env.COWSWAP_GPV2SETTLEMENT_ADDRESS),
					orderUID,
					true
				);
				transactions.push(newPreSignatureForBatch);
				onUpdateSignStep((currentStep: number): number => currentStep + 1);
			});
		}

		try {
			const {safeTxHash} = await sdk.txs.send({txs: transactions});
			console.log(safeTxHash);
		} catch (error) {
			console.error(error);
		}
	}, [amounts, cowswap, onUpdateSignStep, provider, quotes, sdk.txs, selected]);


	return (
		<div className={'flex flex-row items-center space-x-4'}>
			<Button
				id={'TRIGGER_SWEEPOOOR'}
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isApproving}
				isDisabled={selected.length === 0}
				onClick={async (): Promise<void> => {
					set_isApproving(true);
					await onExecuteFromGnosis();
					set_isApproving(false);
				}}>
				{'Execute'}
			</Button>
		</div>
	);
}

function	StandardFlow({onUpdateApprovalStep, onUpdateSignStep}: {
	onUpdateApprovalStep: Dispatch<SetStateAction<number>>,
	onUpdateSignStep: Dispatch<SetStateAction<number>>
}): ReactElement {
	const	{provider} = useWeb3();
	const	{refresh} = useWallet();
	const	{selected, amounts, quotes, set_quotes} = useSweepooor();
	const	{toast} = yToast();
	const	[approveStatus, set_approveStatus] = useState<TDict<boolean>>({});
	const	[isApproving, set_isApproving] = useState(false);
	const	[isSigning, set_isSigning] = useState(false);
	const	[hasSentOrder, set_hasSentOrder] = useState(false);
	const	[, set_txStatus] = useState(defaultTxStatus);
	const	cowswap = useSolverCowswap();

	/* 🔵 - Yearn Finance **************************************************************************
	** Every time the selected tokens change (either a new token is added or the amount is changed),
	** we will check if the allowance is enough for the amount to be swept.
	**********************************************************************************************/
	useUpdateEffect((): void => {
		const	allSelected = [...selected];
		for (const token of allSelected) {
			isApprovedERC20(
				provider,
				toAddress(token), //from
				toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //migrator
				amounts[toAddress(token)]?.raw
			).then((isApproved): void => {
				set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: isApproved}));
			}).catch((error): void => {
				console.error(error);
			});
		}
	}, [selected, amounts]);

	/* 🔵 - Yearn Finance **************************************************************************
	** onApproveERC20 will loop through all the selected tokens and approve them if needed.
	** It will also update the approveStatus state to keep track of the approvals.
	** If the token is already approved, state will be updated to true but approval will not be
	** performed.
	**********************************************************************************************/
	const	onApproveERC20 = useCallback(async (): Promise<void> => {
		const	allSelected = [...selected];

		for (const token of allSelected) {
			try {
				const	isApproved = await isApprovedERC20(
					provider,
					toAddress(token), //from
					toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS), //migrator
					amounts[toAddress(token)]?.raw
				);

				if (!isApproved) {
					await new Transaction(provider, approveERC20, set_txStatus).populate(
						toAddress(token),
						toAddress(SOLVER_COW_VAULT_RELAYER_ADDRESS),
						amounts[toAddress(token)]?.raw
					).onSuccess(async (): Promise<void> => {
						set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: true}));
					}).perform();
				} else {
					set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: true}));
				}

				if (token === allSelected[allSelected.length - 1]) {
					set_isApproving(false);
				}
				onUpdateApprovalStep((currentStep: number): number => currentStep + 1);
			} catch (error) {
				console.error(error);
			}
		}
	}, [amounts, onUpdateApprovalStep, provider, selected]);

	/* 🔵 - Yearn Finance **************************************************************************
	** onSignQuote will loop through all the selected tokens and sign the quote if needed.
	** It will also update the quote to append the signature to the quote, which will be used
	** to execute the order.
	** If the quote is already signed, state will be updated to true but signing will not be
	** performed.
	**********************************************************************************************/
	const	onSignQuote = useCallback(async (): Promise<void> => {
		const	allSelected = [...selected];
		for (const token of allSelected) {
			if ((quotes?.[toAddress(token)]?.signature || '') !== '') {
				onUpdateSignStep((currentStep: number): number => currentStep + 1);
				if (token === allSelected[allSelected.length - 1]) {
					set_isSigning(false);
				}
				continue;
			}

			try {
				const quoteOrder = quotes[toAddress(token)];
				const {signature, signingScheme} = await cowswap.signCowswapOrder(quoteOrder);
				performBatchedUpdates((): void => {
					onUpdateSignStep((currentStep: number): number => currentStep + 1);
					set_quotes((prev): TDict<TOrderQuoteResponse> => ({
						...prev,
						[toAddress(token)]: {
							...quoteOrder,
							signature,
							signingScheme
						}
					}));
				});
			} catch (error) {
				performBatchedUpdates((): void => {
					onUpdateSignStep((currentStep: number): number => currentStep + 1);
					set_quotes((prev): TDict<TOrderQuoteResponse> => ({
						...prev,
						[toAddress(token)]: {
							...quotes[toAddress(token)],
							signature: '',
							signingScheme: '' as string as EcdsaSigningScheme
						}
					}));
				});
			}
			if (token === allSelected[allSelected.length - 1]) {
				set_isSigning(false);
			}
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cowswap?.signCowswapOrder, onUpdateSignStep, quotes, selected, set_quotes]);

	/* 🔵 - Yearn Finance **************************************************************************
	** onSendOrders send the orders to the cowswap API, skipping the ones that are already sent (
	** pending or fulfilled).
	** It will also request an update of the signature if it appears to not be signed, and will
	** update the quote to append the orderUID which will be used to track execution of the order,
	** aka from pending to status (fulfilled, cancelled, etc)
	**********************************************************************************************/
	const	onSendOrders = useCallback(async (): Promise<void> => {
		const	allSelected = [...selected];
		for (const token of allSelected) {
			const	quote = quotes[toAddress(token)];
			if (quote.orderUID && ['fulfilled', 'pending'].includes(quote?.orderStatus || '')) {
				continue; //skip already sent
			}

			//Not signed, force resign
			if ((quote?.signature || '') === '') {
				const quoteOrder = quotes[toAddress(token)];
				const {signature, signingScheme} = await cowswap.signCowswapOrder(quoteOrder);
				set_quotes((prev): TDict<TOrderQuoteResponse> => ({
					...prev,
					[toAddress(token)]: {
						...quoteOrder,
						signature,
						signingScheme
					}
				}));
				quote.signature = signature;
				quote.signingScheme = signingScheme;
			}

			cowswap.execute(
				quote,
				Boolean(process.env.SHOULD_USE_PRESIGN), // We don't want to use presign, unless specified in env variables (debug mode)
				(orderUID): void => {
					set_quotes((prev): TDict<TOrderQuoteResponse> => ({
						...prev,
						[toAddress(token)]: {...quote, orderUID, orderStatus: 'pending'}
					}));
				})
				.then((status): void => {
					set_quotes((prev): TDict<TOrderQuoteResponse> => ({
						...prev,
						[toAddress(token)]: {...quote, orderStatus: status}
					}));
					refresh([
						{
							token: quote.quote.buyToken,
							decimals: quote.request.outputToken.decimals,
							name: quote.request.outputToken.label,
							symbol: quote.request.outputToken.symbol
						},
						{
							token: quote.quote.sellToken,
							decimals: quote.request.inputToken.decimals,
							name: quote.request.inputToken.label,
							symbol: quote.request.inputToken.symbol
						}
					]);
				}).catch((error): void => {
					toast({type: 'error', content: error.message});
					if (error.message.includes('QuoteNotFound')) {
						set_quotes((prev): TDict<TOrderQuoteResponse> => ({
							...prev,
							[toAddress(token)]: {
								...quotes[toAddress(token)],
								quote: {
									...quotes[toAddress(token)].quote,
									validTo: 0
								},
								orderStatus: 'invalid',
								signature: '',
								signingScheme: '' as string as EcdsaSigningScheme
							}
						}));
					} else if (error.message.includes('InsufficientAllowance')) {
						performBatchedUpdates((): void => {
							set_approveStatus((prev): TDict<boolean> => ({...prev, [toAddress(token)]: false}));
							set_quotes((prev): TDict<TOrderQuoteResponse> => ({
								...prev,
								[toAddress(token)]: {
									...quotes[toAddress(token)],
									orderStatus: 'invalid',
									signature: '',
									signingScheme: '' as string as EcdsaSigningScheme
								}
							}));
						});
					} else {
						set_quotes((prev): TDict<TOrderQuoteResponse> => ({
							...prev,
							[toAddress(token)]: {
								...quotes[toAddress(token)],
								orderStatus: 'invalid',
								signature: '',
								signingScheme: '' as string as EcdsaSigningScheme
							}
						}));
					}
				});
		}
	}, [selected, quotes, cowswap, set_quotes, refresh, toast]);


	/* 🔵 - Yearn Finance **************************************************************************
	** areAllApproved and areAllSigned are used to determine if all the selected tokens have been
	** approved and signed.
	** If so, the onSendOrders function will be called.
	**********************************************************************************************/
	// eslint-disable-next-line @typescript-eslint/naming-convention
	const	areAllApproved = useMemo((): boolean => {
		if (selected.length === 0) {
			return false;
		}
		const isOk = true;
		for (const token of selected) {
			if (!approveStatus[toAddress(token)]) {
				return false;
			}
		}
		return isOk;
	}, [approveStatus, selected]);

	// eslint-disable-next-line @typescript-eslint/naming-convention
	const	areAllSigned = useMemo((): boolean => {
		if (selected.length === 0) {
			return false;
		}
		const isOk = true;
		for (const token of selected) {
			if ((quotes[toAddress(token)]?.signature || '') === '') {
				return false;
			}
		}
		return isOk;
	}, [quotes, selected]);

	/* 🔵 - Yearn Finance **************************************************************************
	** Trigger the onSendOrders function when all the selected tokens have been approved and signed
	**********************************************************************************************/
	useUpdateEffect((): void => {
		if (hasSentOrder || isSigning) {
			return;
		}
		if (areAllApproved && areAllSigned) {
			set_hasSentOrder(true);
			onSendOrders();
		}
	}, [hasSentOrder, areAllApproved, areAllSigned, isSigning]);

	return (
		<div className={'flex flex-row items-center space-x-4'}>
			<Button
				id={'TRIGGER_SWEEPOOOR'}
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isApproving}
				isDisabled={(selected.length === 0) || areAllApproved}
				onClick={(): void => {
					performBatchedUpdates((): void => {
						set_isApproving(true);
						onUpdateApprovalStep(0);
					});
					onApproveERC20();
				}}>
				{'Approve'}
			</Button>
			<Button
				className={'yearn--button !w-fit !px-6 !text-sm'}
				isBusy={isSigning}
				isDisabled={(selected.length === 0) || !areAllApproved || areAllSigned}
				onClick={(): void => {
					for (const token of selected) {
						if (!quotes[toAddress(token)] || !approveStatus[toAddress(token)]) {
							return;
						}
						performBatchedUpdates((): void => {
							set_isSigning(true);
							set_hasSentOrder(false);
							onUpdateSignStep(0);
						});
						onSignQuote();
					}
				}}>
				{'Sign'}
			</Button>
		</div>
	);
}

function	ViewApprovalWizard(): ReactElement {
	const	{walletType} = useWeb3();
	const	{selected, quotes} = useSweepooor();
	const	[currentWizardApprovalStep, set_currentWizardApprovalStep] = useState(-1);
	const	[currentWizardSignStep, set_currentWizardSignStep] = useState(-1);
	const	isGnosisSafe = walletType === 'EMBED_GNOSIS_SAFE';

	return (
		<section>
			<div className={'box-0 relative flex w-full flex-col items-center justify-center overflow-hidden p-4 md:p-6'}>
				<div className={'mb-6 w-full'}>
					<b>{'Dump!'}</b>
					<p className={'text-sm text-neutral-500'}>
						{isGnosisSafe ? 'All the step will be batched in one single transaction! Just execute it and sign your safe transaction! Easiest way to dump!' : 'This is a two step process. You first need to approve the tokens you want to dump, and then we will ask you to sign a message to send your order to dump!'}
					</p>
				</div>

				{selected.map((token, index): JSX.Element => {
					return (
						<ApprovalWizardItem
							key={index}
							token={token}
							index={index}
							isGnosisSafe={isGnosisSafe}
							hasSignature={(quotes?.[toAddress(token)]?.signature || '') !== ''}
							currentWizardApprovalStep={currentWizardApprovalStep}
							currentWizardSignStep={currentWizardSignStep}/>
					);
				})}
				<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
					<div className={'flex flex-col'} />
					{isGnosisSafe ? (
						<GnosisBatchedFlow
							onUpdateSignStep={set_currentWizardSignStep} />
					) : (
						<StandardFlow
							onUpdateApprovalStep={set_currentWizardApprovalStep}
							onUpdateSignStep={set_currentWizardSignStep} />
					)}
				</div>
			</div>
		</section>
	);
}
export default ViewApprovalWizard;
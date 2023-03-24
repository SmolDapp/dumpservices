import React, {memo, useCallback, useState} from 'react';
import IconRefresh from 'components/icons/IconRefresh';
import {useSweepooor} from 'contexts/useSweepooor';
import {useSolverCowswap} from 'hooks/useSolverCowswap';
import handleInputChangeEventValue from 'utils/handleInputChangeEventValue';
import {useDebouncedCallback} from '@react-hookz/web';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {formatBN, toNormalizedBN, Zero} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import performBatchedUpdates from '@yearn-finance/web-lib/utils/performBatchedUpdates';

import type {BigNumber} from 'ethers';
import type {TMinBalanceData} from 'hooks/useBalances';
import type {TCowQuote} from 'hooks/useSolverCowswap';
import type {ChangeEvent, ReactElement} from 'react';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

type TTokenRowInputProps = {
	balance: TMinBalanceData,
	tokenAddress: TAddress,
	isSelected: boolean,
	amount: TNormalizedBN,
	onDisable: (shouldDisable: boolean) => void,
};

const	TokenRowInput = memo(function TokenRowInput({tokenAddress, balance, isSelected, amount, onDisable}: TTokenRowInputProps): ReactElement {
	const cowswap = useSolverCowswap();
	const {set_selected, set_amounts, set_quotes, destination} = useSweepooor();
	const {address: fromAddress, isActive} = useWeb3();
	const [quote, set_quote] = useState(toNormalizedBN(0));
	const [isLoadingQuote, set_isLoadingQuote] = useState(false);
	const [error, set_error] = useState('');

	/**********************************************************************************************
	** onEstimateQuote is a direct retrieval of the quote from the Cowswap API with the rawAmount
	** sent as parameter. This is used when some actions are performed, but not when the user is
	** typing in the input field to avoid spamming the API.
	** On error, we try to display a meaningful message to the user and we disable the token
	** if it's not supported or if the fee is too high.
	**********************************************************************************************/
	const	onEstimateQuote = useCallback(async (rawAmount = amount?.raw, force = false): Promise<void> => {
		if (!isSelected && !force) {
			return;
		}
		performBatchedUpdates((): void => {
			set_error('');
			set_isLoadingQuote(true);
		});
		const [cowswapQuote, order, isSuccess, error] = await cowswap.init({
			from: toAddress(fromAddress || ''),
			inputToken: {
				value: toAddress(tokenAddress),
				label: balance.symbol,
				symbol: balance.symbol,
				decimals: balance.decimals
			},
			outputToken: {
				value: destination.address,
				label: destination.name,
				symbol: destination.symbol,
				decimals: destination.decimals
			},
			inputAmount: formatBN(rawAmount)
		});
		if (isSuccess) {
			performBatchedUpdates((): void => {
				if (order) {
					set_quotes((quotes: TDict<TCowQuote>): TDict<TCowQuote> => ({
						...quotes,
						[toAddress(tokenAddress)]: order
					}));
				}
				set_quote(cowswapQuote);
				set_isLoadingQuote(false);
			});
		} else {
			performBatchedUpdates((): void => {
				set_selected((s): TAddress[] => s.filter((item: TAddress): boolean => item !== tokenAddress));
				set_isLoadingQuote(false);
				if ((error as unknown as {errorType: string})?.errorType === 'UnsupportedToken') {
					set_error('This token is currently not supported.');
					onDisable(true);
				} else if ((error as unknown as {errorType: string})?.errorType === 'SellAmountDoesNotCoverFee') {
					set_error(`Fee is too high for this amount: ${formatAmount(Number(cowswapQuote.normalized), 4, 4)}`);
					onDisable(cowswapQuote.raw.gte(balance.raw));
				} else if ((error as unknown as {errorType: string})?.errorType === 'NoLiquidity') {
					set_error('No liquidity for this token.');
					onDisable(true);
				}
			});
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [balance, cowswap.init, fromAddress, tokenAddress, isSelected, destination]);

	/**********************************************************************************************
	** onDebouncedEstimateQuote is a debounced retrieval of the quote from the Cowswap API with the
	** rawAmount sent as parameter. This is used when the user is typing in the input field,
	** triggered with a delay of 400ms to avoid spamming the API.
	** On error, we try to display a meaningful message to the user and we disable the token
	** if it's not supported or if the fee is too high.
	**********************************************************************************************/
	const	onDebouncedEstimateQuote = useDebouncedCallback(async (rawAmount: BigNumber): Promise<void> => {
		if (!isSelected) {
			return;
		}
		performBatchedUpdates((): void => {
			set_error('');
			set_isLoadingQuote(true);
		});
		const [cowswapQuote, order, isSuccess, error] = await cowswap.init({
			from: toAddress(fromAddress || ''),
			inputToken: {
				value: toAddress(tokenAddress),
				label: balance.symbol,
				symbol: balance.symbol,
				decimals: balance.decimals
			},
			outputToken: {
				value: destination.address,
				label: destination.name,
				symbol: destination.symbol,
				decimals: destination.decimals
			},
			inputAmount: formatBN(rawAmount)
		});
		if (isSuccess) {
			performBatchedUpdates((): void => {
				if (order) {
					set_quotes((quotes: TDict<TCowQuote>): TDict<TCowQuote> => ({
						...quotes,
						[toAddress(tokenAddress)]: order
					}));
				}
				set_quote(cowswapQuote);
				set_isLoadingQuote(false);
			});
		} else {
			performBatchedUpdates((): void => {
				set_selected((s): TAddress[] => s.filter((item: TAddress): boolean => item !== tokenAddress));
				set_isLoadingQuote(false);
				if ((error as unknown as {errorType: string})?.errorType === 'UnsupportedToken') {
					set_error('This token is currently not supported.');
					onDisable(true);
				} else if ((error as unknown as {errorType: string})?.errorType === 'SellAmountDoesNotCoverFee' && cowswapQuote.raw.gt(Zero)) {
					set_error(`Fee is too high for this amount: ${formatAmount(Number(cowswapQuote.normalized), 4, 4)}`);
					onDisable(cowswapQuote.raw.gte(balance.raw));
				} else if ((error as unknown as {errorType: string})?.errorType === 'NoLiquidity') {
					set_error('No liquidity for this token.');
					onDisable(true);
				}
			});
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [balance, cowswap.init, fromAddress, tokenAddress, isSelected, destination, amount], 400);

	/**********************************************************************************************
	** onInputChange is triggered when the user is typing in the input field. It updates the
	** amount in the state and triggers the debounced retrieval of the quote from the Cowswap API.
	** It is set as callback to avoid unnecessary re-renders.
	**********************************************************************************************/
	const	onInputChange = useCallback((e: ChangeEvent<HTMLInputElement>): void => {
		let	newAmount = handleInputChangeEventValue(e, balance?.decimals || 18);
		if (newAmount.raw.gt(balance.raw)) {
			newAmount = balance;
		}
		performBatchedUpdates((): void => {
			set_error('');
			set_amounts((amounts): TDict<TNormalizedBN> => ({...amounts, [toAddress(tokenAddress)]: newAmount}));
			set_selected((s): TAddress[] => {
				if (newAmount.raw.gt(0) && !s.includes(toAddress(tokenAddress))) {
					return [...s, toAddress(tokenAddress)];
				}
				if (newAmount.raw.eq(0) && s.includes(toAddress(tokenAddress))) {
					return s.filter((item: TAddress): boolean => item !== toAddress(tokenAddress));
				}
				return s;
			});
		});
		onDebouncedEstimateQuote(newAmount.raw);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [balance, onDebouncedEstimateQuote, tokenAddress]);

	/**********************************************************************************************
	** onMaxClick is triggered when the user clicks on the Max button. It updates the amount in the
	** state and triggers the retrieval of the quote from the Cowswap API. It is set as callback
	** to avoid unnecessary re-renders.
	** The amount is set to the balance. If the balance is 0, we remove the token from the selected
	** tokens.
	**********************************************************************************************/
	const	onMaxClick = useCallback((): void => {
		performBatchedUpdates((): void => {
			set_error('');
			set_amounts((amounts): TDict<TNormalizedBN> => ({...amounts, [toAddress(tokenAddress)]: balance}));
			set_selected((s): TAddress[] => {
				if (balance.raw.gt(0) && !s.includes(toAddress(tokenAddress))) {
					return [...s, toAddress(tokenAddress)];
				}
				return s;
			});
		});
		onEstimateQuote(balance?.raw, true);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [balance, onEstimateQuote, tokenAddress]);

	/**********************************************************************************************
	** onRefreshClick is triggered when the user clicks on the Refresh button. It triggers the
	** retrieval of the quote from the Cowswap API. It is set as callback to avoid unnecessary
	** re-renders.
	**********************************************************************************************/
	const	onRefreshClick = useCallback((): void => {
		set_error('');
		onEstimateQuote(amount?.raw);
	}, [amount?.raw, onEstimateQuote]);

	/**********************************************************************************************
	** onResetClick is triggered when the user clicks on the hidden Reset button. This will reset
	** the amount to 0 and remove the error message. It is set as callback to avoid unnecessary
	** re-renders.
	** This can only be triggered by the getElementById.click() method to avoid useless and over
	** complexe state sharings.
	**********************************************************************************************/
	const	onResetClick = useCallback((): void => {
		performBatchedUpdates((): void => {
			set_error('');
			set_quote(toNormalizedBN(0));
		});
	}, []);

	return (
		<div className={'yearn--table-data-section'}>
			<div className={'relative col-span-1 flex h-auto flex-col items-center justify-center px-0 pt-0 md:col-span-7 md:h-16 md:py-2 md:px-6'}>
				<label className={'yearn--table-data-section-item-label'}>{'Amount to migrate'}</label>
				<div className={'box-0 flex h-10 w-full items-center p-2'}>
					<div
						className={'flex h-10 w-full flex-row items-center justify-between px-0'}
						onClick={(e): void => e.stopPropagation()}>
						<input
							className={`h-full w-full overflow-x-scroll border-none bg-transparent p-0 text-sm font-bold outline-none scrollbar-none ${isActive ? '' : 'cursor-not-allowed'}`}
							type={'number'}
							min={0}
							step={1 / 10 ** (balance.decimals || 18)}
							max={balance.normalized}
							inputMode={'numeric'}
							pattern={'^((?:0|[1-9]+)(?:.(?:d+?[1-9]|[1-9]))?)$'}
							disabled={!isActive}
							value={amount?.normalized ?? '0'}
							onChange={onInputChange} />
						<button
							onClick={onMaxClick}
							className={'ml-2 cursor-pointer rounded-sm border border-neutral-900 bg-neutral-100 px-2 py-1 text-xxs text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-neutral-0'}>
							{'max'}
						</button>
					</div>
				</div>
				<legend className={'absolute -bottom-1.5 left-6 pl-1 text-xxs text-[#e11d48]'}>{error}</legend>
			</div>

			<div className={'col-span-1 flex h-auto flex-col items-center justify-center px-0 pt-0 md:col-span-5 md:h-16 md:py-2'}>
				<label className={'yearn--table-data-section-item-label'}>{'Amount to migrate'}</label>
				<div className={'box-0 relative flex h-10 w-full items-center p-2'}>
					<div
						className={'flex h-10 w-full flex-row items-center justify-between py-4 px-0'}
						onClick={(e): void => e.stopPropagation()}>
						<span
							className={`w-full overflow-x-scroll border-none bg-transparent py-4 px-0 text-sm font-bold outline-none scrollbar-none ${isActive ? 'cursor-default' : 'cursor-not-allowed'}`}>
							{quote?.normalized || '0'}
						</span>
						{isLoadingQuote ? (
							<div className={'rounded-default absolute inset-0 flex flex-row items-center bg-neutral-0 pl-6'}>
								<div className={'flex h-10 items-center justify-center text-neutral-900'}>
									<span className={'loader-900'} />
								</div>
							</div>
						) : null}
						<button
							id={`quote-refresh-${toAddress(tokenAddress)}`}
							onClick={onRefreshClick}
							className={'cursor-pointer text-neutral-200 transition-colors hover:text-neutral-900'}>
							<IconRefresh className={'h-3 w-3'} />
						</button>
						<button
							id={`quote-reset-${toAddress(tokenAddress)}`}
							onClick={onResetClick}
							className={'pointer-events-none invisible absolute h-0 w-0'}>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
});

export default TokenRowInput;

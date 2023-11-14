import React, {useCallback, useRef} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {useTokenList} from 'contexts/useTokenList';
import {useWallet} from 'contexts/useWallet';
import {addQuote, deleteQuote, getBuyAmount, initQuote, resetQuote} from 'hooks/handleQuote';
import {useSolver} from 'hooks/useSolver';
import {DENYLIST_COWSWAP} from 'utils/denyList.cowswap';
import {serialize} from 'wagmi';
import {useDeepCompareMemo} from '@react-hookz/web';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {LoadingDumpings} from './LoadingDumpings';
import {NothingToDump} from './NothingToDump';
import {TokenRow} from './TokenRow';

import type {ReactElement} from 'react';
import type {TQuote, TRequestArgs, TToken, TTokenWithAmount} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function CardList(props: {search: string}): ReactElement {
	const {address, chainID} = useWeb3();
	const {getToken} = useTokenList();
	const {quotes, set_quotes, destination, receiver} = useSweepooor();
	const {balances, getBalance, isLoading} = useWallet();
	const solver = useSolver();
	const perTokenInputRef = useRef<TDict<HTMLInputElement>>({});

	const balancesToDisplay = useDeepCompareMemo((): [string, TBalanceData][] => {
		return Object.entries(balances || [])
			.filter(([tokenAddress]: [string, TBalanceData]): boolean => {
				return !DENYLIST_COWSWAP.includes(toAddress(tokenAddress));
			})
			.filter(([tokenAddress, tokenData]: [string, TBalanceData]): boolean => {
				if (props.search) {
					const searchArray = props.search.split(/[\s,]+/);
					return searchArray.some((searchTerm: string): boolean => {
						if (searchTerm === '') {
							return false;
						}
						return (
							tokenData.symbol.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
							tokenData.name.toLowerCase().startsWith(searchTerm.toLowerCase()) ||
							tokenAddress.toLowerCase().startsWith(searchTerm.toLowerCase())
						);
					});
				}
				return true;
			})
			.filter(
				([, balance]: [string, TBalanceData]): boolean =>
					(balance?.raw && balance.raw !== 0n) || balance?.force || false
			)
			.filter(
				([tokenAddress]: [string, TBalanceData]): boolean =>
					toAddress(tokenAddress) !== destination.address &&
					(chainID === 1 ? toAddress(tokenAddress) !== ETH_TOKEN_ADDRESS : true) //It's impossible to dump eth with CowSwap
			)
			.filter(([tokenAddress]: [string, TBalanceData]): boolean =>
				destination.address === ETH_TOKEN_ADDRESS ? toAddress(tokenAddress) !== WETH_TOKEN_ADDRESS : true
			);
	}, [balances, props.search, destination.address, chainID]);

	const prepareRequest = useCallback(
		(props: {
			solver: 'COWSWAP' | 'BEBOP';
			inputToken: TToken;
			rawAmount: bigint;
			rawBalance: bigint;
		}): TRequestArgs => {
			const previousInputTokens = Object.values(props.solver === 'BEBOP' ? quotes?.sellTokens || [] : []).map(
				(token: TTokenWithAmount): TToken => {
					return {
						address: token.address,
						name: token.name,
						symbol: token.symbol,
						decimals: token.decimals,
						chainId: token.chainId
					};
				}
			);
			const previousInputAmounts = Object.values(props.solver === 'BEBOP' ? quotes?.sellTokens || [] : []).map(
				(token: TTokenWithAmount): bigint => {
					return toBigInt(token.amount.raw);
				}
			);
			const previousInputBalance = Object.values(props.solver === 'BEBOP' ? quotes?.sellTokens || [] : []).map(
				(token: TTokenWithAmount): bigint => {
					return toBigInt(token.amount.raw);
				}
			);
			const indexOfTokenToUpdate = previousInputTokens.findIndex(
				(token: TToken) => props.inputToken.address === token.address
			);
			if (indexOfTokenToUpdate === -1) {
				previousInputTokens.push({
					address: props.inputToken.address,
					name: props.inputToken.name,
					symbol: props.inputToken.symbol,
					decimals: props.inputToken.decimals,
					chainId: props.inputToken.chainId
				});
				previousInputAmounts.push(props.rawAmount);
				previousInputBalance.push(props.rawBalance);
			} else {
				previousInputTokens[indexOfTokenToUpdate] = {
					address: props.inputToken.address,
					name: props.inputToken.name,
					symbol: props.inputToken.symbol,
					decimals: props.inputToken.decimals,
					chainId: props.inputToken.chainId
				};
				previousInputAmounts[indexOfTokenToUpdate] = props.rawAmount;
				previousInputBalance[indexOfTokenToUpdate] = props.rawBalance;
			}

			const request: TRequestArgs = {
				from: toAddress(address),
				receiver: toAddress(receiver),
				inputTokens: [...previousInputTokens],
				outputToken: {
					address: destination.address,
					name: destination.name,
					symbol: destination.symbol,
					decimals: destination.decimals,
					chainId: destination.chainId
				},
				inputAmounts: [...previousInputAmounts],
				inputBalances: [...previousInputBalance]
			};
			return request;
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[
			address,
			destination.address,
			destination.decimals,
			destination.name,
			destination.symbol,
			receiver,
			serialize(quotes)
		]
	);

	const onHandleQuote = useCallback(
		async (token: TToken, rawAmount: bigint): Promise<TNormalizedBN> => {
			if (rawAmount === 0n) {
				return toNormalizedBN(0);
			}
			if (perTokenInputRef.current[toAddress(token.address)]?.ariaBusy === 'true') {
				return toNormalizedBN(0);
			}
			if (perTokenInputRef.current[toAddress(token.address)]) {
				perTokenInputRef.current[toAddress(token.address)].ariaBusy = 'true';
				perTokenInputRef.current[toAddress(token.address)].ariaInvalid = 'false';
				perTokenInputRef.current[toAddress(token.address)].indeterminate = false;
			}
			const currentSolver = chainID === 1 ? 'COWSWAP' : 'BEBOP';
			const tokenBalance = getBalance(token.address);
			const request = prepareRequest({
				solver: currentSolver,
				inputToken: token,
				rawAmount: toBigInt(rawAmount),
				rawBalance: toBigInt(tokenBalance.raw)
			});

			set_quotes((q): TQuote => initQuote(q, token.address, request, currentSolver));
			const {quoteResponse, isSuccess, error} = await solver.getQuote(request);
			if (isSuccess && quoteResponse) {
				set_quotes((q): TQuote => addQuote(q, quoteResponse));
				if (perTokenInputRef.current[toAddress(token.address)]) {
					perTokenInputRef.current[toAddress(token.address)].ariaBusy = 'false';
					perTokenInputRef.current[toAddress(token.address)].ariaInvalid = 'false';
					perTokenInputRef.current[toAddress(token.address)].indeterminate = false;
				}
				return getBuyAmount(quoteResponse, token.address);
			}
			set_quotes((q): TQuote => deleteQuote(q, token.address));
			resetQuote(toAddress(token.address));
			if (error) {
				toast({type: 'error', content: error.message});
				if (perTokenInputRef.current[toAddress(token.address)]) {
					if (error.shouldDisable) {
						perTokenInputRef.current[toAddress(token.address)].ariaBusy = 'false';
						perTokenInputRef.current[toAddress(token.address)].ariaInvalid = 'true';
					} else {
						perTokenInputRef.current[toAddress(token.address)].ariaBusy = 'false';
						perTokenInputRef.current[toAddress(token.address)].indeterminate = true;
					}
				}
			}
			return toNormalizedBN(0);
		},
		[getBalance, prepareRequest, chainID, set_quotes, solver]
	);

	if (balancesToDisplay.length === 0 && isLoading) return <LoadingDumpings />;
	if (balancesToDisplay.length === 0 && !isLoading) return <NothingToDump />;

	return (
		<div className={'col-span-12 px-6 pb-6'}>
			{balancesToDisplay.map(([tokenAddress, balance]: [string, TBalanceData], index): ReactElement => {
				const fromToken = getToken(toAddress(tokenAddress));
				const toToken = destination;
				if (!fromToken || !toToken) {
					return <></>;
				}
				return (
					<div
						key={`${tokenAddress}-${chainID}-${balance.symbol}-${address}-${destination.address}-${receiver}`}
						className={'col-span-12 grid w-full grid-cols-12 gap-4 py-2'}>
						<TokenRow
							index={10_000 - index}
							perTokenInputRef={perTokenInputRef}
							fromToken={fromToken}
							toToken={toToken}
							balance={balance}
							onHandleQuote={onHandleQuote}
						/>
					</div>
				);
			})}
		</div>
	);
}

export {CardList};

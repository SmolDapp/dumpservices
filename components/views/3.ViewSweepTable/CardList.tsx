import React, {useCallback, useMemo, useRef} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {useWallet} from 'contexts/useWallet';
import {addQuote, deleteQuote, initQuote, resetQuote} from 'hooks/handleQuote';
import {getBuyAmount} from 'hooks/helperWithSolver';
import {useSolver} from 'hooks/useSolver';
import {DENYLIST_COWSWAP} from 'utils/denyList.cowswap';
import {toast} from '@yearn-finance/web-lib/components/yToast';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS} from '@yearn-finance/web-lib/utils/constants';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {LoadingDumpings} from './LoadingDumpings';
import {NothingToDump} from './NothingToDump';
import {TokenRow} from './TokenRow';

import type {ReactElement} from 'react';
import type {Maybe, TRequest, TRequestArgs, TToken} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';
import type {TBalanceData} from '@yearn-finance/web-lib/types/hooks';
import type {TNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';

function CardList(props: {search: string}): ReactElement {
	const {address, chainID} = useWeb3();
	const {set_quotes, destination, receiver} = useSweepooor();
	const {balances, getBalance, balancesNonce, isLoading} = useWallet();
	const solver = useSolver();
	const perTokenInputRef = useRef<TDict<HTMLInputElement>>({});

	const balancesToDisplay = useMemo((): [string, TBalanceData][] => {
		balancesNonce;
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
				([tokenAddress]: [string, TBalanceData]): boolean => toAddress(tokenAddress) !== destination.address
				// && toAddress(tokenAddress) !== ETH_TOKEN_ADDRESS //TODO: ONLY FOR BEBOP
			)
			.filter(([tokenAddress]: [string, TBalanceData]): boolean =>
				destination.address === ETH_TOKEN_ADDRESS ? toAddress(tokenAddress) !== WETH_TOKEN_ADDRESS : true
			);
	}, [balancesNonce, balances, props.search, destination.address]);

	const prepareRequest = useCallback(
		(props: {inputToken: TToken; rawAmount: bigint; rawBalance: bigint}): TRequestArgs => {
			const request: TRequestArgs = {
				from: toAddress(address),
				receiver: toAddress(receiver),
				inputTokens: [
					{
						address: props.inputToken.address,
						name: props.inputToken.name,
						symbol: props.inputToken.symbol,
						decimals: props.inputToken.decimals,
						chainId: chainID
					}
				],
				outputToken: {
					address: destination.address,
					name: destination.name,
					symbol: destination.symbol,
					decimals: destination.decimals,
					chainId: chainID
				},
				inputAmounts: [props.rawAmount],
				inputBalances: [props.rawBalance]
			};
			return request;
		},
		[address, chainID, destination.address, destination.decimals, destination.name, destination.symbol, receiver]
	);

	const onHandleQuote = useCallback(
		async (token: TToken, rawAmount: bigint): Promise<TNormalizedBN> => {
			if (rawAmount === 0n) {
				return toNormalizedBN(0);
			}
			if (perTokenInputRef.current[token.address]?.ariaBusy === 'true') {
				return toNormalizedBN(0);
			}
			if (perTokenInputRef.current[token.address]) {
				perTokenInputRef.current[token.address].ariaBusy = 'true';
				perTokenInputRef.current[token.address].ariaInvalid = 'false';
				perTokenInputRef.current[token.address].indeterminate = false;
			}
			const tokenBalance = getBalance(token.address);
			const request = prepareRequest({
				inputToken: token,
				rawAmount: toBigInt(rawAmount),
				rawBalance: toBigInt(tokenBalance.raw)
			});

			const currentSolver = chainID === 1 ? 'COWSWAP' : 'BEBOP';
			set_quotes((q): Maybe<TRequest> => initQuote(q, token.address, request, currentSolver));

			const {quoteResponse, isSuccess, error} = await solver.getQuote(request);
			if (isSuccess && quoteResponse) {
				set_quotes((q): Maybe<TRequest> => addQuote(q, quoteResponse));
				if (perTokenInputRef.current[token.address]) {
					perTokenInputRef.current[token.address].ariaBusy = 'false';
					perTokenInputRef.current[token.address].ariaInvalid = 'false';
					perTokenInputRef.current[token.address].indeterminate = false;
				}
				// return quoteResponse.
				return getBuyAmount(quoteResponse, token.address);
			}
			set_quotes((q): Maybe<TRequest> => deleteQuote(q, token.address));
			resetQuote(toAddress(token.address));
			if (error) {
				toast({type: 'error', content: error.message});
				if (perTokenInputRef.current[token.address]) {
					if (error.shouldDisable) {
						perTokenInputRef.current[token.address].ariaBusy = 'false';
						perTokenInputRef.current[token.address].ariaInvalid = 'true';
					} else {
						perTokenInputRef.current[token.address].ariaBusy = 'false';
						perTokenInputRef.current[token.address].indeterminate = true;
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
				return (
					<div
						key={`${tokenAddress}-${chainID}-${balance.symbol}-${address}-${destination.address}-${receiver}`}
						className={'col-span-12 grid w-full grid-cols-12 gap-4 py-2'}>
						<TokenRow
							index={10_000 - index}
							perTokenInputRef={perTokenInputRef}
							tokenAddress={toAddress(tokenAddress)}
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

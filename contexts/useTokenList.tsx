import React, {createContext, useCallback, useContext, useMemo, useState} from 'react';
import {useAsyncTrigger} from 'hooks/useAsyncEffect';
import defaultTokenList from 'utils/tokenLists.json';
import axios from 'axios';
import {useLocalStorageValue} from '@react-hookz/web';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {TokenListHandlerPopover} from '@common/TokenList/TokenListHandlerPopover';

import type {AxiosResponse} from 'axios';
import type {Dispatch, SetStateAction} from 'react';
import type {TToken} from 'utils/types';
import type {TAddress, TDict} from '@yearn-finance/web-lib/types';

export type TTokenList = {
	name: string;
	description: string;
	timestamp: string;
	logoURI: string;
	uri: string;
	keywords: string[];
	version: {
		major: number;
		minor: number;
		patch: number;
	};
	tokens: TToken[];
};
export type TTokenListProps = {
	tokenList: TDict<TToken>;
	getToken: (tokenAddress: TAddress) => TToken | undefined;
	set_tokenList: Dispatch<SetStateAction<TDict<TToken>>>;
	openTokenListModal: () => void;
};
const defaultProps: TTokenListProps = {
	tokenList: {},
	getToken: (): TToken | undefined => undefined,
	set_tokenList: (): void => undefined,
	openTokenListModal: (): void => undefined
};
const customDefaultList = {
	name: 'Custom',
	description: 'Custom token list',
	timestamp: new Date().toISOString(),
	logoURI: '',
	uri: '',
	keywords: [],
	version: {
		major: 1,
		minor: 0,
		patch: 0
	},
	tokens: []
};

const TokenList = createContext<TTokenListProps>(defaultProps);
export const TokenListContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const {safeChainID} = useChainID();
	const {value: extraTokenlist, set: set_extraTokenlist} = useLocalStorageValue<string[]>('smoldapp/extraTokenlists');
	const {value: extraTokens, set: set_extraTokens} = useLocalStorageValue<TToken[]>('smoldapp/extraTokens');
	const [tokenList, set_tokenList] = useState<TDict<TToken>>({});
	const [tokenListExtra, set_tokenListExtra] = useState<TDict<TToken>>({});
	const [tokenListCustom, set_tokenListCustom] = useState<TDict<TToken>>({});

	const [lists, set_lists] = useState<TTokenList[]>([]);
	const [extraLists, set_extraLists] = useState<TTokenList[]>([]);
	const [customLists, set_customLists] = useState<TTokenList>(customDefaultList);
	const [isTokenListModalOpen, set_isTokenListModalOpen] = useState<boolean>(false);

	useAsyncTrigger(async (): Promise<void> => {
		const rootURI = `https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/${safeChainID}`;
		const tokenListURIs = [`${rootURI}/etherscan.json`, `${rootURI}/tokenlistooor.json`];
		if (safeChainID === 1) {
			tokenListURIs.push(`${rootURI}/yearn.json`);
		} else {
			tokenListURIs.push(`${rootURI}/bebop.json`);
		}
		const [fromEtherscan, fromSmol, otherList] = await Promise.allSettled(
			tokenListURIs.map(async (eachURI: string): Promise<AxiosResponse> => axios.get(eachURI))
		);
		const tokens: TToken[] = [];
		const fromList: TTokenList[] = [];
		if (fromEtherscan.status === 'fulfilled' && fromEtherscan.value.data?.tokens) {
			tokens.push(...(fromEtherscan.value.data as TTokenList).tokens);
			fromList.push({...(fromEtherscan.value.data as TTokenList), uri: tokenListURIs[0]});
		}
		if (fromSmol.status === 'fulfilled' && fromSmol.value.data?.tokens) {
			tokens.push(...(fromSmol.value.data as TTokenList).tokens);
			fromList.push({...(fromSmol.value.data as TTokenList), uri: tokenListURIs[2]});
		}
		if (otherList.status === 'fulfilled' && otherList.value.data?.tokens) {
			tokens.push(...(otherList.value.data as TTokenList).tokens);
			fromList.push({...(otherList.value.data as TTokenList), uri: tokenListURIs[1]});
		}

		const tokenListTokens: TDict<TToken> = {};
		const defaultList = defaultTokenList as Partial<TTokenList>;
		for (const eachToken of defaultList?.tokens || []) {
			if (!tokenListTokens[toAddress(eachToken.address)]) {
				tokenListTokens[toAddress(eachToken.address)] = eachToken;
			}
		}

		for (const eachToken of tokens) {
			if (!tokenListTokens[toAddress(eachToken.address)]) {
				tokenListTokens[toAddress(eachToken.address)] = eachToken;
			}
		}
		set_tokenList(tokenListTokens);
		set_lists(fromList);
	}, [safeChainID]);

	useAsyncTrigger(async (): Promise<void> => {
		const tokenListTokens: TDict<TToken> = {};
		const fromList: TTokenList[] = [];
		for (const eachURI of extraTokenlist || []) {
			const [fromUserList] = await Promise.allSettled([axios.get(eachURI)]);
			if (fromUserList.status === 'fulfilled') {
				fromList.push({...(fromUserList.value.data as TTokenList), uri: eachURI});
				const {tokens} = fromUserList.value.data;
				for (const eachToken of tokens) {
					if (!tokenListTokens[toAddress(eachToken.address)]) {
						tokenListTokens[toAddress(eachToken.address)] = eachToken;
					}
				}
			}
		}
		set_tokenListExtra(tokenListTokens);
		set_extraLists(fromList);
	}, [extraTokenlist]);

	useAsyncTrigger(async (): Promise<void> => {
		if (extraTokens === undefined) {
			return;
		}
		if ((extraTokens || []).length > 0) {
			const tokenListTokens: TDict<TToken> = {};
			for (const eachToken of extraTokens || []) {
				if (!tokenListTokens[toAddress(eachToken.address)]) {
					tokenListTokens[toAddress(eachToken.address)] = eachToken;
				}
			}
			set_tokenListCustom(tokenListTokens);
			set_customLists({...customDefaultList, tokens: extraTokens});
		}
	}, [extraTokens]);

	const aggregatedTokenList = useMemo(
		() => ({...tokenList, ...tokenListExtra, ...tokenListCustom}),
		[tokenList, tokenListExtra, tokenListCustom]
	);

	const getToken = useCallback(
		(tokenAddress: TAddress): TToken => {
			const fromTokenList = aggregatedTokenList[toAddress(tokenAddress)];
			if (fromTokenList) {
				return fromTokenList;
			}
			return {} as TToken;
		},
		[aggregatedTokenList]
	);

	const contextValue = useMemo(
		(): TTokenListProps => ({
			tokenList: aggregatedTokenList,
			set_tokenList,
			getToken,
			openTokenListModal: (): void => set_isTokenListModalOpen(true)
		}),
		[aggregatedTokenList, getToken]
	);

	return (
		<TokenList.Provider value={contextValue}>
			{children}
			<TokenListHandlerPopover
				isOpen={isTokenListModalOpen}
				set_isOpen={set_isTokenListModalOpen}
				lists={[...lists, ...extraLists, customLists]}
				onAddTokenList={(list: TTokenList): void => {
					const tokenListTokens: TDict<TToken> = {};
					for (const eachToken of list.tokens) {
						if (!tokenListTokens[toAddress(eachToken.address)]) {
							tokenListTokens[toAddress(eachToken.address)] = eachToken;
						}
					}
					set_tokenList(
						(prevTokenList: TDict<TToken>): TDict<TToken> => ({
							...prevTokenList,
							...tokenListTokens
						})
					);
					set_lists((prevLists: TTokenList[]): TTokenList[] => [...prevLists, list]);
					set_extraTokenlist([...(extraTokenlist || []), list.uri]);
				}}
				onAddToken={(newToken: TToken): void => {
					set_tokenList(
						(prevTokenList: TDict<TToken>): TDict<TToken> => ({
							...prevTokenList,
							newToken
						})
					);
					set_extraTokens([...(extraTokens || []), newToken]);
				}}
			/>
		</TokenList.Provider>
	);
};

export const useTokenList = (): TTokenListProps => useContext(TokenList);

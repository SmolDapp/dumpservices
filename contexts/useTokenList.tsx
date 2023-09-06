import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import defaultTokenList from 'utils/tokenLists.json';
import axios from 'axios';
import {useChainID} from '@yearn-finance/web-lib/hooks/useChainID';
import {toAddress} from '@yearn-finance/web-lib/utils/address';

import type {Dispatch, SetStateAction} from 'react';
import type {TToken} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';

export type TTokenList = {
	name: string;
	tokens: TToken[];
}

export type TTokenListProps = {
	tokenList: TDict<TToken>,
	set_tokenList: Dispatch<SetStateAction<TDict<TToken>>>,
}
const defaultProps: TTokenListProps = {
	tokenList: {},
	set_tokenList: (): void => undefined
};

const TokenList = createContext<TTokenListProps>(defaultProps);
export const TokenListContextApp = ({children}: {children: React.ReactElement}): React.ReactElement => {
	const {safeChainID} = useChainID();
	const [tokenList, set_tokenList] = useState<TDict<TToken>>({});

	const fetchTokensFromLists = useCallback(async (): Promise<void> => {
		const lists: TToken[] = [];
		const tokenListTokens: TDict<TToken> = {};
		if (safeChainID === 1) {
			const defaultList = defaultTokenList as TTokenList;
			for (const eachToken of defaultList.tokens) {
				if (!tokenListTokens[toAddress(eachToken.address)]) {
					tokenListTokens[toAddress(eachToken.address)] = eachToken;
				}
			}

			const [fromEtherscan, fromYearn, fromSmol] = await Promise.allSettled([
				axios.get(`https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/${safeChainID}/etherscan.json`),
				axios.get(`https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/${safeChainID}/yearn.json`),
				axios.get(`https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/${safeChainID}/tokenlistooor.json`)
			]);
			if (fromEtherscan.status === 'fulfilled') {
				lists.push(...(fromEtherscan.value.data as TTokenList).tokens);
			}
			if (fromYearn.status === 'fulfilled') {
				lists.push(...(fromYearn.value.data as TTokenList).tokens);
			}
			if (fromSmol.status === 'fulfilled') {
				lists.push(...(fromSmol.value.data as TTokenList).tokens);
			}
		} else if (safeChainID === 137) {
			const [fromBebop] = await Promise.allSettled([axios.get(`https://raw.githubusercontent.com/SmolDapp/tokenLists/main/lists/${safeChainID}/bebop.json`)]);
			if (fromBebop.status === 'fulfilled') {
				lists.push(...(fromBebop.value.data as TTokenList).tokens);
			}
		}


		for (const eachToken of lists) {
			if (!tokenListTokens[toAddress(eachToken.address)]) {
				tokenListTokens[toAddress(eachToken.address)] = eachToken;
			}
		}
		set_tokenList(tokenListTokens);
	}, [safeChainID]);

	useEffect((): void => {
		fetchTokensFromLists();
	}, [fetchTokensFromLists]);

	const contextValue = useMemo((): TTokenListProps => ({
		tokenList,
		set_tokenList
	}), [tokenList]);

	return (
		<TokenList.Provider value={contextValue}>
			{children}
		</TokenList.Provider>
	);
};


export const useTokenList = (): TTokenListProps => useContext(TokenList);

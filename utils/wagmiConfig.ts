import {localhost} from 'utils/wagmiNetworks';
import {createConfig, mainnet} from 'wagmi';
import {CoinbaseWalletConnector} from 'wagmi/connectors/coinbaseWallet';
import {LedgerConnector} from 'wagmi/connectors/ledger';
import {MetaMaskConnector} from 'wagmi/connectors/metaMask';
import {SafeConnector} from 'wagmi/connectors/safe';
import {WalletConnectConnector} from 'wagmi/connectors/walletConnect';
import {alchemyProvider} from 'wagmi/providers/alchemy';
import {infuraProvider} from 'wagmi/providers/infura';
import {jsonRpcProvider} from 'wagmi/providers/jsonRpc';
import {publicProvider} from 'wagmi/providers/public';
import {InjectedConnector} from '@yearn-finance/web-lib/utils/web3/injectedConnector';
import {IFrameEthereumConnector} from '@yearn-finance/web-lib/utils/web3/ledgerConnector';
import {getRPC} from '@yearn-finance/web-lib/utils/web3/providers';

import {configureChains} from './wagmiConfigChain.tmp';

import type {Chain, ChainProviderFn} from 'wagmi';

function getSupportedProviders<TChain extends Chain = Chain>(): ChainProviderFn<TChain>[] {
	const supportedProviders = [
		jsonRpcProvider({
			rpc: (chain): {http: string} => {
				switch (chain.id) {
					case 1:
						return {http: process.env.JSON_RPC_URL?.[1] || mainnet.rpcUrls.public.http[0]};
					case 1337:
						return {http: process.env.JSON_RPC_URL?.[1337] || 'http://localhost:8545'};
					default:
						return {http: ''};
				}
			}
		}),
		publicProvider()
	];

	if (process.env.ALCHEMY_KEY) {
		supportedProviders.push(alchemyProvider({apiKey: process.env.ALCHEMY_KEY || ''}));
	}
	if (process.env.INFURA_PROJECT_ID) {
		supportedProviders.push(infuraProvider({apiKey: process.env.INFURA_PROJECT_ID || ''}));
	}
	return supportedProviders as unknown as ChainProviderFn<TChain>[];
}

const {chains, publicClient, webSocketPublicClient} = configureChains(
	[mainnet, localhost],
	getSupportedProviders()
);

const config = createConfig({
	autoConnect: true,
	publicClient,
	webSocketPublicClient,
	connectors: [
		new SafeConnector({chains, options: {allowedDomains: [/gnosis-safe.io/, /app.safe.global/]}}),
		new IFrameEthereumConnector({chains, options: {}}),
		new InjectedConnector({chains}),
		new MetaMaskConnector({chains}),
		new LedgerConnector({chains, options: {}}),
		new WalletConnectConnector({
			chains,
			options: {projectId: process.env.WALLETCONNECT_PROJECT_ID as string}
		}),
		new CoinbaseWalletConnector({
			chains,
			options: {
				jsonRpcUrl: getRPC(1),
				appName: process.env.WEBSITE_TITLE as string
			}
		})
	]
});

export default config;
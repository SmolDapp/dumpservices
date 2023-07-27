import {localhost} from 'utils/wagmiNetworks';
import {createPublicClient, http} from 'viem';
import {arbitrum, fantom, gnosis, optimism, polygon, polygonZkEvm} from 'viem/dist/types/chains';
import {mainnet} from 'wagmi';

import type {Chain, PublicClient} from 'viem';

export function getClient(chainID: number): PublicClient {
	if (chainID === 1337) {
		return createPublicClient({
			chain: localhost,
			transport: http(process.env.JSON_RPC_URL?.[1] || mainnet.rpcUrls.public.http[0])
		});
	}
	if (chainID === 10) {
		return createPublicClient({
			chain: optimism as Chain,
			transport: http(process.env.JSON_RPC_URL?.[10] || optimism.rpcUrls.public.http[0])
		});
	}
	if (chainID === 100) {
		return createPublicClient({
			chain: gnosis,
			transport: http(process.env.JSON_RPC_URL?.[100] || gnosis.rpcUrls.public.http[0])
		});
	}
	if (chainID === 137) {
		return createPublicClient({
			chain: polygon,
			transport: http(process.env.JSON_RPC_URL?.[137] || polygon.rpcUrls.public.http[0])
		});
	}
	if (chainID === 250) {
		return createPublicClient({
			chain: fantom,
			transport: http(process.env.JSON_RPC_URL?.[250] || fantom.rpcUrls.public.http[0])
		});
	}
	if (chainID === 1101) {
		return createPublicClient({
			chain: polygonZkEvm,
			transport: http(process.env.JSON_RPC_URL?.[1101] || polygonZkEvm.rpcUrls.public.http[0])
		});
	}
	if (chainID === 42161) {
		return createPublicClient({
			chain: arbitrum,
			transport: http(process.env.JSON_RPC_URL?.[42161] || arbitrum.rpcUrls.public.http[0])
		});
	}
	return createPublicClient({
		chain: mainnet,
		transport: http(process.env.JSON_RPC_URL?.[1] || mainnet.rpcUrls.public.http[0])
	});
}

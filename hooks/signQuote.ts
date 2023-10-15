import {OrderSigningUtils} from '@cowprotocol/cow-sdk';
import {getEthersSigner} from '@yearn-finance/web-lib/utils/wagmi/ethersAdapter';

import type {TCowswapOrderQuoteResponse} from 'utils/types';
import type {SigningResult, UnsignedOrder} from '@cowprotocol/cow-sdk';

type TSignQuoteFromCowswap = {
	quoteOrder: TCowswapOrderQuoteResponse;
	safeChainID: number;
	amountWithSlippage: bigint;
};
export async function signQuoteFromCowswap({quoteOrder, safeChainID, amountWithSlippage}: TSignQuoteFromCowswap): Promise<SigningResult> {
	if (process.env.SHOULD_USE_PRESIGN) {
		//sleep 1 second to simulate the signing process
		await new Promise(async (resolve): Promise<NodeJS.Timeout> => setTimeout(resolve, 1000));
		return {signature: '0x', signingScheme: 'presign'} as unknown as SigningResult;
	}

	const {quote} = quoteOrder;
	const buyAmountWithSlippage = quoteOrder.buyAmountWithSlippage || amountWithSlippage;
	const signer = await getEthersSigner({chainId: safeChainID});

	if (!signer) {
		console.error(`No signer found for chain ${safeChainID}`);
		return {signature: '0x', signingScheme: 'none'} as unknown as SigningResult;
	}

	return await OrderSigningUtils.signOrder({...(quote as UnsignedOrder), buyAmount: buyAmountWithSlippage.toString()}, safeChainID, signer);
}

import axios from 'axios';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import type {TOrderQuoteResponse} from 'utils/types';

type TSafeTxHistory = {
	safe: string
	nonce: number
}

function notify(orders: TOrderQuoteResponse[], origin: string, txHash: string, safeTx?: TSafeTxHistory): void {
	if (!orders.length) {
		return;
	}

	const messages = [] as string[];
	let from = '';
	let to = '';
	for (const order of orders) {
		from = toAddress(order.from);
		to = toAddress(order.quote.receiver);
		const buyAmount = formatAmount(
			toNormalizedBN(
				order?.quote?.buyAmount || '',
				order?.request?.outputToken?.decimals || 18
			).normalized, 6, 6);
		const sellAmount = formatAmount(
			toNormalizedBN(
				order?.quote?.sellAmount || '',
				order?.request?.inputToken?.decimals || 18
			).normalized, 6, 6);
		const feeAmount = formatAmount(
			toNormalizedBN(
				order?.quote?.feeAmount || '',
				order?.request?.inputToken?.decimals || 18
			).normalized, 6, 6);
		const buyToken = order.request.outputToken.symbol;
		const sellToken = order.request.inputToken.symbol;

		if (order?.orderError) {
			messages.push(
				`\t\t\t\t${sellAmount} [${sellToken.toUpperCase()}](https://etherscan.io/address/${order.request.inputToken.value}) ▶ ${buyAmount} [${buyToken.toUpperCase()}](https://etherscan.io/address/${order.request.outputToken.value}) | Quote ${order.id} | ❌ ERROR: ${order.orderError}`
			);
		} else {
			let status = `${order.orderStatus === 'fulfilled' ? '✅' : '❌'} [Order ${order.orderStatus}](https://explorer.cow.fi/orders/${order.orderUID})`;
			if (txHash) {
				status = `⏳ [Order pending](https://explorer.cow.fi/orders/${order.orderUID})`;
			}
			messages.push(
				`\t\t\t\t${sellAmount} [${sellToken.toUpperCase()}](https://etherscan.io/address/${order.request.inputToken.value}) ▶ ${buyAmount} [${buyToken.toUpperCase()}](https://etherscan.io/address/${order.request.outputToken.value}) | ${feeAmount} [${sellToken.toUpperCase()}](https://etherscan.io/address/${order.request.inputToken.value}) | ${status}`
			);
		}
	}

	const extra = [] as string[];
	if (txHash) {
		extra.push(...[
			'\n*📇 - Safe:*',
			`\t\t\t\tSafeTx: [${truncateHex(txHash, 6)}](https://safe-transaction-mainnet.safe.global/api/v1/multisig-transactions/${txHash})`,
			`\t\t\t\tNonce: ${safeTx?.nonce || 'N/A'}`
		]);

	}
	axios.post('/api/notify', {
		messages: [
			'*🥟 New dump detected*',
			'\n*🧹 - Orders:*',
			...messages,
			'\n*👀 - Meta:*',
			`\t\t\t\tFrom: [${truncateHex(from, 4)}](https://etherscan.io/address/${from})`,
			`\t\t\t\tTo: [${truncateHex(to, 4)}](https://etherscan.io/address/${to})`,
			`\t\t\t\tWallet: ${origin}`,
			...extra
		]
	});
}

export default notify;

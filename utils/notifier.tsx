import {TPossibleStatus} from 'utils/types';
import axios from 'axios';
import {toAddress, truncateHex} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';

import type {TBebopRequest, TCowswapOrderQuoteResponse, TRequest} from 'utils/types';
import type {Hex} from 'viem';

type TSafeTxHistory = {
	safe: string;
	nonce: number;
};

function notify(
	orders: TCowswapOrderQuoteResponse[],
	solver: 'COWSWAP' | 'BEBOP',
	origin: string,
	txHash: string,
	safeTx?: TSafeTxHistory
): void {
	if (!orders.length) {
		return;
	}

	const messages = [] as string[];
	let from = '';
	let to = '';
	for (const orderUnknown of orders) {
		if (solver === 'COWSWAP') {
			const order = orderUnknown as TCowswapOrderQuoteResponse;
			from = toAddress(order.from);
			to = toAddress(order.quote.receiver);
			const buyAmount = formatAmount(
				toNormalizedBN(order.quote.buyAmount || '', order.buyToken.decimals || 18).normalized,
				6,
				6
			);
			const sellAmount = formatAmount(
				toNormalizedBN(order.quote.sellAmount || '', order.sellToken.decimals || 18).normalized,
				6,
				6
			);
			const feeAmount = formatAmount(
				toNormalizedBN(order.quote.feeAmount || '', order.sellToken.decimals || 18).normalized,
				6,
				6
			);
			const buyToken = order.buyToken.symbol;
			const sellToken = order.sellToken.symbol;

			if (order?.orderError) {
				messages.push(
					`\t\t\t\t${sellAmount} [${sellToken.toUpperCase()}](https://etherscan.io/address/${
						order.sellToken.address
					}) ▶ ${buyAmount} [${buyToken.toUpperCase()}](https://etherscan.io/address/${
						order.buyToken.address
					}) | Quote ${order.id} | ❌ ERROR: ${order.orderError}`
				);
			} else {
				let status = `${order.orderStatus === TPossibleStatus.COWSWAP_FULFILLED ? '✅' : '❌'} [Order ${
					order.orderStatus
				}](https://explorer.cow.fi/orders/${order.orderUID})`;
				if (txHash) {
					status = `⏳ [Order pending](https://explorer.cow.fi/orders/${order.orderUID})`;
				}
				messages.push(
					`\t\t\t\t${sellAmount} [${sellToken.toUpperCase()}](https://etherscan.io/address/${
						order.sellToken.address
					}) ▶ ${buyAmount} [${buyToken.toUpperCase()}](https://etherscan.io/address/${
						order.buyToken.address
					}) | ${feeAmount} [${sellToken.toUpperCase()}](https://etherscan.io/address/${
						order.sellToken.address
					}) | ${status}`
				);
			}
		}
	}

	const extra = [] as string[];
	if (txHash) {
		extra.push(
			...[
				'\n*📇 - Safe:*',
				`\t\t\t\tSafeTx: [${truncateHex(
					txHash,
					6
				)}](https://safe-transaction-mainnet.safe.global/api/v1/multisig-transactions/${txHash})`,
				`\t\t\t\tNonce: ${safeTx?.nonce || 'N/A'}`
			]
		);
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

export function notifyBebop(order: TRequest & TBebopRequest, origin: string, txHash: Hex): void {
	const messages = [] as string[];
	const from = toAddress(order.quote.from);
	const to = toAddress(order.quote.receiver);
	for (let index = 0; index < Object.values(order.sellTokens).length; index++) {
		const sellToken = Object.values(order.sellTokens)[index];
		const buyToken = Object.values(order.buyTokens)[index];

		const buyAmount = formatAmount(buyToken.amount.normalized, 6, 6);
		const sellAmount = formatAmount(sellToken.amount.normalized, 6, 6);
		const feeAmount = formatAmount(
			toNormalizedBN(
				toBigInt(buyToken.amountWithSlippage?.raw || 0n) - toBigInt(buyToken?.amount.raw || 0n),
				buyToken.decimals
			).normalized,
			6,
			6
		);
		const status = ` ✅ [Order](https://polygonscan.com/tx/${txHash})`;
		messages.push(
			`\t\t\t\t${sellAmount} [${sellToken.symbol.toUpperCase()}](https://polygonscan.io/address/${
				sellToken.address
			}) ▶ ${buyAmount} [${buyToken.symbol.toUpperCase()}](https://polygonscan.io/address/${
				buyToken.address
			}) | ${feeAmount} [${sellToken.symbol.toUpperCase()}](https://polygonscan.io/address/${
				sellToken.address
			}) | ${status}`
		);
	}

	const extra = [] as string[];
	axios.post('/api/notify', {
		messages: [
			'*🥟 New Bebop dump detected*',
			'\n*🧹 - Orders:*',
			...messages,
			'\n*👀 - Meta:*',
			`\t\t\t\tFrom: [${truncateHex(from, 4)}](https://polygonscan.com/address/${from})`,
			`\t\t\t\tTo: [${truncateHex(to, 4)}](https://polygonscan.com/address/${to})`,
			`\t\t\t\tWallet: ${origin}`,
			...extra
		]
	});
}

export default notify;

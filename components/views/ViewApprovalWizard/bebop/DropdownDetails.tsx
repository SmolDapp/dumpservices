import React from 'react';
import {useWallet} from 'contexts/useWallet';
import {getTypedBebopQuote} from 'hooks/assertSolver';
import {getBuyAmount, getValidTo} from 'hooks/helperWithSolver';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';

import type {ReactElement} from 'react';
import type {TRequest} from 'utils/types';
import type {TAddress} from '@yearn-finance/web-lib/types';

function BebopDetails({quotes, token}: {quotes: TRequest; token: TAddress}): ReactElement {
	const {balances} = useWallet();
	const currentQuote = getTypedBebopQuote(quotes).quote[token];
	const currentSellToken = getTypedBebopQuote(quotes).sellTokens[token];
	const currentAggrSellToken = getTypedBebopQuote(quotes)?.bebopAggregatedQuote?.sellTokens?.[token] || {};

	if (!currentQuote) {
		return <div />;
	}

	return (
		<div className={'font-number space-y-2 border-t-0 p-4 text-xs md:text-sm'}>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Kind'}</b>
				<p className={'font-number'}>{currentQuote.type || ''}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'From'}</b>
				<p className={'font-number'}>{toAddress(currentQuote.from || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Receiver'}</b>
				<p className={'font-number'}>{toAddress(currentQuote.receiver || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'BuyAmount'}</b>
				<p className={'font-number'}>{`${getBuyAmount(quotes, token).normalized} (${
					getBuyAmount(quotes, token).raw || ''
				})`}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'BuyToken'}</b>
				<p className={'font-number'}>{`${
					balances?.[toAddress(currentQuote.buyToken.address)]?.symbol || ''
				} (${toAddress(currentQuote.buyToken.address || '')})`}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'SellAmount'}</b>
				<p className={'font-number'}>{`${currentSellToken.amount.normalized} (${
					currentSellToken.amount.raw || ''
				})`}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'FeeAmount'}</b>
				<p className={'font-number'}>
					{`${
						toNormalizedBN(
							toBigInt(currentAggrSellToken.amountBeforeFee) - toBigInt(currentAggrSellToken.amount),
							currentAggrSellToken.decimals
						).normalized
					} (${toBigInt(currentAggrSellToken.amountBeforeFee) - toBigInt(currentAggrSellToken.amount)})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'SellToken'}</b>
				<p className={'font-number'}>{`${balances?.[token]?.symbol || ''} (${toAddress(
					currentQuote.sellToken.address
				)})`}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'ValidTo'}</b>
				<p className={'font-number'}>{formatDate(getValidTo(quotes, token))}</p>
			</span>
		</div>
	);
}

export {BebopDetails};

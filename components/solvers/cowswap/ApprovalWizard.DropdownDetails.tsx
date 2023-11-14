import React from 'react';
import {useWallet} from 'contexts/useWallet';
import {getTypedCowswapQuote} from 'hooks/assertSolver';
import {getBuyAmount} from 'hooks/handleQuote';
import {getValidTo} from 'hooks/helperWithSolver';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';

import type {ReactElement} from 'react';
import type {TRequest, TTokenWithAmount} from 'utils/types';

function CowswapDetails({quotes, token}: {quotes: TRequest; token: TTokenWithAmount}): ReactElement {
	const {balances} = useWallet();
	const currentQuote = getTypedCowswapQuote(quotes).quote[token.address];

	if (!currentQuote.quote) {
		return <div />;
	}

	return (
		<div className={'font-number space-y-2 border-t-0 p-4 text-xs md:text-sm'}>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Kind'}</b>
				<p className={'font-number'}>{currentQuote.quote.kind || ''}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'From'}</b>
				<p className={'font-number'}>{toAddress(currentQuote.from || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Receiver'}</b>
				<p className={'font-number'}>{toAddress(currentQuote.quote.receiver || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'BuyAmount'}</b>
				<p className={'font-number'}>{`${getBuyAmount(quotes, token.address).normalized} (${
					getBuyAmount(quotes, token.address).raw || ''
				})`}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'BuyToken'}</b>
				<p className={'font-number'}>{`${
					balances?.[toAddress(currentQuote.quote.buyToken)]?.symbol || ''
				} (${toAddress(currentQuote.quote.buyToken || '')})`}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'SellAmount'}</b>
				<p className={'font-number'}>{`${token.amount.normalized} (${token.amount.raw || ''})`}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'FeeAmount'}</b>
				<p className={'font-number'}>
					{`${toNormalizedBN(currentQuote.quote.feeAmount || '', token.decimals).normalized} (${
						currentQuote.quote.feeAmount || ''
					})`}
				</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'SellToken'}</b>
				<p className={'font-number'}>{`${balances?.[token.address]?.symbol || ''} (${toAddress(
					currentQuote.quote.sellToken || ''
				)})`}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'ValidTo'}</b>
				<p className={'font-number'}>{formatDate(getValidTo(quotes, token.address))}</p>
			</span>
		</div>
	);
}

export {CowswapDetails};

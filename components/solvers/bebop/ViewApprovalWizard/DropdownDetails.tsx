import React from 'react';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';

import type {ReactElement} from 'react';
import type {TBebopRequest, TRequest} from 'utils/types';

function BebopDetails({currentQuote}: {currentQuote: TRequest & TBebopRequest}): ReactElement {
	if (!currentQuote) {
		return <div />;
	}

	return (
		<div className={'font-number space-y-2 border-t border-neutral-200 bg-neutral-100 p-4 text-xs md:text-sm'}>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Kind'}</b>
				<p className={'font-number'}>{currentQuote.quote.type || ''}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'From'}</b>
				<p className={'font-number'}>{toAddress(currentQuote.quote.toSign.taker || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Receiver'}</b>
				<p className={'font-number'}>{toAddress(currentQuote.quote.toSign.receiver || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'ValidTo'}</b>
				<p className={'font-number'}>{formatDate(currentQuote.quote.toSign.expiry * 1000)}</p>
			</span>
			<span className={'mt-4 flex flex-col justify-between pt-4 md:flex-row'}>
				<b>{'Dumping'}</b>
				<div className={'flex flex-col gap-y-1 text-right'}>
					{Object.entries(currentQuote.sellTokens).map(([key, value]) => {
						return (
							<div
								key={key}
								className={'flex gap-4'}>
								<p
									className={'font-number'}
									key={key}>
									<span className={'font-number font-bold'}>
										{formatAmount(value.amount.normalized, 6, 6)}
									</span>
									{` ${value.symbol} for `}
									<span className={'font-number font-bold'}>
										{formatAmount(currentQuote.buyTokens[value.address].amount.normalized, 6, 6)}
									</span>
									{` ${currentQuote.buyTokens[value.address].symbol} (`}
									<span className={'font-number font-bold'}>
										{formatAmount(
											toNormalizedBN(
												toBigInt(
													currentQuote.buyTokens[value.address].amountWithSlippage?.raw || 0n
												) - toBigInt(currentQuote.buyTokens[value.address]?.amount.raw || 0n),
												currentQuote.buyTokens[value.address].decimals
											).normalized,
											6,
											6
										)}
									</span>
									{` ${currentQuote.buyTokens[value.address].symbol} fees)`}
								</p>
							</div>
						);
					})}
				</div>
			</span>
		</div>
	);
}

export {BebopDetails};

import React from 'react';
import {toAddress} from '@yearn-finance/web-lib/utils/address';
import {toBigInt, toNormalizedBN} from '@yearn-finance/web-lib/utils/format.bigNumber';
import {formatAmount} from '@yearn-finance/web-lib/utils/format.number';
import {formatDate} from '@yearn-finance/web-lib/utils/format.time';

import type {ReactElement} from 'react';
import type {TBebopJamQuoteAPIResp} from 'utils/types';

function BebopDetails({aggregatedQuote}: {aggregatedQuote: TBebopJamQuoteAPIResp}): ReactElement {
	if (!aggregatedQuote) {
		return <div />;
	}

	return (
		<div className={'font-number space-y-2 border-t border-neutral-200 bg-neutral-100 p-4 text-xs md:text-sm'}>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Kind'}</b>
				<p className={'font-number'}>{aggregatedQuote.type || ''}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'From'}</b>
				<p className={'font-number'}>{toAddress(aggregatedQuote.taker || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'Receiver'}</b>
				<p className={'font-number'}>{toAddress(aggregatedQuote.receiver || '')}</p>
			</span>
			<span className={'flex flex-col justify-between md:flex-row'}>
				<b>{'ValidTo'}</b>
				<p className={'font-number'}>{formatDate(aggregatedQuote.expiry * 1000)}</p>
			</span>
			<span className={'mt-4 flex flex-col justify-between border-t border-neutral-200 pt-4 md:flex-row'}>
				<b>{'Dumping'}</b>
				<div className={'flex flex-col gap-y-1 text-right'}>
					{Object.entries(aggregatedQuote.sellTokens).map(([key, value]) => {
						return (
							<p
								className={'font-number'}
								key={key}>
								<span className={'font-number'}>
									{formatAmount(toNormalizedBN(value.amount, value.decimals).normalized, 6, 6)}
								</span>
								{` ${value.symbol} `}
								<span className={'font-number text-xs'}>{`(${toAddress(key)})`}</span>
							</p>
						);
					})}
				</div>
			</span>
			<span className={'mt-4 flex flex-col justify-between border-t border-neutral-200 pt-4 md:flex-row'}>
				<b>{'Receiving'}</b>
				{Object.entries(aggregatedQuote.buyTokens).map(([key, value]) => {
					return (
						<p
							className={'font-number'}
							key={key}>
							<span className={'font-number'}>
								{formatAmount(toNormalizedBN(value.amount, value.decimals).normalized, 6, 6)}
							</span>
							{` ${value.symbol} `}
							<span className={'font-number text-xs'}>{`(${toAddress(key)})`}</span>
						</p>
					);
				})}
			</span>
			<span className={'flex flex-col justify-between opacity-60 md:flex-row'}>
				<b>{'Fees'}</b>
				{Object.entries(aggregatedQuote.buyTokens).map(([key, value]) => {
					return (
						<p
							className={'font-number'}
							key={key}>
							<span className={'font-number'}>
								{formatAmount(
									toNormalizedBN(
										toBigInt(value.amountBeforeFee) - toBigInt(value.amount),
										value.decimals
									).normalized,
									6,
									6
								)}
							</span>
							{` ${value.symbol} `}
							<span className={'font-number text-xs'}>{`(${toAddress(key)})`}</span>
						</p>
					);
				})}
			</span>
		</div>
	);
}

export {BebopDetails};

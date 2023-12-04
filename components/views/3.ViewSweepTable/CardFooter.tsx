import React, {useMemo} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedBebopQuote, hasQuote, isBebopOrder} from 'hooks/assertSolver';
import {Button} from '@yearn-finance/web-lib/components/Button';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import AddTokenPopover from '@common/AddTokenPopover';

import type {ReactElement} from 'react';

function CardFooter({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const {isActive} = useWeb3();
	const {quotes} = useSweepooor();

	const hasQuoteForEverySelectedToken = useMemo((): boolean => {
		if (!hasQuote(quotes, '')) {
			return false;
		}
		if (isBebopOrder(quotes)) {
			const currentQuote = getTypedBebopQuote(quotes);
			return !!currentQuote.quote.toSign;
		}
		const allQuotes = Object.values(quotes.quote);
		return allQuotes.length > 0;
	}, [quotes]);

	return (
		<div
			className={cl(
				'relative col-span-12 flex w-full max-w-4xl flex-row items-center justify-between',
				'rounded-b bg-neutral-900 p-4 text-neutral-0 md:px-6 md:py-4'
			)}>
			<div className={'flex flex-col'}>
				<AddTokenPopover />
			</div>
			<div className={'flex flex-col'}>
				<Button
					className={'yearn--button !w-fit !px-6 !text-sm'}
					variant={'reverted'}
					isDisabled={
						!isActive || Object.values(quotes?.quote || {}).length === 0 || !hasQuoteForEverySelectedToken
					}
					onClick={onProceed}>
					{'Confirm'}
				</Button>
			</div>
		</div>
	);
}
export {CardFooter};

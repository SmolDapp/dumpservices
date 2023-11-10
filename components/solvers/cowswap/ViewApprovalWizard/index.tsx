import React, {useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedCowswapQuote} from 'hooks/assertSolver';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {CowswapApprovalWizard} from './ApprovalWizard';
import {CowswapButtons} from './Buttons';

import type {ReactElement} from 'react';
import type {TStatus} from 'utils/types';
import type {TDict} from '@yearn-finance/web-lib/types';

function Wrapper(): ReactElement {
	const {quotes} = useSweepooor();
	const [approvalStep, set_approvalStep] = useState<TDict<TStatus>>({});
	const [signStep, set_signStep] = useState<TDict<TStatus>>({});
	const [executeStep, set_executeStep] = useState<TDict<TStatus>>({});
	const listOfQuotes = useMemo(
		() =>
			Object.values(getTypedCowswapQuote(quotes).quote).filter(
				quote => quote.buyAmountWithSlippage && toBigInt(quote.buyAmountWithSlippage) > 0n
			),
		[quotes]
	);

	if (listOfQuotes.length === 0) {
		return (
			<div className={'py-20'}>
				<p className={'text-sm text-neutral-400/60'}>{'Select a token to dump'}</p>
			</div>
		);
	}

	return (
		<>
			{listOfQuotes.map((currentQuote, index): ReactElement => {
				return (
					<CowswapApprovalWizard
						key={`${currentQuote.sellToken.address}_${currentQuote?.quote?.buyAmount}_${currentQuote?.quote?.receiver}_${index}`}
						token={currentQuote.sellToken.address}
						index={index}
						hasSignature={(currentQuote?.signature || '') !== ''}
						approvalStep={approvalStep}
						signStep={signStep}
						executeStep={executeStep}
					/>
				);
			})}
			<div className={'flex w-full flex-row items-center justify-between pt-4 md:relative'}>
				<CowswapButtons
					approvals={approvalStep}
					onUpdateApprovalStep={set_approvalStep}
					onUpdateSignStep={set_signStep}
					onUpdateExecuteStep={set_executeStep}
				/>
			</div>
		</>
	);
}

export default Wrapper;

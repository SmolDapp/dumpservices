import React, {useMemo, useState} from 'react';
import {useSweepooor} from 'contexts/useSweepooor';
import {getTypedBebopQuote} from 'hooks/assertSolver';
import {toBigInt} from '@yearn-finance/web-lib/utils/format.bigNumber';

import {BebopApprovalWizard} from './ApprovalWizard';
import {BebopButtons} from './Buttons';

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
			Object.values(getTypedBebopQuote(quotes).quote).filter(
				quote => toBigInt(quote?.buyToken?.amount?.raw) > 0n
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
					<BebopApprovalWizard
						key={`${currentQuote.sellToken.address}_${currentQuote?.buyToken?.amount.raw}_${currentQuote?.receiver}_${index}`}
						token={currentQuote.sellToken.address}
						index={index}
						hasSignature={(currentQuote.signature || '') !== ''}
						approvalStep={approvalStep}
						signStep={signStep}
						executeStep={executeStep}
					/>
				);
			})}
			<div className={'flex w-full flex-row items-center justify-between p-4 md:relative md:px-0 md:pb-0'}>
				<BebopButtons
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

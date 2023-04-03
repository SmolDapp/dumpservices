import React from 'react';
import ViewApprovalWizard from 'components/views/sweepooor/ViewApprovalWizard';
import ViewDestination from 'components/views/sweepooor/ViewDestination';
import ViewReceiver from 'components/views/sweepooor/ViewReceiver';
import ViewSweepTable from 'components/views/sweepooor/ViewSweepTable';
import ViewWallet from 'components/views/ViewWallet';
import {Step, SweepooorContextApp, useSweepooor} from 'contexts/useSweepooor';

import type {ReactElement} from 'react';

function	Home(): ReactElement {
	const	{currentStep, set_currentStep} = useSweepooor();

	return (
		<div className={'mx-auto grid w-full max-w-4xl'}>
			<ViewWallet
				onSelect={(): void => {
					set_currentStep(Step.DESTINATION);
					document?.getElementById('destinationToken')?.scrollIntoView({behavior: 'smooth', block: 'start'});
				}} />

			<div
				id={'destinationToken'}
				className={`mt-2 pt-8 transition-opacity ${[Step.SELECTOR, Step.APPROVALS, Step.RECEIVER, Step.DESTINATION].includes(currentStep) ? 'opacity-100' : 'pointer-events-none h-0 overflow-hidden opacity-0'}`}>
				<ViewDestination />
			</div>

			<div
				id={'receiver'}
				className={`mt-2 pt-8 transition-opacity ${[Step.SELECTOR, Step.APPROVALS, Step.RECEIVER].includes(currentStep) ? 'opacity-100' : 'pointer-events-none h-0 overflow-hidden opacity-0'}`}>
				<ViewReceiver onProceed={(): void => set_currentStep(Step.SELECTOR)} />
			</div>

			<div
				id={'selector'}
				className={`mt-2 pt-8 transition-opacity ${[Step.SELECTOR, Step.APPROVALS].includes(currentStep) ? 'opacity-100' : 'pointer-events-none h-0 overflow-hidden opacity-0'}`}>
				<ViewSweepTable
					onProceed={(): void => {
						set_currentStep(Step.APPROVALS);
						document?.getElementById('approvals')?.scrollIntoView({behavior: 'smooth', block: 'start'});
						document?.getElementById('TRIGGER_SWEEPOOOR')?.click();
					}} />
			</div>

			<div
				id={'approvals'}
				className={`mt-2 pt-8 transition-opacity ${[Step.APPROVALS].includes(currentStep) ? 'opacity-100' : 'pointer-events-none h-0 overflow-hidden opacity-0'}`}>
				<ViewApprovalWizard />
			</div>
		</div>
	);
}

export default function Wrapper(): ReactElement {
	return (
		<SweepooorContextApp>
			<Home />
		</SweepooorContextApp>
	);
}


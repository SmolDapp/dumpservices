import React from 'react';
import ViewWallet from 'components/views/0.ViewWallet';
import ViewTokenToReceive from 'components/views/1.ViewTokenToReceive';
import ViewReceiver from 'components/views/2.ViewReceiver';
import ViewSweepTable from 'components/views/3.ViewSweepTable';
import ViewApprovalWizard from 'components/views/4.ViewApprovalWizard';
import {Step, SweepooorContextApp, useSweepooor} from 'contexts/useSweepooor';

import type {ReactElement} from 'react';
import type {TRequest} from 'utils/types';

function Home(): ReactElement {
	const {currentStep, set_currentStep, set_quotes} = useSweepooor();

	return (
		<div className={'mx-auto grid w-full max-w-4xl'}>
			<div className={'mb-10 mt-6 flex flex-col justify-center md:mt-20'}>
				<h1
					className={
						'-ml-1 mt-4 w-full text-3xl tracking-tight text-neutral-900 md:mt-6 md:w-1/2 md:text-5xl'
					}>
					{'One click token selling.'}
				</h1>
				<b className={'mt-4 w-full text-base leading-normal text-neutral-500 md:w-2/3 md:text-lg md:leading-8'}>
					{'Dump multiple tokens in a single transaction.'}
					<p>{'Quicker, easier, and less gas. Ready to dump anon?'}</p>
				</b>
			</div>

			<ViewWallet
				onSelect={(): void => {
					set_currentStep(Step.DESTINATION);
					document?.getElementById('tokenToReceive')?.scrollIntoView({behavior: 'smooth', block: 'start'});
				}}
			/>

			<div
				id={'tokenToReceive'}
				className={`mt-2 pt-8 transition-opacity ${
					[Step.SELECTOR, Step.APPROVALS, Step.RECEIVER, Step.DESTINATION].includes(currentStep)
						? 'opacity-100'
						: 'pointer-events-none h-0 overflow-hidden opacity-0'
				}`}>
				<ViewTokenToReceive
					onProceed={(): void => {
						if (currentStep === Step.DESTINATION) {
							set_currentStep(Step.RECEIVER);
							set_quotes({} as TRequest); // Reset quotes
						}
					}}
				/>
			</div>

			<div
				id={'receiver'}
				className={`mt-2 pt-8 transition-opacity ${
					[Step.SELECTOR, Step.APPROVALS, Step.RECEIVER].includes(currentStep)
						? 'opacity-100'
						: 'pointer-events-none h-0 overflow-hidden opacity-0'
				}`}>
				<ViewReceiver
					onProceed={(): void => {
						set_currentStep(Step.SELECTOR);
						set_quotes({} as TRequest); // Reset quotes
					}}
				/>
			</div>

			<div
				id={'selector'}
				className={`mt-2 pt-8 transition-opacity ${
					[Step.SELECTOR, Step.APPROVALS].includes(currentStep)
						? 'opacity-100'
						: 'pointer-events-none h-0 overflow-hidden opacity-0'
				}`}>
				<ViewSweepTable
					onProceed={(): void => {
						set_currentStep(Step.APPROVALS);
						document?.getElementById('approvals')?.scrollIntoView({behavior: 'smooth', block: 'start'});
						document?.getElementById('TRIGGER_SWEEPOOOR')?.click();
					}}
				/>
			</div>

			<div
				id={'approvals'}
				className={`mt-2 pt-8 transition-opacity ${
					[Step.APPROVALS].includes(currentStep)
						? 'opacity-100'
						: 'pointer-events-none h-0 overflow-hidden opacity-0'
				}`}>
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

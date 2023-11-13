import React from 'react';
import {Step, useSweepooor} from 'contexts/useSweepooor';
import {isBebopOrder, isCowswapOrder} from 'hooks/assertSolver';
import {useWeb3} from '@yearn-finance/web-lib/contexts/useWeb3';

import BebopBatchedFlow from '../../solvers/bebop/ViewApprovalWizard';
import CowswapStandardFlow from '../../solvers/cowswap/ViewApprovalWizard';
import GnosisBatchedFlow from '../../solvers/safeXCowswap/ViewApprovalWizard/gnosisXCowswap';

import type {ReactElement} from 'react';

function ViewApprovalWizard(): ReactElement {
	const {isWalletSafe} = useWeb3();
	const {quotes, currentStep} = useSweepooor();

	return (
		<section>
			<div
				className={
					'box-0 relative flex w-full flex-col items-center justify-center overflow-hidden p-0 md:p-6'
				}>
				<div className={'mb-0 w-full p-4 md:mb-6 md:p-0'}>
					<b>{'Dump!'}</b>
					<p
						className={'w-full text-sm text-neutral-500 md:w-3/4'}
						suppressHydrationWarning>
						{isWalletSafe
							? 'All the step will be batched in one single transaction! Just execute it and sign your safe transaction! Easiest way to dump!'
							: 'This is a two step process. You first need to approve the tokens you want to dump, and then we will ask you to sign a message to send your order to dump!'}
					</p>
				</div>

				{currentStep === Step.APPROVALS && isWalletSafe && <GnosisBatchedFlow />}
				{currentStep === Step.APPROVALS && isBebopOrder(quotes) && <BebopBatchedFlow />}
				{currentStep === Step.APPROVALS && isCowswapOrder(quotes) && <CowswapStandardFlow />}
			</div>
		</section>
	);
}
export default ViewApprovalWizard;

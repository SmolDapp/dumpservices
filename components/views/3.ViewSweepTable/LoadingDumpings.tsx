import {IconSpinner} from '@icons/IconSpinner';

import type {ReactElement} from 'react';

function LoadingDumpings(): ReactElement {
	return (
		<div className={'col-span-12 flex min-h-[200px] flex-col items-center justify-center'}>
			<IconSpinner />
			<p className={'mt-6 text-sm text-neutral-500'}>{'We are looking for your tokens ...'}</p>
		</div>
	);
}

export {LoadingDumpings};

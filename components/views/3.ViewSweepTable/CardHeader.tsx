import React, {Fragment} from 'react';
import {cl} from '@yearn-finance/web-lib/utils/cl';
import SettingsPopover from '@common/SettingsPopover';

import type {Dispatch, ReactElement} from 'react';

function CardHeader(props: {search: string; onSearch: Dispatch<string>}): ReactElement {
	return (
		<Fragment>
			<div className={'absolute right-4 top-4'}>
				<SettingsPopover />
			</div>
			<div className={'col-span-12 flex flex-col p-4 text-neutral-900 md:p-6 md:pb-2'}>
				<div className={'w-full md:w-3/4'}>
					<b>{'Which tokens do you want to dump?'}</b>
					<p className={'text-sm text-neutral-500'}>
						{
							'Select the token(s) that you’d like to dump. In exchange you’ll receive whatever token you selected in the first step.'
						}
					</p>
				</div>
				<div className={'mt-4 w-full'}>
					<input
						onChange={(event): void => props.onSearch(event.target.value)}
						value={props.search}
						className={cl(
							'h-10 w-full text-sm',
							'rounded-md border border-neutral-200 px-4 py-2',
							'focus:border-neutral-400 focus:outline-none'
						)}
						type={'text'}
						placeholder={'Filter tokens...'}
					/>
				</div>
			</div>
		</Fragment>
	);
}

export {CardHeader};

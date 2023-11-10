import React, {useState} from 'react';

import {CardFooter} from './CardFooter';
import {CardHeader} from './CardHeader';
import {CardList} from './CardList';

import type {ReactElement} from 'react';

function ViewSweepTable({onProceed}: {onProceed: VoidFunction}): ReactElement {
	const [search, set_search] = useState<string>('');

	return (
		<section>
			<div className={'box-0 relative grid w-full grid-cols-12'}>
				<CardHeader
					search={search}
					onSearch={set_search}
				/>
				<CardList search={search} />
				<CardFooter onProceed={onProceed} />
			</div>
		</section>
	);
}
export default ViewSweepTable;

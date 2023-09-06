import React from 'react';
import Meta from 'components/common/Meta';
import {Logo} from 'components/icons/logo';
import thumbnailVariants from 'utils/animations';
import {AnimatePresence, motion} from 'framer-motion';

import {NetworkSelector, WalletSelector} from './HeaderElements';

import type {AppProps} from 'next/app';
import type {ReactElement} from 'react';

function Header(): ReactElement {
	return (
		<div id={'head'} className={'fixed inset-x-0 top-0 z-50 w-full border-b border-primary-100'}>
			<div id={'head'} className={'bg-primary-50/95 pl-52 pr-10'}>
				<div className={'mx-auto flex flex-row justify-between p-4'}>
					<div className={'flex items-center justify-start'}>
						<div className={'flex items-center justify-center rounded-full bg-white p-2'}>
							<Logo className={'h-4 w-4'} />
						</div>
					</div>
					<div className={'flex items-center justify-end'}>
						<NetworkSelector networks={[]} />
						<WalletSelector />
					</div>
				</div>
			</div>
		</div>
	);
}

function AppWrapper(props: AppProps): ReactElement {
	const {Component, pageProps, router} = props;

	return (
		<React.Fragment>
			<Meta />
			<Header />
			<div id={'app'} className={'relative mx-auto mb-0 flex min-h-screen w-full flex-col pt-14'}>
				<AnimatePresence mode={'wait'}>
					<motion.div
						key={router.pathname}
						initial={'initial'}
						animate={'enter'}
						exit={'exit'}
						variants={thumbnailVariants}>
						<Component
							key={router.route}
							router={props.router}
							{...pageProps} />
					</motion.div>
				</AnimatePresence>
			</div>
		</React.Fragment>
	);
}

export default AppWrapper;

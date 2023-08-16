import React from 'react';
import {Inter} from 'next/font/google';
import AppWrapper from 'components/common/AppWrapper';
import {TokenListContextApp} from 'contexts/useTokenList';
import {WalletContextApp} from 'contexts/useWallet';
import {mainnet} from 'wagmi';
import {SafeProvider} from '@gnosis.pm/safe-apps-react-sdk';
import {polygon} from '@wagmi/chains';
import {WithYearn} from '@yearn-finance/web-lib/contexts/WithYearn';
import {localhost} from '@yearn-finance/web-lib/utils/wagmi/networks';

import type {AppProps} from 'next/app';
import type {ReactElement} from 'react';

import	'../style.css';

const inter = Inter({
	weight: ['400', '700'],
	subsets: ['latin'],
	display: 'swap',
	variable: '--inter-font'
});

function MyApp(props: AppProps): ReactElement {
	return (
		<>
			<style jsx global>{`html {font-family: ${inter.style.fontFamily};}`}</style>
			<WithYearn supportedChains={[mainnet, polygon, localhost]}>
				<TokenListContextApp>
					<WalletContextApp>
						<SafeProvider>
							<main className={`flex h-screen flex-col ${inter.variable}`}>
								<AppWrapper {...props} />
							</main>
						</SafeProvider>
					</WalletContextApp>
				</TokenListContextApp>
			</WithYearn>
		</>
	);
}

export default MyApp;

/* eslint-disable @typescript-eslint/explicit-function-return-type */
const withPWA = require('next-pwa')({
	dest: 'public',
	disable: process.env.NODE_ENV !== 'production'
});
const withTM = require('next-transpile-modules')(['@yearn-finance/web-lib'], {resolveSymlinks: false});
const {PHASE_EXPORT} = require('next/constants');

module.exports = phase =>
	withTM(
		withPWA({
			assetPrefix: process.env.IPFS_BUILD === 'true' || phase === PHASE_EXPORT ? './' : '/',
			images: {
				unoptimized: process.env.IPFS_BUILD === 'true' || phase === PHASE_EXPORT,
				domains: [
					'rawcdn.githack.com',
					'raw.githubusercontent.com',
					'ipfs.io',
					's3.amazonaws.com',
					'1inch.exchange',
					'hut34.io',
					'www.coingecko.com',
					'defiprime.com',
					'cdn.furucombo.app',
					'gemini.com',
					'messari.io',
					'ethereum-optimism.github.io',
					'tryroll.com',
					'logo.assets.tkn.eth.limo',
					'umaproject.org',
					'cloudflare-ipfs.com',
					'assets.smold.app'
				]
			},
			async rewrites() {
				return [
					{
						source: '/js/script.js',
						destination: 'https://plausible.io/js/script.js'
					},
					{
						source: '/api/event',
						destination: 'https://plausible.io/api/event'
					}
				];
			},
			redirects() {
				return [
					{
						source: '/github',
						destination: 'https://github.com/SmolDapp/dumpservices',
						permanent: true
					}
				];
			},
			env: {
				JSON_RPC_URL: {
					1: process.env.RPC_URL_MAINNET,
					1337: 'http://localhost:8080'
				},
				ALCHEMY_KEY: process.env.ALCHEMY_KEY,
				INFURA_KEY: process.env.INFURA_KEY,
				RPC_URL_OPTIMISM_YEARN: process.env.RPC_URL_OPTIMISM_YEARN,
				WALLETCONNECT_PROJECT_ID: process.env.WALLETCONNECT_PROJECT_ID,
				SMOL_ASSETS_URL: 'https://assets.smold.app/api',
				// API_ENDPOINT: 'http://localhost:3001',
				// API_ENDPOINT: 'https://dumpservice-git-feat-bebop-ycorpo.vercel.app',
				API_ENDPOINT: 'https://dumpbebop.vercel.app',

				RECEIVER_ADDRESS: '0x10001192576E8079f12d6695b0948C2F41320040',
				DISPERSE_ADDRESS: '0xD152f549545093347A162Dce210e7293f1452150',

				COWSWAP_GPV2SETTLEMENT_ADDRESS: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
				COWSWAP_APP_DATA: '0x36feff31915bd0063a70753d8b240559cc79b55029756877924452f43b7090b4',

				BEBOP_SPENDER_ADDRESS: '0xBeb09beB09e95E6FEBf0d6EEb1d0D46d1013CC3C',
				BEBOP_BALANCE_MANAGER_ADDRESS: '0xccd724480C24e76B996C6e9052A033595F63f13F',
				BEBOP_SETTLEMENT_ADDRESS: '0x24cF41DBe70D84e0AdD1c4d6AA9c52FA2fFD917E',
				COWSWAP_SPENDER_ADDRESS: '0xC92E8bdf79f0507f65a392b0ab4667716BFE0110',

				BEBOP_JAM_KEY: process.env.BEBOP_JAM_KEY,

				SHOULD_USE_PRESIGN: true,
				TELEGRAM_BOT: process.env.TELEGRAM_BOT,
				TELEGRAM_CHAT: process.env.TELEGRAM_CHAT
			}
		})
	);

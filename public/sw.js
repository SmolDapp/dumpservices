if (!self.define) {
	let e,
		c = {};
	const a = (a, n) => (
		(a = new URL(a + '.js', n).href),
		c[a] ||
			new Promise(c => {
				if ('document' in self) {
					const e = document.createElement('script');
					(e.src = a), (e.onload = c), document.head.appendChild(e);
				} else (e = a), importScripts(a), c();
			}).then(() => {
				let e = c[a];
				if (!e) throw new Error(`Module ${a} didn’t register its module`);
				return e;
			})
	);
	self.define = (n, s) => {
		const i = e || ('document' in self ? document.currentScript.src : '') || location.href;
		if (c[i]) return;
		let f = {};
		const o = e => a(e, i),
			t = {module: {uri: i}, exports: f, require: o};
		c[i] = Promise.all(n.map(e => t[e] || o(e))).then(e => (s(...e), f));
	};
}
define(['./workbox-50de5c5d'], function (e) {
	'use strict';
	importScripts(),
		self.skipWaiting(),
		e.clientsClaim(),
		e.precacheAndRoute(
			[
				{url: '/_next/static/36Z1jzABcpcG2GJlOFjfQ/_buildManifest.js', revision: 'dcc26ef2518a9b2dc53ac20fa1c70e62'},
				{url: '/_next/static/36Z1jzABcpcG2GJlOFjfQ/_ssgManifest.js', revision: 'b6652df95db52feb4daf4eca35380933'},
				{url: '/_next/static/chunks/298-befa21e2f89436a5.js', revision: 'befa21e2f89436a5'},
				{url: '/_next/static/chunks/33-48ba400da7035da9.js', revision: '48ba400da7035da9'},
				{url: '/_next/static/chunks/343.4952b250abc44fc0.js', revision: '4952b250abc44fc0'},
				{url: '/_next/static/chunks/391.e0fe880f1724ad37.js', revision: 'e0fe880f1724ad37'},
				{url: '/_next/static/chunks/459.6b41f349fa86f969.js', revision: '6b41f349fa86f969'},
				{url: '/_next/static/chunks/731.9ba2c193abbb3c62.js', revision: '9ba2c193abbb3c62'},
				{url: '/_next/static/chunks/792.4f599f189386155f.js', revision: '4f599f189386155f'},
				{url: '/_next/static/chunks/811.edf73c34ed83f6c0.js', revision: 'edf73c34ed83f6c0'},
				{url: '/_next/static/chunks/882.09eb4ec6849449df.js', revision: '09eb4ec6849449df'},
				{url: '/_next/static/chunks/884.4f5494afd7bca72c.js', revision: '4f5494afd7bca72c'},
				{url: '/_next/static/chunks/942.0ac71dd7cb84e71e.js', revision: '0ac71dd7cb84e71e'},
				{url: '/_next/static/chunks/framework-18c7e6fcf99e5daa.js', revision: '18c7e6fcf99e5daa'},
				{url: '/_next/static/chunks/main-0a047a7aa03c514c.js', revision: '0a047a7aa03c514c'},
				{url: '/_next/static/chunks/pages/_app-c3f77218263a7b97.js', revision: 'c3f77218263a7b97'},
				{url: '/_next/static/chunks/pages/_error-3f6d1c55bb8051ab.js', revision: '3f6d1c55bb8051ab'},
				{url: '/_next/static/chunks/pages/index-92c90aa563b2b0fc.js', revision: '92c90aa563b2b0fc'},
				{url: '/_next/static/chunks/polyfills-78c92fac7aa8fdd8.js', revision: '79330112775102f91e1010318bae2bd3'},
				{url: '/_next/static/chunks/webpack-b1122f8bb830c488.js', revision: 'b1122f8bb830c488'},
				{url: '/_next/static/css/40516c6f52bf59ba.css', revision: '40516c6f52bf59ba'},
				{url: '/_next/static/media/2aaf0723e720e8b9-s.p.woff2', revision: 'e1b9f0ecaaebb12c93064cd3c406f82b'},
				{url: '/_next/static/media/9c4f34569c9b36ca-s.woff2', revision: '2c1fc211bf5cca7ae7e7396dc9e4c824'},
				{url: '/_next/static/media/ae9ae6716d4f8bf8-s.woff2', revision: 'b0c49a041e15bdbca22833f1ed5cfb19'},
				{url: '/_next/static/media/b1db3e28af9ef94a-s.woff2', revision: '70afeea69c7f52ffccde29e1ea470838'},
				{url: '/_next/static/media/b967158bc7d7a9fb-s.woff2', revision: '08ccb2a3cfc83cf18d4a3ec64dd7c11b'},
				{url: '/_next/static/media/c0f5ec5bbf5913b7-s.woff2', revision: '8ca5bc1cd1579933b73e51ec9354eec9'},
				{url: '/_next/static/media/d1d9458b69004127-s.woff2', revision: '9885d5da3e4dfffab0b4b1f4a259ca27'},
				{url: '/cow.svg', revision: 'e797bf8774ed15f9875cc0aa71a7ece2'},
				{url: '/favicons/android-icon-144x144.png', revision: '9fbed0b446ca679662173095ec834211'},
				{url: '/favicons/android-icon-192x192.png', revision: '9713b93506eb96dac8b57d3412210a62'},
				{url: '/favicons/android-icon-36x36.png', revision: '12fbcf43365656c943aa3b70032bd6fc'},
				{url: '/favicons/android-icon-48x48.png', revision: 'e9aac270cfad83140342e9ccde2916a3'},
				{url: '/favicons/android-icon-72x72.png', revision: '72e05ae033f2ac1e620fee82ffbc8653'},
				{url: '/favicons/android-icon-96x96.png', revision: '5ec7919f79fbb5996f46e9f2f6f828b2'},
				{url: '/favicons/apple-icon-114x114.png', revision: 'e808859db2bc6939863f7ae8ce61c87d'},
				{url: '/favicons/apple-icon-120x120.png', revision: '7e54fe6fad844a6b958a75ac3b6ec6e3'},
				{url: '/favicons/apple-icon-144x144.png', revision: '9fbed0b446ca679662173095ec834211'},
				{url: '/favicons/apple-icon-152x152.png', revision: '0ede7603702a4fe35c353ce30d7e130f'},
				{url: '/favicons/apple-icon-180x180.png', revision: '800bd8c41e9f6a658376602580123bb3'},
				{url: '/favicons/apple-icon-57x57.png', revision: '88365ec449a6f82c9884275e5acd66cd'},
				{url: '/favicons/apple-icon-60x60.png', revision: '18a8c0ef7a69e34e0abceb2b2aa2d79f'},
				{url: '/favicons/apple-icon-72x72.png', revision: '72e05ae033f2ac1e620fee82ffbc8653'},
				{url: '/favicons/apple-icon-76x76.png', revision: 'b0d0d3069ab1eb9699b0c16d8db25470'},
				{url: '/favicons/apple-icon-precomposed.png', revision: '6bc537bebcac18af2ea2c8c50048c7ba'},
				{url: '/favicons/apple-icon.png', revision: '6bc537bebcac18af2ea2c8c50048c7ba'},
				{url: '/favicons/browserconfig.xml', revision: '653d077300a12f09a69caeea7a8947f8'},
				{url: '/favicons/favicon-16x16.png', revision: 'dd6d45c2fdb5b9edbe8c55fe8dac3333'},
				{url: '/favicons/favicon-32x32.png', revision: '3b316b7e38ab5f143309f541a7fd31a3'},
				{url: '/favicons/favicon-96x96.png', revision: '5ec7919f79fbb5996f46e9f2f6f828b2'},
				{url: '/favicons/favicon.ico', revision: '8f0014ea510954b9d4be73ca8776af53'},
				{url: '/favicons/favicon.svg', revision: 'eeb91c3a1b9cc194f6a78ae711c990eb'},
				{url: '/favicons/manifest.json', revision: 'b58fcfa7628c9205cb11a1b2c3e8f99a'},
				{url: '/favicons/ms-icon-144x144.png', revision: '9fbed0b446ca679662173095ec834211'},
				{url: '/favicons/ms-icon-150x150.png', revision: '0e34cd509f95d92f68d77cb2ec0e809d'},
				{url: '/favicons/ms-icon-310x310.png', revision: 'fee8811bf66177842811e5a1ca779a72'},
				{url: '/favicons/ms-icon-70x70.png', revision: 'ed7f24d3bb1f4542f654986acf28bbb4'},
				{url: '/manifest.json', revision: '23113abbb064c37b8ba01c390b965fdc'},
				{url: '/og.png', revision: '4d37d22c16f4ee3820507cedacc69afe'},
				{url: '/placeholder.png', revision: '76e4abc63869962750bcd60694719807'}
			],
			{ignoreURLParametersMatching: []}
		),
		e.cleanupOutdatedCaches(),
		e.registerRoute(
			'/',
			new e.NetworkFirst({
				cacheName: 'start-url',
				plugins: [
					{
						cacheWillUpdate: async ({request: e, response: c, event: a, state: n}) =>
							c && 'opaqueredirect' === c.type ? new Response(c.body, {status: 200, statusText: 'OK', headers: c.headers}) : c
					}
				]
			}),
			'GET'
		),
		e.registerRoute(
			/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
			new e.CacheFirst({cacheName: 'google-fonts-webfonts', plugins: [new e.ExpirationPlugin({maxEntries: 4, maxAgeSeconds: 31536e3})]}),
			'GET'
		),
		e.registerRoute(
			/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
			new e.StaleWhileRevalidate({cacheName: 'google-fonts-stylesheets', plugins: [new e.ExpirationPlugin({maxEntries: 4, maxAgeSeconds: 604800})]}),
			'GET'
		),
		e.registerRoute(
			/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
			new e.StaleWhileRevalidate({cacheName: 'static-font-assets', plugins: [new e.ExpirationPlugin({maxEntries: 4, maxAgeSeconds: 604800})]}),
			'GET'
		),
		e.registerRoute(
			/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
			new e.StaleWhileRevalidate({cacheName: 'static-image-assets', plugins: [new e.ExpirationPlugin({maxEntries: 64, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			/\/_next\/image\?url=.+$/i,
			new e.StaleWhileRevalidate({cacheName: 'next-image', plugins: [new e.ExpirationPlugin({maxEntries: 64, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			/\.(?:mp3|wav|ogg)$/i,
			new e.CacheFirst({cacheName: 'static-audio-assets', plugins: [new e.RangeRequestsPlugin(), new e.ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			/\.(?:mp4)$/i,
			new e.CacheFirst({cacheName: 'static-video-assets', plugins: [new e.RangeRequestsPlugin(), new e.ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			/\.(?:js)$/i,
			new e.StaleWhileRevalidate({cacheName: 'static-js-assets', plugins: [new e.ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			/\.(?:css|less)$/i,
			new e.StaleWhileRevalidate({cacheName: 'static-style-assets', plugins: [new e.ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			/\/_next\/data\/.+\/.+\.json$/i,
			new e.StaleWhileRevalidate({cacheName: 'next-data', plugins: [new e.ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			/\.(?:json|xml|csv)$/i,
			new e.NetworkFirst({cacheName: 'static-data-assets', plugins: [new e.ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			({url: e}) => {
				if (!(self.origin === e.origin)) return !1;
				const c = e.pathname;
				return !c.startsWith('/api/auth/') && !!c.startsWith('/api/');
			},
			new e.NetworkFirst({cacheName: 'apis', networkTimeoutSeconds: 10, plugins: [new e.ExpirationPlugin({maxEntries: 16, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			({url: e}) => {
				if (!(self.origin === e.origin)) return !1;
				return !e.pathname.startsWith('/api/');
			},
			new e.NetworkFirst({cacheName: 'others', networkTimeoutSeconds: 10, plugins: [new e.ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 86400})]}),
			'GET'
		),
		e.registerRoute(
			({url: e}) => !(self.origin === e.origin),
			new e.NetworkFirst({cacheName: 'cross-origin', networkTimeoutSeconds: 10, plugins: [new e.ExpirationPlugin({maxEntries: 32, maxAgeSeconds: 3600})]}),
			'GET'
		);
});

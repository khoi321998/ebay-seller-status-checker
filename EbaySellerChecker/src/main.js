import { CheerioCrawler } from '@crawlee/cheerio';
import { Actor, log } from 'apify';
import { gotScraping } from 'got-scraping';

import { router } from './routes.js';

await Actor.init();

const { sellerUrls = [], maxConcurrency = 5 } = (await Actor.getInput()) ?? {};

if (sellerUrls.length === 0) {
    log.warning('No sellerUrls provided, exiting');
    await Actor.exit();
}

const proxyConfiguration = await Actor.createProxyConfiguration({
    groups: ['RESIDENTIAL'],
    countryCode: 'US',
});

const startRequests = sellerUrls.map((url) => ({
    url: url.trim().replace(/\/+$/, ''),
    label: 'CHECK_SELLER',
}));

const crawler = new CheerioCrawler({
    proxyConfiguration,
    useSessionPool: true,
    persistCookiesPerSession: true,
    sessionPoolOptions: { maxPoolSize: 20 },
    maxConcurrency,
    maxRequestRetries: 3,
    requestHandler: router,

    preNavigationHooks: [
        async ({ session, proxyInfo, request, log: reqLog }) => {
            request.headers = {
                ...(request.headers || {}),
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1',
            };

            // Warm-up homepage để lấy Akamai cookies, tránh cold-start 403
            if (session?.userData?.warmedUp) return;
            try {
                await gotScraping({
                    url: 'https://www.ebay.com',
                    proxyUrl: proxyInfo?.url,
                    cookieJar: session?.cookieJar,
                    timeout: { request: 15000 },
                });
                if (session) {
                    session.userData = session.userData || {};
                    session.userData.warmedUp = true;
                }
                reqLog.debug(`Session warmed up`);
            } catch (err) {
                reqLog.warning(`Warm-up failed: ${err.message}`);
            }
        },
    ],
});


await crawler.run(startRequests);
await Actor.exit();

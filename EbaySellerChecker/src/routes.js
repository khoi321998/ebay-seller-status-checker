import { createCheerioRouter } from '@crawlee/cheerio';

export const router = createCheerioRouter();

router.addHandler('CHECK_SELLER', async ({ $, request, response, log, pushData }) => {
    const status = response?.statusCode;

    // eBay trả 410 (đôi khi 404) cho seller đã bị xóa khỏi platform → dead, không retry
    if (status === 410 || status === 404) {
        log.info(`${request.url} → active=false (HTTP ${status})`);
        await pushData({
            url: request.url,
            active: false,
            checkedAt: new Date().toISOString(),
        });
        return;
    }

    // Các status 4xx/5xx khác hoặc page không có header eBay → khả năng bị Akamai block, retry
    const hasEbayHeader = $('#gh').length > 0;
    if (status >= 400 || !hasEbayHeader) {
        throw new Error(
            `Likely blocked (status=${status}, hasHeader=${hasEbayHeader}) — retry with new session`,
        );
    }

    // HTTP 200 + có eBay header → check DOM
    const active = $('.str-seller-card-wrap').length > 0;
    log.info(`${request.url} → active=${active}`);

    await pushData({
        url: request.url,
        active,
        checkedAt: new Date().toISOString(),
    });
});

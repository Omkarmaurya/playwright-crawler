const express = require('express');
const app = express();
const { chromium } = require('playwright');

app.use(express.json());

let browser;

// ================= LAUNCH BROWSER ONCE =================
(async () => {
    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--single-process',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });

        console.log('✅ Chromium launched successfully');
    } catch (err) {
        console.error('❌ Browser launch error:', err);
        process.exit(1);
    }
})();

// ================= PRODUCT ROUTE =================
app.post('/product', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    let context;
    let page;

    try {
        // Create isolated browser context (VERY IMPORTANT)
        context = await browser.newContext({
            userAgent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            locale: 'en-US',
            viewport: { width: 1280, height: 800 }
        });

        page = await context.newPage();

        await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 45000
        });

        await page.waitForTimeout(3000);

        const finalUrl = page.url();

        const ogTags = await page.evaluate(() => {
            const tags = {};
            document.querySelectorAll('meta').forEach(meta => {
                const property =
                    meta.getAttribute('property') ||
                    meta.getAttribute('name');

                const content = meta.getAttribute('content');

                if (property && content) {
                    tags[property] = content.trim();
                }
            });
            return tags;
        });

        // ================= AMAZON =================
        if (finalUrl.includes('amazon.')) {
            await page.waitForSelector('#productTitle', { timeout: 20000 });

            const data = await page.evaluate(() => {
                const clean = (text) =>
                    text?.replace(/\s+/g, ' ').trim() || null;

                const getText = (selector) =>
                    clean(document.querySelector(selector)?.innerText);

                const getAttr = (selector, attr) =>
                    document.querySelector(selector)?.getAttribute(attr);

                return {
                    product_title: getText('#productTitle'),
                    description:
                        getText('#feature-bullets') ||
                        getText('#productDescription'),
                    image_url:
                        getAttr('#landingImage', 'src') ||
                        getAttr('#imgTagWrapperId img', 'src')
                };
            });

            return res.json({
                success: true,
                data: {
                    ...data,
                    product_url: finalUrl,
                    ogTags
                }
            });
        }

        // ================= FLIPKART =================
        if (finalUrl.includes('flipkart.')) {
            return res.json({
                success: true,
                data: {
                    product_title: ogTags['Keywords'] || null,
                    product_url: finalUrl,
                    description: ogTags['Description'] || null,
                    image_url: ogTags['og:image'] || null,
                    ogTags
                }
            });
        }

        // ================= OTHER WEBSITES =================
        return res.json({
            success: true,
            data: {
                product_title:
                    ogTags['og:title'] ||
                    (await page.title()) ||
                    null,
                product_url: finalUrl,
                description:
                    ogTags['og:description'] ||
                    ogTags['description'] ||
                    null,
                image_url: ogTags['og:image'] || null,
                ogTags
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        // Close only the context (NOT the browser)
        if (context) {
            await context.close();
        }
    }
});

// ================= GRACEFUL SHUTDOWN =================
process.on('SIGINT', async () => {
    console.log('Shutting down...');
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});

// ================= START SERVER =================
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

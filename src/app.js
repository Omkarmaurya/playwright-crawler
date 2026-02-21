const express = require('express');
const { firefox } = require('playwright');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

let firefoxBrowser;
let firefoxContext;

// ================= LAUNCH FIREFOX ONCE =================
(async () => {
    try {
        firefoxBrowser = await firefox.launch({
            headless: true,
            args: [
                '--single-process',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });

        firefoxContext = await firefoxBrowser.newContext({
            userAgent:
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            locale: 'en-US',
            viewport: { width: 1280, height: 800 }
        });

        console.log('Firefox launched successfully');
    } catch (err) {
        console.error('Browser launch error:', err);
    }
})();

// ================= PRODUCT ROUTE =================
app.post('/product', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    let page;

    try {
        page = await firefoxContext.newPage();

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

                const product_title = getText('#productTitle');
                const description =
                    getText('#feature-bullets') ||
                    getText('#productDescription');

                const image_url =
                    getAttr('#landingImage', 'src') ||
                    getAttr('#imgTagWrapperId img', 'src');

                return {
                    product_title,
                    description,
                    image_url
                };
            });

            await page.close();

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
            const product_title = ogTags['Keywords'] || null;
            const description = ogTags['Description'] || null;
            const image_url = ogTags['og:image'] || null;

            await page.close();

            return res.json({
                success: true,
                data: {
                    product_title,
                    product_url: finalUrl,
                    description,
                    image_url,
                    ogTags
                }
            });
        }

        // ================= OTHER WEBSITES =================
        const product_title =
            ogTags['og:title'] ||
            (await page.title()) ||
            null;

        const description =
            ogTags['og:description'] ||
            ogTags['description'] ||
            null;

        const image_url =
            ogTags['og:image'] ||
            null;

        await page.close();

        return res.json({
            success: true,
            data: {
                product_title,
                product_url: finalUrl,
                description,
                image_url,
                ogTags
            }
        });

    } catch (error) {
        if (page) await page.close();

        return res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        // Ensure the browser is closed after all operations
        if (browser) {
            await browser.close();
        }
    }
});

// ================= START SERVER =================
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

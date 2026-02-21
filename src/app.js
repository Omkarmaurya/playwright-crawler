const express = require('express');
const app = express();
const { chromium } = require('playwright-extra')
const stealth = require('puppeteer-extra-plugin-stealth')()
chromium.use(stealth)

const bodyParser = require('body-parser');
app.use(express.json());
// Use body-parser to parse form data
app.use(bodyParser.urlencoded({ extended: true }));

// ================= PRODUCT ROUTE =================
app.post('/product', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    let browser;

    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--single-process',
                '--no-sandbox',
                '--disable-setuid-sandbox',
            ],
        });

        const page = await browser.newPage();

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
         if (browser) {
            await browser.close();
        }
        return res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

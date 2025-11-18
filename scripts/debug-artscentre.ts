import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function debugArtsCentrePuppeteer() {
    let browser;
    try {
        console.log('🚀 Launching browser...');
        browser = await puppeteer.launch({
            headless: false, // Set to true in production
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();

        // Set realistic browser properties
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        console.log('🔍 Navigating to Arts Centre...');
        await page.goto('https://www.artscentremelbourne.com.au/whats-on/event-calendar', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        // Wait a bit for any dynamic content
        console.log('⏳ Waiting for content to load...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Save screenshot
        await page.screenshot({ path: 'debug-artscentre.png', fullPage: true });
        console.log('📸 Screenshot saved to debug-artscentre.png');

        // Get all class names to understand the structure
        const classNames = await page.evaluate(() => {
            const classes = new Set<string>();
            document.querySelectorAll('[class]').forEach(el => {
                const classList = el.className;
                if (typeof classList === 'string') {
                    classList.split(' ').forEach(cls => {
                        if (cls.includes('event') || cls.includes('Event') ||
                            cls.includes('card') || cls.includes('Card')) {
                            classes.add(cls);
                        }
                    });
                }
            });
            return Array.from(classes);
        });

        console.log('\n🏷️  Event-related class names found:');
        classNames.forEach(cls => console.log(`   ${cls}`));

        // Try to find event elements
        console.log('\n🔍 Looking for event elements:');

        const selectors = [
            '.event-tile',
            '.event-card',
            '.EventCard',
            '[class*="EventCard"]',
            '[class*="event-card"]',
            '[data-testid*="event"]',
            'article',
            '[class*="Event"]'
        ];

        for (const selector of selectors) {
            const count = await page.evaluate((sel) => {
                return document.querySelectorAll(sel).length;
            }, selector);
            console.log(`   ${selector}: ${count} found`);
        }

        // Get page HTML
        const html = await page.content();
        fs.writeFileSync('debug-artscentre-puppeteer.html', html);
        console.log('\n✅ HTML saved to debug-artscentre-puppeteer.html');

        // Try to extract any visible text that looks like event names
        console.log('\n📝 Sample text content:');
        const sampleText = await page.evaluate(() => {
            const body = document.body;
            const text = body.innerText || body.textContent || '';
            return text.substring(0, 1000);
        });
        console.log(sampleText);

        // Check for specific event elements
        console.log('\n🎭 Looking for events with various methods:');

        const eventData = await page.evaluate(() => {
            const results: any[] = [];

            // Method 1: Look for links with event-like URLs
            const links = document.querySelectorAll('a[href*="/whats-on"], a[href*="/event"]');
            links.forEach(link => {
                if (link.textContent?.trim() && link.textContent.trim().length > 3) {
                    results.push({
                        method: 'URL matching',
                        text: link.textContent.trim(),
                        href: (link as HTMLAnchorElement).href
                    });
                }
            });

            // Method 2: Look for headings
            const headings = document.querySelectorAll('h1, h2, h3');
            headings.forEach(h => {
                const text = h.textContent?.trim();
                if (text && text.length > 10 && text.length < 100) {
                    results.push({
                        method: 'Headings',
                        text: text,
                        tag: h.tagName
                    });
                }
            });

            return results;
        });

        console.log(`Found ${eventData.length} potential event elements:`);
        eventData.slice(0, 10).forEach(item => {
            console.log(`   [${item.method}] ${item.text.substring(0, 60)}...`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        if (browser) {
            console.log('\n🔒 Closing browser...');
            await browser.close();
        }
    }
}

debugArtsCentrePuppeteer();
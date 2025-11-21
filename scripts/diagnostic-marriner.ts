// ============================================
// scripts/diagnostic-marriner.ts
// Diagnose why not all shows are being scraped
// ============================================

import { load } from 'cheerio';
import fs from 'fs';

const SHOWS_URL = 'https://marrinergroup.com.au/shows';
const BASE_URL = 'https://marrinergroup.com.au';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

async function diagnoseMarriner() {
    console.log('🔍 Diagnosing Marriner Group Shows Page\n');

    try {
        // ====================================
        // PART 1: Analyze Shows Listing Page
        // ====================================
        const response = await fetch(SHOWS_URL, { headers: HEADERS });
        const html = await response.text();
        const $ = load(html);

        console.log('📊 RAW HTML ANALYSIS (Shows Listing):\n');

        // Count shows in different ways
        const showDivs = $('.shows-grid .show');
        console.log(`✓ .shows-grid .show: ${showDivs.length} elements`);

        const allShowLinks = $('a[href*="/shows/"]').filter((_, el) => {
            const href = $(el).attr('href');
            return !!href && href !== '/shows' && href !== '/shows/';
        });

        console.log(`✓ a[href*="/shows/"]: ${allShowLinks.length} links`);

        const h4Titles = $('h4.title');
        console.log(`✓ h4.title: ${h4Titles.length} titles`);

        // Look for pagination or "load more" buttons
        console.log('\n🔍 LOOKING FOR PAGINATION/LOAD MORE:\n');

        const pagination = $('[class*="pagina"], [class*="load"], [class*="more"]');
        console.log(`✓ Pagination/Load elements found: ${pagination.length}`);

        if (pagination.length > 0) {
            pagination.slice(0, 5).each((_, el) => {
                const text = $(el).text().trim().substring(0, 50);
                const classes = $(el).attr('class');
                console.log(`   - ${classes}: "${text}"`);
            });
        }

        // Look for buttons that might load more
        const buttons = $('button');
        console.log(`\n✓ Total buttons: ${buttons.length}`);
        buttons.slice(0, 10).each((_, el) => {
            const text = $(el).text().trim();
            const classes = $(el).attr('class');
            const ariaLabel = $(el).attr('aria-label');
            if (text || ariaLabel) {
                console.log(`   - [${classes}] "${text || ariaLabel}"`);
            }
        });

        // Check for JavaScript data
        console.log('\n🔍 LOOKING FOR EMBEDDED DATA:\n');

        const scripts = $('script');
        console.log(`✓ Total script tags: ${scripts.length}`);

        // Look for window.* or data in scripts
        let foundDataScripts = 0;
        scripts.each((_, el) => {
            const content = $(el).html() || '';
            if (content.includes('shows') || content.includes('events') || content.includes('window.')) {
                foundDataScripts++;
            }
        });
        console.log(`✓ Scripts with show/event data: ${foundDataScripts}`);

        // Check for React/Vue app containers
        console.log('\n🔍 LOOKING FOR JAVASCRIPT FRAMEWORKS:\n');

        const dataReact = $('[data-reactroot], [data-react-root]');
        if (dataReact.length > 0) {
            console.log(`✓ React root found: ${dataReact.length}`);
        }

        const vueApp = $('[data-v-app], [id="app"], [id="__nuxt"]');
        if (vueApp.length > 0) {
            console.log(`✓ Vue/Nuxt app found: ${vueApp.length}`);
        }

        const nextApp = $('[id="__next"]');
        if (nextApp.length > 0) {
            console.log(`✓ Next.js app found: ${nextApp.length}`);
        }

        // Check for API endpoints in HTML
        console.log('\n🔍 LOOKING FOR API ENDPOINTS:\n');

        const content = html;
        const apiMatches = content.match(/api['":\s/]*[a-zA-Z0-9/_-]+/gi) || [];
        if (apiMatches.length > 0) {
            const unique = [...new Set(apiMatches)].slice(0, 5);
            console.log(`✓ API endpoints found: ${unique.length}`);
            unique.forEach(api => console.log(`   - ${api}`));
        }

        // List first few shows with full details
        console.log('\n📋 FIRST 10 SHOWS FOUND IN LISTING:\n');

        const showUrls: string[] = [];
        showDivs.slice(0, 10).each((i, el) => {
            const $show = $(el);
            const title = $show.find('h4.title').text().trim();
            const url = $show.find('a[href*="/shows/"]').first().attr('href');
            const venue = $show.find('.location').text().trim();
            const date = $show.find('.date').text().trim();

            console.log(`${i + 1}. ${title}`);
            console.log(`   URL: ${url}`);
            console.log(`   Venue: ${venue}`);
            console.log(`   Date: ${date}\n`);

            if (url) {
                const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
                showUrls.push(fullUrl);
            }
        });

        // Check if there's a "view all" or similar
        console.log('🔍 CHECKING FOR FILTERING/DYNAMIC CONTENT:\n');

        const filterElements = $('[class*="filter"], [class*="view"], [class*="load"]');
        console.log(`✓ Filter/View elements: ${filterElements.length}`);

        if (filterElements.length > 0) {
            filterElements.slice(0, 5).each((_, el) => {
                const text = $(el).text().trim().substring(0, 50);
                const classes = $(el).attr('class');
                console.log(`   - ${classes}: "${text}"`);
            });
        }

        // Save raw HTML for inspection
        fs.writeFileSync('marriner-listing.html', html);
        console.log('\n✅ Listing HTML saved to marriner-listing.html');

        // ====================================
        // PART 2: Analyze Individual Show Pages
        // ====================================
        console.log('\n' + '='.repeat(70));
        console.log('📄 ANALYZING INDIVIDUAL SHOW PAGES\n');

        const numToFetch = Math.min(3, showUrls.length);
        console.log(`Fetching ${numToFetch} show pages for detailed analysis...\n`);

        for (let i = 0; i < numToFetch; i++) {
            const url = showUrls[i];
            console.log(`\n${'─'.repeat(70)}`);
            console.log(`🎭 SHOW ${i + 1}: ${url}\n`);

            try {
                const showResponse = await fetch(url, { headers: HEADERS });
                const showHtml = await showResponse.text();
                const $show = load(showHtml);

                // Save individual show HTML
                const filename = `marriner-show-${i + 1}.html`;
                fs.writeFileSync(filename, showHtml);
                console.log(`✓ Saved to ${filename}`);

                // Analyze structure
                console.log('\n📊 CONTENT STRUCTURE:\n');

                // Title selectors
                console.log('TITLE OPTIONS:');
                const h1 = $show('h1').first().text().trim();
                const h2 = $show('h2').first().text().trim();
                const ogTitle = $show('meta[property="og:title"]').attr('content');
                const pageTitle = $show('title').text().trim();
                
                if (h1) console.log(`  ✓ h1: "${h1.substring(0, 60)}"`);
                if (h2) console.log(`  ✓ h2: "${h2.substring(0, 60)}"`);
                if (ogTitle) console.log(`  ✓ og:title: "${ogTitle.substring(0, 60)}"`);
                if (pageTitle) console.log(`  ✓ <title>: "${pageTitle.substring(0, 60)}"`);

                // Date selectors
                console.log('\nDATE OPTIONS:');
                const possibleDateSelectors = [
                    '.dates',
                    '.date',
                    '[class*="date"]',
                    '[class*="Date"]',
                    '.show-dates',
                    '.event-date',
                    '.performance-dates',
                    'time',
                ];

                possibleDateSelectors.forEach(selector => {
                    const el = $show(selector).first();
                    if (el.length > 0) {
                        const text = el.text().trim();
                        const classes = el.attr('class');
                        if (text) {
                            console.log(`  ✓ ${selector}: "${text}" [${classes}]`);
                        }
                    }
                });

                // Venue selectors
                console.log('\nVENUE OPTIONS:');
                const possibleVenueSelectors = [
                    '.venue',
                    '.location',
                    '[class*="venue"]',
                    '[class*="Venue"]',
                    '[class*="location"]',
                    '[class*="Location"]',
                    '.theatre',
                ];

                possibleVenueSelectors.forEach(selector => {
                    const el = $show(selector).first();
                    if (el.length > 0) {
                        const text = el.text().trim();
                        const classes = el.attr('class');
                        if (text) {
                            console.log(`  ✓ ${selector}: "${text}" [${classes}]`);
                        }
                    }
                });

                // Description/content
                console.log('\nDESCRIPTION OPTIONS:');
                const ogDesc = $show('meta[property="og:description"]').attr('content');
                const metaDesc = $show('meta[name="description"]').attr('content');
                const firstP = $show('p').first().text().trim();

                if (ogDesc) console.log(`  ✓ og:description: "${ogDesc.substring(0, 100)}..."`);
                if (metaDesc) console.log(`  ✓ meta description: "${metaDesc.substring(0, 100)}..."`);
                if (firstP) console.log(`  ✓ first <p>: "${firstP.substring(0, 100)}..."`);

                // Images
                console.log('\nIMAGE OPTIONS:');
                const ogImage = $show('meta[property="og:image"]').attr('content');
                const firstImg = $show('img').first().attr('src');
                const heroImg = $show('[class*="hero"] img, [class*="Hero"] img').first().attr('src');

                if (ogImage) console.log(`  ✓ og:image: ${ogImage}`);
                if (heroImg) console.log(`  ✓ hero img: ${heroImg}`);
                if (firstImg && firstImg !== heroImg) console.log(`  ✓ first img: ${firstImg}`);

                // Price information
                console.log('\nPRICE OPTIONS:');
                const possiblePriceSelectors = [
                    '.price',
                    '[class*="price"]',
                    '[class*="Price"]',
                    '[class*="cost"]',
                    '[class*="ticket"]',
                ];

                let foundPrice = false;
                possiblePriceSelectors.forEach(selector => {
                    $show(selector).each((_, el) => {
                        const text = $show(el).text().trim();
                        if (text && text.match(/\$|price|from/i)) {
                            console.log(`  ✓ ${selector}: "${text}"`);
                            foundPrice = true;
                        }
                    });
                });
                if (!foundPrice) console.log('  ⚠️  No price elements found');

                // Booking/Buy buttons
                console.log('\nBOOKING OPTIONS:');
                const bookingButtons = $show('a[href*="book"], a[href*="ticket"], a[href*="buy"], button:contains("Book"), button:contains("Buy")');
                console.log(`  ✓ Booking buttons/links: ${bookingButtons.length}`);
                bookingButtons.slice(0, 3).each((_, el) => {
                    const text = $show(el).text().trim();
                    const href = $show(el).attr('href');
                    console.log(`    - "${text}" → ${href}`);
                });

                // Look for structured data
                console.log('\nSTRUCTURED DATA:');
                const jsonLd = $show('script[type="application/ld+json"]');
                if (jsonLd.length > 0) {
                    console.log(`  ✓ Found ${jsonLd.length} JSON-LD script(s)`);
                    jsonLd.each((idx, el) => {
                        try {
                            const data = JSON.parse($show(el).html() || '{}');
                            console.log(`    ${idx + 1}. @type: ${data['@type'] || 'unknown'}`);
                            if (data['@type'] === 'Event') {
                                console.log(`       name: ${data.name}`);
                                console.log(`       startDate: ${data.startDate}`);
                                console.log(`       location: ${data.location?.name}`);
                            }
                        } catch (e) {
                            console.log(`    ${idx + 1}. (parse error)`);
                        }
                    });
                } else {
                    console.log('  ⚠️  No JSON-LD structured data found');
                }

                await new Promise(r => setTimeout(r, 1000)); // Rate limiting

            } catch (error) {
                console.error(`  ❌ Error fetching show: ${error}`);
            }
        }

        // ====================================
        // PART 3: Summary and Recommendations
        // ====================================
        console.log('\n' + '='.repeat(70));
        console.log('📋 SUMMARY & RECOMMENDATIONS:\n');

        if (showDivs.length < 10) {
            console.log('⚠️  Only ' + showDivs.length + ' shows in static HTML');
            console.log('\nPossible causes:');
            console.log('1. ✓ Page loads more shows via JavaScript (AJAX/fetch)');
            console.log('2. ✓ Shows are in a React/Vue component that renders dynamically');
            console.log('3. ✓ There\'s pagination or "Load More" button');
            console.log('4. ✓ Shows load as user scrolls (infinite scroll)');
            console.log('\n✅ Solution: Need to use Puppeteer to render JavaScript\n');
        } else {
            console.log('✓ All shows appear to be in static HTML');
            console.log('No JavaScript rendering needed\n');
        }

        console.log('📝 RECOMMENDED SELECTORS FOR SCRAPER:\n');
        console.log('Listing page:');
        console.log('  - Show containers: .shows-grid .show');
        console.log('  - Links: a[href*="/shows/"]');
        console.log('  - Titles: h4.title\n');
        
        console.log('Individual show pages:');
        console.log('  - Title: h1 (fallback: og:title)');
        console.log('  - Date: .dates, .date, [class*="date"]');
        console.log('  - Venue: .venue, .location, [class*="venue"]');
        console.log('  - Description: og:description or first <p>');
        console.log('  - Image: og:image or first img');
        console.log('  - Check saved HTML files for more specific selectors\n');

        console.log('✅ Analysis complete! Review the saved HTML files for details.');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

diagnoseMarriner();
// ============================================
// debugWhatsOnMelbourne.ts
// Debug tool for What's On Melbourne scraping feasibility
// ============================================

import { load } from 'cheerio';
import fs from 'fs';

interface SelectorAnalysis {
  selector: string;
  matchCount: number;
  samples: string[];
}

interface ElementAnalysis {
  tagName: string;
  classes: string[];
  id?: string;
  attributes: Record<string, string>;
  text: string;
  html: string;
}

interface EventCard {
  title?: string;
  description?: string;
  venue?: string;
  date?: string;
  price?: string;
  url?: string;
  imageUrl?: string;
}

interface DebugReport {
  url: string;
  timestamp: string;
  pageTitle: string;
  robotsTxt: string;
  scrapingFeasibility: {
    allowed: boolean;
    hasStructuredData: boolean;
    hasApiEndpoints: boolean;
    requiresJavaScript: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    recommendation: string;
  };
  eventSummary: {
    totalEventCards: number;
    totalEventLinks: number;
    totalImages: number;
    hasPriceInfo: boolean;
    hasDateInfo: boolean;
    hasVenueInfo: boolean;
  };
  selectorAnalysis: {
    eventCards: SelectorAnalysis[];
    titles: SelectorAnalysis[];
    descriptions: SelectorAnalysis[];
    venues: SelectorAnalysis[];
    dates: SelectorAnalysis[];
    prices: SelectorAnalysis[];
    links: SelectorAnalysis[];
    images: SelectorAnalysis[];
  };
  extractedEvents: EventCard[];
  detailPageAnalysis?: {
    title?: string;
    venue?: string;
    address?: string;
    dates?: string[];
    priceRange?: string;
    description?: string;
    bookingUrl?: string;
    structuredData?: any;
  };
  recommendations: string[];
  suggestedSelectors: Record<string, string>;
}

/**
 * Check robots.txt compliance
 */
async function checkRobotsTxt(): Promise<{ allowed: boolean; content: string }> {
  try {
    const response = await fetch('https://whatson.melbourne.vic.gov.au/robots.txt');
    const content = await response.text();

    // Check if /things-to-do or /tags are disallowed
    const disallowedPaths = content
      .split('\n')
      .filter(line => line.toLowerCase().startsWith('disallow:'))
      .map(line => line.split(':')[1]?.trim());

    const isAllowed = !disallowedPaths.some(path =>
      path && (path.includes('/things-to-do') || path.includes('/tags'))
    );

    return { allowed: isAllowed, content };
  } catch (error) {
    return { allowed: true, content: 'Unable to fetch robots.txt' };
  }
}

/**
 * Analyze selector matches with detailed samples
 */
function analyzeSelectorMatches(
  $: any,
  selector: string,
  limit: number = 3
): SelectorAnalysis {
  const matches = $(selector);
  const samples: string[] = [];

  matches.slice(0, limit).each((_: any, el: any) => {
    const $el = $(el);
    const text = $el.text().trim().substring(0, 80);
    const href = $el.attr('href') || $el.find('a').first().attr('href') || '';
    const classes = $el.attr('class') || '';
    samples.push(`"${text}" [href: ${href}] [class: ${classes.substring(0, 30)}]`);
  });

  return { selector, matchCount: matches.length, samples };
}

/**
 * Analyze element structure
 */
function analyzeElement($: any, element: any): ElementAnalysis {
  const $el = $(element);
  const classes = $el.attr('class')?.split(' ') || [];

  return {
    tagName: $el.prop('tagName')?.toLowerCase() || 'unknown',
    classes: classes.filter(Boolean),
    id: $el.attr('id') || undefined,
    attributes: {
      href: $el.attr('href') || $el.find('a').first().attr('href') || '',
      src: $el.attr('src') || $el.find('img').first().attr('src') || '',
      'data-*': Object.keys($el.attr() || {})
        .filter(k => k.startsWith('data-'))
        .join(', '),
    },
    text: $el.text().trim().substring(0, 100),
    html: $.html($el).substring(0, 200),
  };
}

/**
 * Try to extract event cards from listing page
 */
function extractEventCards($: any): EventCard[] {
  const events: EventCard[] = [];

  // Try common patterns for event cards
  const cardSelectors = [
    'article',
    '[class*="card"]',
    '[class*="event"]',
    '[class*="listing"]',
    '.result',
    '[data-event]',
  ];

  for (const selector of cardSelectors) {
    const cards = $(selector);

    if (cards.length > 0) {
      cards.slice(0, 5).each((_: any, card: any) => {
        const $card = $(card);

        const title = $card.find('h1, h2, h3, h4, [class*="title"]').first().text().trim();
        const description = $card.find('p, [class*="description"]').first().text().trim();
        const venue = $card.find('[class*="venue"], [class*="location"]').first().text().trim();
        const date = $card.find('time, [class*="date"]').first().text().trim();
        const price = $card.find('[class*="price"]').first().text().trim();
        const url = $card.find('a').first().attr('href');
        const imageUrl = $card.find('img').first().attr('src');

        if (title) {
          events.push({
            title,
            description: description.substring(0, 100),
            venue,
            date,
            price,
            url,
            imageUrl,
          });
        }
      });

      if (events.length > 0) break;
    }
  }

  return events;
}

/**
 * Analyze detail page structure
 */
async function analyzeDetailPage(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    const html = await response.text();
    const $ = load(html);

    // Look for structured data (JSON-LD)
    const structuredData: any[] = [];
    $('script[type="application/ld+json"]').each((_: any, el: any) => {
      try {
        structuredData.push(JSON.parse($(el).html() || '{}'));
      } catch (e) {
        // Ignore parse errors
      }
    });

    return {
      title: $('h1').first().text().trim(),
      venue: $('[class*="venue"], [class*="location"]').first().text().trim(),
      address: $('[class*="address"]').first().text().trim(),
      dates: $('time, [class*="date"]').map((_: any, el: any) => $(el).text().trim()).get(),
      priceRange: $('[class*="price"]').first().text().trim(),
      description: $('meta[name="description"]').attr('content') ||
        $('p').first().text().trim().substring(0, 200),
      bookingUrl: $('a[href*="book"], a[href*="ticket"], a[class*="book"]').first().attr('href'),
      structuredData: structuredData.length > 0 ? structuredData[0] : null,
    };
  } catch (error) {
    return { error: 'Failed to fetch detail page' };
  }
}

/**
 * Assess scraping feasibility
 */
function assessFeasibility($: any, robotsAllowed: boolean): any {
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;
  const hasApiEndpoints = $.html().includes('/api/') || $.html().includes('data-api');
  const hasReactOrVue = $.html().includes('__NEXT_DATA__') ||
    $.html().includes('data-react') ||
    $.html().includes('data-v-');

  const eventLinks = $('a[href*="/things-to-do"]').length;
  const hasContent = eventLinks > 0;

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let recommendation = '';

  if (!robotsAllowed) {
    riskLevel = 'high';
    recommendation = '❌ STOP: robots.txt disallows scraping. Do not proceed.';
  } else if (!hasContent) {
    riskLevel = 'high';
    recommendation = '⚠️  Content appears to be dynamically loaded. Requires JavaScript rendering (Puppeteer).';
  } else if (hasStructuredData) {
    riskLevel = 'low';
    recommendation = '✅ IDEAL: Structured data (JSON-LD) available. Use schema.org extraction.';
  } else if (hasReactOrVue) {
    riskLevel = 'medium';
    recommendation = '⚠️  React/Vue app detected. May need Puppeteer or check for API endpoints.';
  } else {
    riskLevel = 'low';
    recommendation = '✅ GOOD: Static HTML content. Use Cheerio with standard selectors.';
  }

  return {
    allowed: robotsAllowed,
    hasStructuredData,
    hasApiEndpoints,
    requiresJavaScript: !hasContent || hasReactOrVue,
    riskLevel,
    recommendation,
  };
}

/**
 * Generate scraping recommendations
 */
function generateRecommendations($: any, feasibility: any): string[] {
  const recs: string[] = [];

  recs.push('=== SCRAPING STRATEGY ===');
  recs.push(feasibility.recommendation);
  recs.push('');

  if (feasibility.hasStructuredData) {
    recs.push('✅ Use JSON-LD structured data (schema.org Event format)');
    recs.push('   - Extract from <script type="application/ld+json">');
    recs.push('   - This is the most reliable method');
  }

  const eventLinks = $('a[href*="/things-to-do"]').length;
  if (eventLinks > 0) {
    recs.push(`✅ Found ${eventLinks} event links`);
    recs.push('   - Scrape listing pages for URLs');
    recs.push('   - Then fetch individual event pages');
  }

  recs.push('');
  recs.push('=== RATE LIMITING ===');
  recs.push('• Add 1-2 second delays between requests');
  recs.push('• Respect robots.txt crawl-delay if specified');
  recs.push('• Limit concurrent requests to 1-2 max');
  recs.push('• Run scraper during off-peak hours');

  recs.push('');
  recs.push('=== CATEGORIES TO SCRAPE ===');
  recs.push('• /tags/theatre - Theatre events');
  recs.push('• /tags/music - Music events');
  recs.push('• /tags/festivals - Festival events');
  recs.push('• /tags/family - Family events');

  return recs;
}

/**
 * Suggest optimal selectors
 */
function suggestSelectors($: any): Record<string, string> {
  const suggestions: Record<string, string> = {};

  // Event cards - What's On Melbourne specific
  suggestions.eventCard = '.page-preview';
  suggestions.eventLink = '.page-preview a.main-link[href*="/things-to-do/"]';
  suggestions.title = 'h2.title';
  suggestions.summary = 'p.summary';
  suggestions.image = 'img.page_image';

  // Dates
  if ($('time[datetime]').length > 0) {
    suggestions.date = 'time[datetime]';
  }

  // On detail pages
  suggestions.detailTitle = 'h1';
  suggestions.detailVenue = '[class*="venue"], [class*="location"]';
  suggestions.detailPrice = '[class*="price"]';

  return suggestions;
}

/**
 * Main debug function
 */
export async function debugWhatsOnMelbourne(
  category: string = 'theatre',
  outputFile: string = 'whatson-debug-report.json'
): Promise<DebugReport> {
  const url = `https://whatson.melbourne.vic.gov.au/tags/${category}`;

  console.log('🔍 Debugging What\'s On Melbourne');
  console.log(`   URL: ${url}\n`);

  try {
    // Step 1: Check robots.txt
    console.log('🤖 Checking robots.txt...');
    const { allowed, content } = await checkRobotsTxt();
    console.log(`   ${allowed ? '✅ Allowed' : '❌ Disallowed'}\n`);

    // Step 2: Fetch listing page
    console.log('📥 Fetching listing page...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);

    // Step 3: Analyze page structure
    console.log('📊 Analyzing page structure...');

    const selectorAnalysis = {
      eventCards: [
        '.page-preview',
        '[data-listing-type="event"]',
      ].map(sel => analyzeSelectorMatches($, sel, 3)),

      titles: [
        'h2.title',
        '.page-preview h2',
      ].map(sel => analyzeSelectorMatches($, sel, 3)),

      descriptions: [
        'p.summary',
        '.page-preview p',
      ].map(sel => analyzeSelectorMatches($, sel, 3)),

      venues: [
        '[class*="venue"]',
        '[class*="location"]',
      ].map(sel => analyzeSelectorMatches($, sel, 2)),

      dates: [
        'time[datetime]',
        '.from-to-date',
      ].map(sel => analyzeSelectorMatches($, sel, 3)),

      prices: [
        '[class*="price"]',
      ].map(sel => analyzeSelectorMatches($, sel, 2)),

      links: [
        '.page-preview a.main-link',
        'a[href*="/things-to-do/"]',
      ].map(sel => analyzeSelectorMatches($, sel, 3)),

      images: [
        'img.page_image',
        '.page-preview img',
      ].map(sel => analyzeSelectorMatches($, sel, 3)),
    };

    // Step 4: Extract sample events
    console.log('📝 Extracting sample events...');
    const extractedEvents = extractEventCards($);

    // Step 5: Analyze detail page (if we found events)
    let detailPageAnalysis;
    if (extractedEvents.length > 0 && extractedEvents[0].url) {
      console.log('🔍 Analyzing detail page...');
      const detailUrl = extractedEvents[0].url.startsWith('http')
        ? extractedEvents[0].url
        : `https://whatson.melbourne.vic.gov.au${extractedEvents[0].url}`;
      detailPageAnalysis = await analyzeDetailPage(detailUrl);
    }

    // Step 6: Assess feasibility
    const feasibility = assessFeasibility($, allowed);

    const report: DebugReport = {
      url,
      timestamp: new Date().toISOString(),
      pageTitle: $('title').text(),
      robotsTxt: content,
      scrapingFeasibility: feasibility,
      eventSummary: {
        totalEventCards: $('.page-preview').length,
        totalEventLinks: $('.page-preview a.main-link[href*="/things-to-do/"]').length,
        totalImages: $('img.page_image').length,
        hasPriceInfo: $('[class*="price"]').length > 0,
        hasDateInfo: $('time[datetime]').length > 0,
        hasVenueInfo: $('[class*="venue"], [class*="location"]').length > 0,
      },
      selectorAnalysis,
      extractedEvents,
      detailPageAnalysis,
      recommendations: generateRecommendations($, feasibility),
      suggestedSelectors: suggestSelectors($),
    };

    // Save report
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
    console.log(`\n✅ Report saved to: ${outputFile}`);

    // Print summary
    console.log('\n📋 FEASIBILITY ASSESSMENT:');
    console.log(`   Risk Level: ${feasibility.riskLevel.toUpperCase()}`);
    console.log(`   ${feasibility.recommendation}`);
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Event Links: ${report.eventSummary.totalEventLinks}`);
    console.log(`   Extracted Events: ${extractedEvents.length}`);
    console.log(`   Has Structured Data: ${feasibility.hasStructuredData ? 'Yes' : 'No'}`);

    return report;

  } catch (error) {
    console.error('❌ Debug failed:', error);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const category = process.argv[2] || 'theatre';
  const output = process.argv[3] || `whatson-${category}-debug.json`;
  debugWhatsOnMelbourne(category, output).catch(console.error);
}
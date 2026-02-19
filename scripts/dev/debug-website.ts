// ============================================
// debug-website.ts
// Generic website scraping feasibility analyser
// Analyses page structure, content loading, and recommends scraping approach
// Usage: tsx scripts/dev/debug-website.ts <url> [output-file]
// Example: tsx scripts/dev/debug-website.ts https://example.com/events report.json
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

interface ContentCard {
  title?: string;
  description?: string;
  metadata?: string;
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
  contentSummary: {
    totalLinks: number;
    totalImages: number;
    totalCards: number;
    hasPriceInfo: boolean;
    hasDateInfo: boolean;
    hasMetadata: boolean;
  };
  selectorAnalysis: {
    cards: SelectorAnalysis[];
    titles: SelectorAnalysis[];
    descriptions: SelectorAnalysis[];
    metadata: SelectorAnalysis[];
    dates: SelectorAnalysis[];
    prices: SelectorAnalysis[];
    links: SelectorAnalysis[];
    images: SelectorAnalysis[];
  };
  extractedSamples: ContentCard[];
  structuredData: any[];
  recommendations: string[];
  suggestedSelectors: Record<string, string>;
}

/**
 * Check robots.txt compliance for the given domain
 */
async function checkRobotsTxt(url: string): Promise<{ allowed: boolean; content: string }> {
  try {
    const urlObj = new URL(url);
    const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
    
    const response = await fetch(robotsUrl);
    const content = await response.text();

    const pathname = urlObj.pathname;
    const disallowedPaths = content
      .split('\n')
      .filter(line => line.toLowerCase().startsWith('disallow:'))
      .map(line => line.split(':')[1]?.trim());

    const isAllowed = !disallowedPaths.some(path =>
      path && pathname.startsWith(path)
    );

    return { allowed: isAllowed, content };
  } catch (error) {
    return { allowed: true, content: 'Unable to fetch robots.txt' };
  }
}

/**
 * Analyse selector matches with detailed samples
 */
function analyseSelectorMatches(
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
 * Try to extract content cards using common patterns
 */
function extractContentCards($: any): ContentCard[] {
  const cards: ContentCard[] = [];

  const cardSelectors = [
    'article',
    '[class*="card"]',
    '[class*="event"]',
    '[class*="item"]',
    '[class*="listing"]',
    '[class*="result"]',
    '[class*="preview"]',
    '[data-event]',
    '[data-item]',
  ];

  for (const selector of cardSelectors) {
    const elements = $(selector);

    if (elements.length > 0) {
      elements.slice(0, 5).each((_: any, card: any) => {
        const $card = $(card);

        const title = $card.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
        const description = $card.find('p, [class*="description"], [class*="summary"]').first().text().trim();
        const metadata = $card.find('[class*="meta"], [class*="venue"], [class*="location"]').first().text().trim();
        const date = $card.find('time, [class*="date"], [datetime]').first().text().trim();
        const price = $card.find('[class*="price"], [class*="cost"]').first().text().trim();
        const url = $card.find('a').first().attr('href');
        const imageUrl = $card.find('img').first().attr('src');

        if (title) {
          cards.push({
            title,
            description: description.substring(0, 100),
            metadata,
            date,
            price,
            url,
            imageUrl,
          });
        }
      });

      if (cards.length > 0) break;
    }
  }

  return cards;
}

/**
 * Extract structured data (JSON-LD) from the page
 */
function extractStructuredData($: any): any[] {
  const structuredData: any[] = [];
  
  $('script[type="application/ld+json"]').each((_: any, el: any) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      structuredData.push(json);
    } catch (e) {
      // Ignore parse errors
    }
  });

  return structuredData;
}

/**
 * Assess scraping feasibility and recommend approach
 */
function assessFeasibility($: any, robotsAllowed: boolean, structuredData: any[]): any {
  const hasStructuredData = structuredData.length > 0;
  const hasApiEndpoints = $.html().includes('/api/') || $.html().includes('data-api');
  const hasReactOrVue = $.html().includes('__NEXT_DATA__') ||
    $.html().includes('data-react') ||
    $.html().includes('data-v-') ||
    $.html().includes('ng-app');

  const totalLinks = $('a[href]').length;
  const hasContent = totalLinks > 10;

  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  let recommendation = '';

  if (!robotsAllowed) {
    riskLevel = 'high';
    recommendation = 'STOP: robots.txt disallows scraping this path. Do not proceed.';
  } else if (!hasContent) {
    riskLevel = 'high';
    recommendation = 'Content appears to be dynamically loaded. Requires JavaScript rendering (Puppeteer/Playwright).';
  } else if (hasStructuredData) {
    riskLevel = 'low';
    recommendation = 'IDEAL: Structured data (JSON-LD) available. Use schema.org extraction with Cheerio.';
  } else if (hasReactOrVue) {
    riskLevel = 'medium';
    recommendation = 'React/Vue/Angular app detected. May need Puppeteer or check for API endpoints.';
  } else {
    riskLevel = 'low';
    recommendation = 'GOOD: Static HTML content. Use Cheerio with standard selectors.';
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
 * Generate scraping recommendations based on analysis
 */
function generateRecommendations($: any, feasibility: any, structuredData: any[]): string[] {
  const recs: string[] = [];

  recs.push('SCRAPING STRATEGY');
  recs.push('-'.repeat(70));
  recs.push(feasibility.recommendation);
  recs.push('');

  if (feasibility.hasStructuredData) {
    recs.push('Recommended approach: Extract JSON-LD structured data');
    recs.push('  - Look for <script type="application/ld+json">');
    recs.push('  - Parse as JSON and extract schema.org fields');
    recs.push('  - This is the most reliable method');
    
    if (structuredData.length > 0) {
      recs.push(`  - Found ${structuredData.length} structured data block(s)`);
      const types = structuredData.map(d => d['@type']).filter(Boolean);
      if (types.length > 0) {
        recs.push(`  - Types detected: ${types.join(', ')}`);
      }
    }
  } else if (feasibility.requiresJavaScript) {
    recs.push('Recommended approach: Use Puppeteer or Playwright');
    recs.push('  - Content is loaded dynamically with JavaScript');
    recs.push('  - Wait for content to render before scraping');
    recs.push('  - Consider checking network tab for API endpoints');
  } else {
    recs.push('Recommended approach: Use Cheerio (static HTML)');
    recs.push('  - Content is available in initial HTML');
    recs.push('  - Fast and efficient parsing');
    recs.push('  - Use CSS selectors to extract data');
  }

  recs.push('');
  recs.push('RATE LIMITING');
  recs.push('-'.repeat(70));
  recs.push('  - Add 1-2 second delays between requests');
  recs.push('  - Respect robots.txt crawl-delay if specified');
  recs.push('  - Limit concurrent requests to 1-2 maximum');
  recs.push('  - Run scraper during off-peak hours');
  recs.push('  - Use polite User-Agent string');

  recs.push('');
  recs.push('BEST PRACTICES');
  recs.push('-'.repeat(70));
  recs.push('  - Always check robots.txt before scraping');
  recs.push('  - Implement exponential backoff for errors');
  recs.push('  - Cache results to minimise requests');
  recs.push('  - Monitor for changes in page structure');
  recs.push('  - Have fallback selectors for critical data');

  return recs;
}

/**
 * Suggest optimal selectors based on page analysis
 */
function suggestSelectors($: any): Record<string, string> {
  const suggestions: Record<string, string> = {};

  // Try to find main content containers
  const cardSelectors = ['article', '[class*="card"]', '[class*="item"]', '[class*="event"]'];
  for (const sel of cardSelectors) {
    if ($(sel).length > 0) {
      suggestions.contentCard = sel;
      break;
    }
  }

  // Find title selectors
  if ($('h1, h2, h3').length > 0) {
    suggestions.title = 'h1, h2, h3, [class*="title"]';
  }

  // Find description selectors
  if ($('p').length > 0) {
    suggestions.description = 'p, [class*="description"], [class*="summary"]';
  }

  // Find link selectors
  if ($('a[href]').length > 0) {
    suggestions.link = 'a[href]';
  }

  // Find image selectors
  if ($('img').length > 0) {
    suggestions.image = 'img';
  }

  // Find date/time selectors
  if ($('time[datetime]').length > 0) {
    suggestions.date = 'time[datetime]';
  } else if ($('[class*="date"]').length > 0) {
    suggestions.date = '[class*="date"]';
  }

  // Find price selectors
  if ($('[class*="price"]').length > 0) {
    suggestions.price = '[class*="price"]';
  }

  return suggestions;
}

/**
 * Main debug function
 */
export async function debugWebsite(
  url: string,
  outputFile: string = 'website-debug-report.json'
): Promise<DebugReport> {
  console.log('========================================================');
  console.log('Website Scraping Feasibility Analysis');
  console.log('========================================================\n');
  console.log(`URL: ${url}\n`);

  try {
    // Step 1: Check robots.txt
    console.log('Step 1: Checking robots.txt...');
    const { allowed, content } = await checkRobotsTxt(url);
    console.log(`Robots.txt: ${allowed ? 'Allowed' : 'Disallowed'}\n`);

    // Step 2: Fetch page
    console.log('Step 2: Fetching page...');
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
    console.log('Page fetched successfully\n');

    // Step 3: Extract structured data
    console.log('Step 3: Extracting structured data...');
    const structuredData = extractStructuredData($);
    console.log(`Found ${structuredData.length} structured data block(s)\n`);

    // Step 4: Analyse page structure
    console.log('Step 4: Analysing page structure...');

    const selectorAnalysis = {
      cards: [
        'article',
        '[class*="card"]',
        '[class*="event"]',
        '[class*="item"]',
      ].map(sel => analyseSelectorMatches($, sel, 3)),

      titles: [
        'h1',
        'h2',
        '[class*="title"]',
      ].map(sel => analyseSelectorMatches($, sel, 3)),

      descriptions: [
        'p',
        '[class*="description"]',
        '[class*="summary"]',
      ].map(sel => analyseSelectorMatches($, sel, 3)),

      metadata: [
        '[class*="meta"]',
        '[class*="venue"]',
        '[class*="location"]',
      ].map(sel => analyseSelectorMatches($, sel, 2)),

      dates: [
        'time[datetime]',
        '[class*="date"]',
      ].map(sel => analyseSelectorMatches($, sel, 3)),

      prices: [
        '[class*="price"]',
        '[class*="cost"]',
      ].map(sel => analyseSelectorMatches($, sel, 2)),

      links: [
        'a[href]',
      ].map(sel => analyseSelectorMatches($, sel, 5)),

      images: [
        'img[src]',
      ].map(sel => analyseSelectorMatches($, sel, 3)),
    };

    // Step 5: Extract sample content
    console.log('Step 5: Extracting sample content...');
    const extractedSamples = extractContentCards($);
    console.log(`Extracted ${extractedSamples.length} sample(s)\n`);

    // Step 6: Assess feasibility
    console.log('Step 6: Assessing scraping feasibility...');
    const feasibility = assessFeasibility($, allowed, structuredData);

    const report: DebugReport = {
      url,
      timestamp: new Date().toISOString(),
      pageTitle: $('title').text(),
      robotsTxt: content,
      scrapingFeasibility: feasibility,
      contentSummary: {
        totalLinks: $('a[href]').length,
        totalImages: $('img').length,
        totalCards: $('article, [class*="card"], [class*="item"]').length,
        hasPriceInfo: $('[class*="price"]').length > 0,
        hasDateInfo: $('time, [class*="date"]').length > 0,
        hasMetadata: $('[class*="meta"], [class*="venue"]').length > 0,
      },
      selectorAnalysis,
      extractedSamples,
      structuredData,
      recommendations: generateRecommendations($, feasibility, structuredData),
      suggestedSelectors: suggestSelectors($),
    };

    // Save report
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
    console.log(`Report saved to: ${outputFile}\n`);

    // Print summary
    console.log('========================================================');
    console.log('Feasibility Assessment');
    console.log('========================================================');
    console.log(`Risk level:          ${feasibility.riskLevel.toUpperCase()}`);
    console.log(`Recommendation:      ${feasibility.recommendation}`);
    console.log(`Structured data:     ${feasibility.hasStructuredData ? 'Yes' : 'No'}`);
    console.log(`Requires JavaScript: ${feasibility.requiresJavaScript ? 'Yes' : 'No'}`);
    console.log('========================================================\n');

    console.log('Content Summary');
    console.log('========================================================');
    console.log(`Total links:         ${report.contentSummary.totalLinks}`);
    console.log(`Total cards:         ${report.contentSummary.totalCards}`);
    console.log(`Extracted samples:   ${extractedSamples.length}`);
    console.log('========================================================\n');

    return report;

  } catch (error) {
    console.error('Debug failed:', error);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const url = process.argv[2];
  const output = process.argv[3] || 'website-debug-report.json';

  if (!url) {
    console.error('Usage: tsx scripts/dev/debug-website.ts <url> [output-file]');
    console.error('Example: tsx scripts/dev/debug-website.ts https://example.com/events report.json');
    process.exit(1);
  }

  debugWebsite(url, output).catch(console.error);
}
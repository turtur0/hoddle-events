// ============================================
// debugMarriner.ts - Lightweight Debug Tool
// Analyzes HTML structure without Puppeteer
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

interface DebugReport {
  url: string;
  timestamp: string;
  pageTitle: string;
  showSummary: {
    totalShowLinks: number;
    totalImages: number;
    totalTimeElements: number;
    totalPriceElements: number;
  };
  selectorAnalysis: {
    showContainers: SelectorAnalysis[];
    titles: SelectorAnalysis[];
    venues: SelectorAnalysis[];
    dates: SelectorAnalysis[];
    prices: SelectorAnalysis[];
    images: SelectorAnalysis[];
  };
  sampleElements: {
    showContainers: ElementAnalysis[];
    titles: ElementAnalysis[];
    venues: ElementAnalysis[];
    dates: ElementAnalysis[];
    prices: ElementAnalysis[];
    images: ElementAnalysis[];
  };
  domTree: string;
  recommendations: string[];
}

/**
 * Analyze a selector and return matching elements with samples
 */
function analyzeSelectorMatches(
  $: any,
  selector: string,
  limit: number = 3
): SelectorAnalysis {
  const matches = $(selector);
  const samples: string[] = [];

  matches.slice(0, limit).each((_: any, el: any) => {
    const text = $(el).text().trim().substring(0, 100);
    const html = $(el).html()?.substring(0, 150) || '';
    samples.push(`Text: "${text}" | HTML: "${html}..."`);
  });

  return {
    selector,
    matchCount: matches.length,
    samples,
  };
}

/**
 * Extract detailed analysis of an element
 */
function analyzeElement($: any, element: any): ElementAnalysis {
  const $el = $(element);
  const classes = $el.attr('class')?.split(' ') || [];

  return {
    tagName: $el.prop('tagName')?.toLowerCase() || 'unknown',
    classes: classes.filter(Boolean),
    id: $el.attr('id') || undefined,
    attributes: {
      href: $el.attr('href') || '',
      src: $el.attr('src') || '',
      'data-*': Object.keys($el.attr() || {})
        .filter(k => k.startsWith('data-'))
        .join(', '),
    },
    text: $el.text().trim().substring(0, 80),
    html: $el.html()?.substring(0, 150) || '',
  };
}

/**
 * Create a simplified DOM tree for visual inspection
 */
function createDomTree($: any, depth: number = 3): string {
  let tree = '';
  let indent = 0;

  function traverse(element: any, currentDepth: number) {
    if (currentDepth > depth) return;

    const $el = $(element);
    const tag = $el.prop('tagName')?.toLowerCase();
    const classes = $el.attr('class')?.split(' ').slice(0, 2).join('.') || '';
    const id = $el.attr('id') ? `#${$el.attr('id')}` : '';
    const info = `${tag}${id ? ' ' + id : ''}${classes ? '.' + classes : ''}`;

    tree += '  '.repeat(indent) + info + '\n';

    if (currentDepth < depth) {
      $el.children().slice(0, 5).each((_: any, child: any) => {
        indent++;
        traverse(child, currentDepth + 1);
        indent--;
      });

      if ($el.children().length > 5) {
        tree += '  '.repeat(indent + 1) + '... and more\n';
      }
    }
  }

  traverse($.root(), 0);
  return tree;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations($: any): string[] {
  const recommendations: string[] = [];

  // Check for common patterns
  const hasDataAttrs = $('[data-show], [data-event], [data-item]').length > 0;
  if (hasDataAttrs) {
    recommendations.push('✓ Uses data attributes - these are ideal for scraping');
  }

  const hasAria = $('[role], [aria-label]').length > 0;
  if (hasAria) {
    recommendations.push('✓ Uses semantic ARIA attributes - good for selection');
  }

  const hasTimeElements = $('time').length > 0;
  if (hasTimeElements) {
    recommendations.push('✓ Uses <time> elements with datetime - structured date extraction');
  }

  const hasMicrodata = $('[itemscope], [itemtype]').length > 0;
  if (hasMicrodata) {
    recommendations.push('✓ Uses microdata - structured data available');
  }

  const showLinks = $('a[href*="/shows/"]').length;
  if (showLinks === 0) {
    recommendations.push('⚠️  No /shows/ links found - check URL patterns');
  }

  const images = $('img').length;
  if (images === 0) {
    recommendations.push('⚠️  No images found - may be lazy-loaded');
  }

  const prices = $(':contains("$")').length;
  if (prices === 0) {
    recommendations.push('⚠️  No price indicators found - check if data is present');
  }

  recommendations.push('');
  recommendations.push('--- NEXT STEPS ---');
  recommendations.push('1. Review "sampleElements" section for actual extracted content');
  recommendations.push('2. Test selectors in browser console with: $(\'.your-selector\')');
  recommendations.push('3. Look for patterns in class names and data attributes');
  recommendations.push('4. Check if content is dynamically loaded with JavaScript');

  return recommendations;
}

/**
 * Main debug function
 */
export async function debugMarrinerPage(
  url: string = 'https://marrinergroup.com.au/shows',
  outputFile: string = 'debug-report.json'
): Promise<DebugReport> {
  console.log(`🔍 Debugging: ${url}`);
  console.log('📥 Fetching page...');

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);

    console.log('📊 Analyzing selectors...');

    const showContainerSelectors = [
      'a[href*="/shows/"]',
      '[class*="show"]',
      '[class*="event"]',
      '[class*="card"]',
      'article',
    ];

    const titleSelectors = [
      'h1', 'h2', 'h3', 'h4',
      '[class*="title"]',
      '[class*="heading"]',
      '.name',
    ];

    const venueSelectors = [
      '[class*="venue"]',
      '[data-venue]',
      '.venue',
      '.location',
      '[class*="location"]',
    ];

    const dataAttrSelectors = [
      '[data-show]',
      '[data-event]',
      '[data-item]',
    ];

    const dateSelectors = [
      'time',
      '[class*="date"]',
      '[data-date]',
      '.date',
    ];

    const priceSelectors = [
      '[class*="price"]',
      '[class*="ticket"]',
      '.price',
      ':contains("$")',
    ];

    const imageSelectors = [
      'img[src*="show"]',
      'img[src*="event"]',
      '[class*="hero"] img',
      'img',
    ];

    // Analyze each selector category
    const selectorAnalysis = {
      showContainers: showContainerSelectors.map(sel => analyzeSelectorMatches($, sel)),
      titles: titleSelectors.map(sel => analyzeSelectorMatches($, sel)),
      venues: venueSelectors.map(sel => analyzeSelectorMatches($, sel)),
      dates: dateSelectors.map(sel => analyzeSelectorMatches($, sel)),
      prices: priceSelectors.map(sel => analyzeSelectorMatches($, sel, 2)),
      images: imageSelectors.map(sel => analyzeSelectorMatches($, sel, 2)),
    };

    // Get sample elements
    console.log('📝 Extracting sample elements...');

    const sampleElements = {
      showContainers: $('a[href*="/shows/"], [class*="show"]')
        .slice(0, 2)
        .map((_, el) => analyzeElement($, el))
        .get(),
      titles: $('h2, h3, [class*="title"]')
        .slice(0, 2)
        .map((_, el) => analyzeElement($, el))
        .get(),
      venues: $('[class*="venue"], [data-venue]')
        .slice(0, 2)
        .map((_, el) => analyzeElement($, el))
        .get(),
      dates: $('time, [class*="date"]')
        .slice(0, 2)
        .map((_, el) => analyzeElement($, el))
        .get(),
      prices: $('[class*="price"]')
        .slice(0, 2)
        .map((_, el) => analyzeElement($, el))
        .get(),
      images: $('img')
        .slice(0, 2)
        .map((_, el) => analyzeElement($, el))
        .get(),
    };

    const report: DebugReport = {
      url,
      timestamp: new Date().toISOString(),
      pageTitle: $('title').text(),
      showSummary: {
        totalShowLinks: $('a[href*="/shows/"]').length,
        totalImages: $('img').length,
        totalTimeElements: $('time').length,
        totalPriceElements: $('[class*="price"]').length,
      },
      selectorAnalysis,
      sampleElements,
      domTree: createDomTree($, 4),
      recommendations: generateRecommendations($),
    };

    // Save report
    fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
    console.log(`✅ Debug report saved to: ${outputFile}`);

    // Print summary
    console.log('\n📋 SUMMARY:');
    console.log(`   Page Title: ${report.pageTitle}`);
    console.log(`   Show Links: ${report.showSummary.totalShowLinks}`);
    console.log(`   Images: ${report.showSummary.totalImages}`);
    console.log(`   Time Elements: ${report.showSummary.totalTimeElements}`);
    console.log(`   Price Elements: ${report.showSummary.totalPriceElements}`);
    console.log('\n💡 Recommendations:');
    report.recommendations.slice(0, 5).forEach(r => console.log(`   ${r}`));

    return report;

  } catch (error) {
    console.error('❌ Error during debug:', error);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const url = process.argv[2] || 'https://marrinergroup.com.au/shows';
  const output = process.argv[3] || 'debug-report.json';
  debugMarrinerPage(url, output).catch(console.error);
}
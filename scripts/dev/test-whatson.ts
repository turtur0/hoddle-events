// ============================================
// test-whatson-debug.ts
// Run the What's On Melbourne debug analysis
// ============================================

import { debugWhatsOnMelbourne } from "./test-website";

async function runDebugTests() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  What\'s On Melbourne - Scraping Feasibility Analysis');
  console.log('═══════════════════════════════════════════════════════\n');

  // Test 1: Theatre category
  console.log('TEST 1: Theatre Category');
  console.log('─'.repeat(70));
  try {
    const theatreReport = await debugWhatsOnMelbourne('theatre', 'debug-whatson-theatre.json');
    console.log('\n✅ Theatre analysis complete\n');
  } catch (error) {
    console.error('❌ Theatre analysis failed:', error);
  }

  // Wait between tests
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Music category
  console.log('\nTEST 2: Music Category');
  console.log('─'.repeat(70));
  try {
    const musicReport = await debugWhatsOnMelbourne('music', 'debug-whatson-music.json');
    console.log('\n✅ Music analysis complete\n');
  } catch (error) {
    console.error('❌ Music analysis failed:', error);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Analysis Complete');
  console.log('═══════════════════════════════════════════════════════');
  console.log('\nCheck the generated JSON files for detailed analysis:');
  console.log('  • debug-whatson-theatre.json');
  console.log('  • debug-whatson-music.json\n');
}

runDebugTests().catch(console.error);
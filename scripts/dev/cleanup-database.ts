import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/lib/db';
import Event from '@/lib/models/Event';
import {
  findDuplicates,
  findSameSourceDuplicates,
} from '@/lib/utils/deduplication';
import type { EventForDedup } from '@/lib/scrapers/types';

interface CleanupStats {
  wronglyArchived: number;
  duplicateClusters: number;
  eventsMerged: number;
  eventsDeleted: number;
  errors: number;
}

const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Two-phase database cleanup:
 * 1. Find all duplicate clusters across ALL events (active + archived),
 *    merge into one canonical record, delete the rest, then set isArchived
 *    purely based on whether the event date has passed — not on what the
 *    duplicates had. This handles messy data where the same event has some
 *    copies archived and some not.
 * 2. Fix any remaining wrongly archived events (future events marked archived).
 */
async function cleanupDatabase(): Promise<void> {
  console.log(`\n[Cleanup] Starting${DRY_RUN ? ' (DRY RUN)' : ''}...`);
  await connectDB();

  const stats: CleanupStats = {
    wronglyArchived: 0,
    duplicateClusters: 0,
    eventsMerged: 0,
    eventsDeleted: 0,
    errors: 0,
  };

  try {
    await phase1_mergeAllDuplicates(stats);
    await phase2_fixArchiveStatus(stats);
  } finally {
    await disconnectDB();
  }

  displaySummary(stats);
}

// ---------------------------------------------------------------------------
// Phase 1: Merge all duplicates across active + archived
// ---------------------------------------------------------------------------

/**
 * Loads every event, finds duplicate clusters (same-source and cross-source),
 * merges all data into one canonical record, deletes the rest, then corrects
 * isArchived based purely on the event's actual dates.
 *
 * This handles the messy case where the same real-world event has multiple
 * DB entries with inconsistent archive status — some active, some archived.
 */
async function phase1_mergeAllDuplicates(stats: CleanupStats): Promise<void> {
  console.log('\n[Phase 1] Loading all events for duplicate detection...');

  const allEvents = await Event.find({}).lean();
  console.log(`[Phase 1] Loaded ${allEvents.length} total events (active + archived)`);

  const eventsForDedup = mapToEventForDedup(allEvents);

  const sameSourceMatches = findSameSourceDuplicates(eventsForDedup);
  const crossSourceMatches = findDuplicates(eventsForDedup);
  console.log(`[Phase 1] Found ${sameSourceMatches.length} same-source pairs, ${crossSourceMatches.length} cross-source pairs`);

  const clusters = buildDuplicateClusters([...sameSourceMatches, ...crossSourceMatches]);
  console.log(`[Phase 1] Identified ${clusters.length} clusters to merge\n`);
  stats.duplicateClusters = clusters.length;

  if (clusters.length === 0) {
    console.log('[Phase 1] No duplicates found\n');
    return;
  }

  const eventMap = new Map(allEvents.map(e => [e._id.toString(), e]));
  const now = new Date();

  for (const cluster of clusters) {
    try {
      await processCluster(cluster, eventMap, stats, now);
    } catch (error: any) {
      console.error(`[Phase 1] Error processing cluster [${cluster.join(', ')}]:`, error?.message || error);
      stats.errors++;
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2: Fix archive status based on actual dates
// ---------------------------------------------------------------------------

/**
 * After merging, corrects any remaining archive status mismatches:
 * - Unarchives events whose end date (or start date) is still in the future
 * - These can exist if a wrongly-archived record was the canonical after merging
 */
async function phase2_fixArchiveStatus(stats: CleanupStats): Promise<void> {
  console.log('[Phase 2] Checking for archive status mismatches...');

  const now = new Date();

  const wronglyArchived = await Event.find({
    isArchived: true,
    $or: [
      { endDate: { $exists: true, $ne: null, $gte: now } },
      { endDate: { $exists: false }, startDate: { $gte: now } },
      { endDate: null, startDate: { $gte: now } },
    ],
  }).select('_id title startDate endDate').lean();

  console.log(`[Phase 2] Found ${wronglyArchived.length} wrongly archived events`);

  if (wronglyArchived.length === 0) {
    console.log('[Phase 2] Nothing to fix\n');
    return;
  }

  wronglyArchived.forEach(e => {
    const end = e.endDate ? ` → ${new Date(e.endDate).toLocaleDateString('en-AU')}` : '';
    console.log(`  Unarchiving: "${e.title}" (${new Date(e.startDate).toLocaleDateString('en-AU')}${end})`);
  });

  if (!DRY_RUN) {
    const result = await Event.updateMany(
      { _id: { $in: wronglyArchived.map(e => e._id) } },
      { $set: { isArchived: false }, $unset: { archivedAt: '' } }
    );
    stats.wronglyArchived = result.modifiedCount;
    console.log(`[Phase 2] Unarchived ${stats.wronglyArchived} events\n`);
  } else {
    stats.wronglyArchived = wronglyArchived.length;
    console.log(`[Phase 2] (DRY RUN) Would unarchive ${stats.wronglyArchived} events\n`);
  }
}

// ---------------------------------------------------------------------------
// Cluster processing
// ---------------------------------------------------------------------------

/**
 * Processes a single cluster: picks a canonical event, merges all data into it,
 * hard-deletes the duplicates, then sets isArchived based on actual event dates.
 */
async function processCluster(
  cluster: string[],
  eventMap: Map<string, any>,
  stats: CleanupStats,
  now: Date
): Promise<void> {
  const clusterEvents = cluster.map(id => eventMap.get(id)).filter(Boolean);
  if (clusterEvents.length < 2) return;

  const canonical = selectCanonicalEvent(clusterEvents);
  const duplicates = clusterEvents.filter(e => e._id.toString() !== canonical._id.toString());

  // Determine correct archive status from the merged date range
  const mergedData = buildMergedUpdate(canonical, duplicates);
  const finalEndDate: Date | null = mergedData.endDate || null;
  const finalStartDate: Date = mergedData.startDate;
  const shouldBeArchived = finalEndDate ? finalEndDate < now : finalStartDate < now;

  console.log(`  Cluster: "${canonical.title}"`);
  console.log(`    Keep:     ${canonical._id} (${canonical.primarySource}) → isArchived: ${shouldBeArchived}`);
  duplicates.forEach(d => console.log(`    Delete:   ${d._id} (${d.primarySource}, wasArchived: ${d.isArchived})`));

  if (DRY_RUN) {
    console.log(`    (DRY RUN) Would merge and delete ${duplicates.length} duplicate(s)\n`);
    stats.eventsMerged += duplicates.length;
    stats.eventsDeleted += duplicates.length;
    return;
  }

  // Merge into canonical and set correct archive status
  await Event.findByIdAndUpdate(canonical._id, {
    $set: {
      ...mergedData,
      isArchived: shouldBeArchived,
      ...(shouldBeArchived ? { archivedAt: canonical.archivedAt || now } : {}),
      ...(!shouldBeArchived ? { $unset: { archivedAt: '' } } : {}),
    }
  });
  stats.eventsMerged += duplicates.length;

  // Hard delete duplicates — data is now in canonical
  await Event.deleteMany({ _id: { $in: duplicates.map(d => d._id) } });
  stats.eventsDeleted += duplicates.length;

  console.log(`    Merged and deleted ${duplicates.length} duplicate(s), kept ${canonical._id}\n`);
}

/**
 * Selects the canonical (primary) event from a cluster.
 * Priority: source quality → real description → earliest scraped
 */
function selectCanonicalEvent(events: any[]): any {
  const SOURCE_PRIORITY: Record<string, number> = {
    marriner: 4,
    ticketmaster: 3,
    whatson: 2,
    feverup: 1,
  };

  return [...events].sort((a, b) => {
    const priorityDiff = (SOURCE_PRIORITY[b.primarySource] || 0) - (SOURCE_PRIORITY[a.primarySource] || 0);
    if (priorityDiff !== 0) return priorityDiff;

    const aHasDesc = !a.description?.includes('No description');
    const bHasDesc = !b.description?.includes('No description');
    if (aHasDesc && !bHasDesc) return -1;
    if (!aHasDesc && bHasDesc) return 1;

    return new Date(a.scrapedAt).getTime() - new Date(b.scrapedAt).getTime();
  })[0];
}

/**
 * Builds the merged update for the canonical event.
 * Sums engagement stats, collects all source IDs and booking URLs,
 * picks the best description and image, and takes the widest date range.
 */
function buildMergedUpdate(canonical: any, duplicates: any[]): Record<string, any> {
  const all = [canonical, ...duplicates];

  const totalViews = all.reduce((sum, e) => sum + (e.stats?.viewCount || 0), 0);
  const totalFavourites = all.reduce((sum, e) => sum + (e.stats?.favouriteCount || 0), 0);
  const totalClickthroughs = all.reduce((sum, e) => sum + (e.stats?.clickthroughCount || 0), 0);

  const startDates = all.map(e => new Date(e.startDate));
  const endDates = all.map(e => e.endDate ? new Date(e.endDate) : null).filter(Boolean) as Date[];
  const finalStartDate = new Date(Math.min(...startDates.map(d => d.getTime())));
  const finalEndDate = endDates.length > 0
    ? new Date(Math.max(...endDates.map(d => d.getTime())))
    : canonical.endDate || null;

  const description = all
    .map(e => e.description || '')
    .filter(d => !d.includes('No description'))
    .sort((a, b) => b.length - a.length)[0] || canonical.description;

  const imageUrl = canonical.imageUrl || all.find(e => e.imageUrl)?.imageUrl;
  const subcategories = Array.from(new Set(all.flatMap(e => e.subcategories || [])));
  const mergedFrom = [...(canonical.mergedFrom || [])];

  const sourceIds: Record<string, string> = {};
  const bookingUrls: Record<string, string> = {};

  for (const event of duplicates) {
    const source = event.primarySource;
    const sourceId = getSourceId(event, source);
    if (sourceId) sourceIds[source] = sourceId;

    const bookingUrl = event.bookingUrl || event.bookingUrls?.[source];
    if (bookingUrl) bookingUrls[source] = bookingUrl;

    mergedFrom.push(`${source}:${sourceId}`);
  }

  return {
    description,
    startDate: finalStartDate,
    endDate: finalEndDate,
    imageUrl,
    subcategories,
    lastUpdated: new Date(),
    mergedFrom: [...new Set(mergedFrom)],
    'stats.viewCount': totalViews,
    'stats.favouriteCount': totalFavourites,
    'stats.clickthroughCount': totalClickthroughs,
    ...Object.fromEntries(Object.entries(sourceIds).map(([src, id]) => [`sourceIds.${src}`, id])),
    ...Object.fromEntries(Object.entries(bookingUrls).map(([src, url]) => [`bookingUrls.${src}`, url])),
  };
}

/**
 * Groups duplicate pairs into clusters using union-find.
 * Handles A-B-C chains so they collapse into one cluster rather than two pairs.
 */
function buildDuplicateClusters(matches: { event1Id: string; event2Id: string }[]): string[][] {
  const parent = new Map<string, string>();

  function find(id: string): string {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
    return parent.get(id)!;
  }

  function union(a: string, b: string): void {
    parent.set(find(a), find(b));
  }

  for (const { event1Id, event2Id } of matches) {
    union(event1Id, event2Id);
  }

  const groups = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const group = groups.get(root) || [];
    group.push(id);
    groups.set(root, group);
  }

  return Array.from(groups.values()).filter(g => g.length >= 2);
}

function mapToEventForDedup(events: any[]): (EventForDedup & { _id: string })[] {
  return events.map(e => ({
    _id: e._id.toString(),
    title: e.title,
    startDate: e.startDate,
    endDate: e.endDate,
    venue: e.venue,
    source: e.primarySource,
    sourceId: getSourceId(e, e.primarySource),
    description: e.description,
    category: e.category,
    subcategories: e.subcategories,
    imageUrl: e.imageUrl,
    videoUrl: e.videoUrl,
    priceMin: e.priceMin,
    priceMax: e.priceMax,
    priceDetails: e.priceDetails,
    isFree: e.isFree,
    bookingUrl: e.bookingUrl,
    accessibility: e.accessibility,
    ageRestriction: e.ageRestriction,
    duration: e.duration,
  }));
}

function getSourceId(event: any, source: string): string {
  if (!event.sourceIds) return '';
  if (typeof event.sourceIds.get === 'function') return event.sourceIds.get(source) || '';
  return event.sourceIds[source] || '';
}

function displaySummary(stats: CleanupStats): void {
  console.log('--------------------------------------------------------');
  console.log(`Database Cleanup${DRY_RUN ? ' (DRY RUN)' : ''} Complete`);
  console.log('--------------------------------------------------------');
  console.log(`  Duplicate clusters found:    ${stats.duplicateClusters}`);
  console.log(`  Events merged:               ${stats.eventsMerged}`);
  console.log(`  Duplicates deleted:          ${stats.eventsDeleted}`);
  console.log(`  Wrongly archived → restored: ${stats.wronglyArchived}`);
  console.log(`  Errors:                      ${stats.errors}`);
  if (DRY_RUN) console.log('\n  Run without --dry-run to apply these changes.');
  console.log('');
}

if (require.main === module) {
  cleanupDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Cleanup] Fatal error:', err);
      process.exit(1);
    });
}

export { cleanupDatabase };
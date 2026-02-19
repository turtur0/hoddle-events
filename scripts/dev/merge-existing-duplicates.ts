import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { connectDB, disconnectDB } from '@/lib/db';
import Event from '@/lib/models/Event';
import {
    findDuplicates,
    findSameSourceDuplicates,
    mergeEvents,
} from '@/lib/utils/deduplication';
import type { EventForDedup } from '@/lib/scrapers/types';

interface MigrationStats {
    duplicateClustersFound: number;
    eventsMerged: number;
    eventsArchived: number;
    errors: number;
}

// Pass --dry-run to preview changes without writing to the database
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * One-time migration script to collapse existing duplicate events in the database.
 *
 * Process:
 * 1. Load all active (non-archived) events
 * 2. Find same-source duplicates (e.g. Ticketmaster multi-tier listings)
 * 3. Find cross-source duplicates (e.g. same event listed by Ticketmaster and Marriner)
 * 4. Group matches into clusters so we collapse A-B-C chains correctly
 * 5. For each cluster, keep the canonical event and archive the rest
 * 6. Merge stats (views, favourites, clickthroughs) into the canonical record
 */
async function mergeExistingDuplicates(): Promise<void> {
    console.log(`\n[Migration] Starting duplicate merge${DRY_RUN ? ' (DRY RUN - no changes will be written)' : ''}...`);

    await connectDB();

    const stats: MigrationStats = {
        duplicateClustersFound: 0,
        eventsMerged: 0,
        eventsArchived: 0,
        errors: 0,
    };

    try {
        const events = await Event.find({ isArchived: { $ne: true } }).lean();
        console.log(`[Migration] Loaded ${events.length} active events\n`);

        const eventsForDedup = mapToEventForDedup(events);

        // Find all duplicate pairs from both same-source and cross-source checks
        console.log('[Migration] Running same-source duplicate detection...');
        const sameSourceMatches = findSameSourceDuplicates(eventsForDedup);
        console.log(`[Migration] Found ${sameSourceMatches.length} same-source duplicate pairs`);

        console.log('[Migration] Running cross-source duplicate detection...');
        const crossSourceMatches = findDuplicates(eventsForDedup);
        console.log(`[Migration] Found ${crossSourceMatches.length} cross-source duplicate pairs\n`);

        // Combine all matches and cluster them (handles A-B-C chains)
        const allMatches = [...sameSourceMatches, ...crossSourceMatches];
        const clusters = buildDuplicateClusters(allMatches);

        console.log(`[Migration] Identified ${clusters.length} duplicate clusters to process\n`);
        stats.duplicateClustersFound = clusters.length;

        // Build a lookup map for fast access
        const eventMap = new Map(events.map(e => [e._id.toString(), e]));

        for (const cluster of clusters) {
            try {
                await processCluster(cluster, eventMap, stats);
            } catch (error: any) {
                console.error(`[Migration] Error processing cluster [${cluster.join(', ')}]:`, error?.message || error);
                stats.errors++;
            }
        }
    } finally {
        await disconnectDB();
    }

    displaySummary(stats);
}

/**
 * Processes a single cluster of duplicate events.
 * Selects a canonical event, merges all data into it, and archives the rest.
 */
async function processCluster(
    cluster: string[],
    eventMap: Map<string, any>,
    stats: MigrationStats
): Promise<void> {
    const clusterEvents = cluster.map(id => eventMap.get(id)).filter(Boolean);

    if (clusterEvents.length < 2) return;

    const canonical = selectCanonicalEvent(clusterEvents);
    const duplicates = clusterEvents.filter(e => e._id.toString() !== canonical._id.toString());

    console.log(`[Migration] Cluster: "${canonical.title}"`);
    console.log(`  Canonical: ${canonical._id} (${canonical.primarySource}, scraped ${canonical.scrapedAt?.toISOString()})`);
    duplicates.forEach(d => {
        console.log(`  Duplicate: ${d._id} (${d.primarySource}, scraped ${d.scrapedAt?.toISOString()})`);
    });

    if (DRY_RUN) {
        console.log(`  [DRY RUN] Would merge ${duplicates.length} event(s) into canonical\n`);
        stats.eventsMerged += duplicates.length;
        stats.eventsArchived += duplicates.length;
        return;
    }

    // Merge all duplicate data into the canonical event
    const mergedData = buildMergedUpdate(canonical, duplicates);
    await Event.findByIdAndUpdate(canonical._id, { $set: mergedData });
    stats.eventsMerged += duplicates.length;

    // Archive the duplicates, recording which canonical event absorbed them
    for (const duplicate of duplicates) {
        await Event.findByIdAndUpdate(duplicate._id, {
            $set: {
                isArchived: true,
                archivedAt: new Date(),
            },
            $addToSet: {
                mergedFrom: `merged-into:${canonical._id}`,
            },
        });
        stats.eventsArchived++;
    }

    console.log(`  Merged ${duplicates.length} duplicate(s) into ${canonical._id}\n`);
}

/**
 * Selects the canonical (primary) event from a cluster.
 *
 * Priority order:
 * 1. Source priority (marriner > ticketmaster > whatson > feverup)
 * 2. Most complete data (non-placeholder description)
 * 3. Earliest scrapedAt (the original record)
 */
function selectCanonicalEvent(events: any[]): any {
    const SOURCE_PRIORITY: Record<string, number> = {
        marriner: 4,
        ticketmaster: 3,
        whatson: 2,
        feverup: 1,
    };

    return [...events].sort((a, b) => {
        // 1. Source priority
        const priorityDiff =
            (SOURCE_PRIORITY[b.primarySource] || 0) - (SOURCE_PRIORITY[a.primarySource] || 0);
        if (priorityDiff !== 0) return priorityDiff;

        // 2. Prefer events with real descriptions
        const aHasDesc = !a.description?.includes('No description');
        const bHasDesc = !b.description?.includes('No description');
        if (aHasDesc && !bHasDesc) return -1;
        if (!aHasDesc && bHasDesc) return 1;

        // 3. Earliest scrapedAt as tiebreaker
        return new Date(a.scrapedAt).getTime() - new Date(b.scrapedAt).getTime();
    })[0];
}

/**
 * Builds the merged update object for the canonical event.
 *
 * - Stats are summed across all duplicates
 * - Source IDs and booking URLs are collected from all records
 * - Best description, image, and date range are selected
 */
function buildMergedUpdate(canonical: any, duplicates: any[]): Record<string, any> {
    const all = [canonical, ...duplicates];

    // Sum engagement stats across all duplicate records
    const totalViews = all.reduce((sum, e) => sum + (e.stats?.viewCount || 0), 0);
    const totalFavourites = all.reduce((sum, e) => sum + (e.stats?.favouriteCount || 0), 0);
    const totalClickthroughs = all.reduce((sum, e) => sum + (e.stats?.clickthroughCount || 0), 0);

    // Widest date range across all records
    const startDates = all.map(e => new Date(e.startDate)).filter(Boolean);
    const endDates = all.map(e => e.endDate ? new Date(e.endDate) : null).filter(Boolean) as Date[];
    const finalStartDate = new Date(Math.min(...startDates.map(d => d.getTime())));
    const finalEndDate = endDates.length > 0
        ? new Date(Math.max(...endDates.map(d => d.getTime())))
        : canonical.endDate;

    // Best description (prefer non-placeholder, then longest)
    const description = all
        .map(e => e.description || '')
        .filter(d => !d.includes('No description'))
        .sort((a, b) => b.length - a.length)[0] || canonical.description;

    // Best image (prefer canonical, fall back to any available)
    const imageUrl = canonical.imageUrl || all.find(e => e.imageUrl)?.imageUrl;

    // Collect all unique subcategories
    const subcategories = Array.from(new Set(all.flatMap(e => e.subcategories || [])));

    // Collect all source IDs and booking URLs
    const sourceIds: Record<string, string> = {};
    const bookingUrls: Record<string, string> = {};
    const sources: string[] = [];
    const mergedFrom: string[] = [...(canonical.mergedFrom || [])];

    for (const event of duplicates) {
        const source = event.primarySource;

        // Collect sourceIds from the Map or plain object
        const sourceId = getSourceId(event, source);
        if (sourceId) sourceIds[source] = sourceId;

        // Collect booking URLs
        const bookingUrl = event.bookingUrl || event.bookingUrls?.[source];
        if (bookingUrl) bookingUrls[source] = bookingUrl;

        if (!sources.includes(source)) sources.push(source);
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
        // Spread source IDs and booking URLs as individual dot-notation keys
        ...Object.fromEntries(
            Object.entries(sourceIds).map(([src, id]) => [`sourceIds.${src}`, id])
        ),
        ...Object.fromEntries(
            Object.entries(bookingUrls).map(([src, url]) => [`bookingUrls.${src}`, url])
        ),
    };
}

/**
 * Groups duplicate pairs into clusters using union-find (disjoint set).
 *
 * For example, if pairs are (A,B) and (B,C), this produces the cluster [A, B, C]
 * rather than two separate pairs - ensuring we collapse chains correctly.
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

    // Group all IDs by their root
    const groups = new Map<string, string[]>();
    for (const id of parent.keys()) {
        const root = find(id);
        const group = groups.get(root) || [];
        group.push(id);
        groups.set(root, group);
    }

    // Only return clusters with 2+ members
    return Array.from(groups.values()).filter(g => g.length >= 2);
}

/** Converts database events to the EventForDedup format used by deduplication utils. */
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

/** Extracts a source ID from an event's sourceIds Map or plain object. */
function getSourceId(event: any, source: string): string {
    if (!event.sourceIds) return '';
    if (typeof event.sourceIds.get === 'function') return event.sourceIds.get(source) || '';
    return event.sourceIds[source] || '';
}

function displaySummary(stats: MigrationStats): void {
    console.log('--------------------------------------------------------');
    console.log(`Duplicate Merge Migration ${DRY_RUN ? '(DRY RUN) ' : ''}Complete`);
    console.log('--------------------------------------------------------');
    console.log(`  Clusters found:   ${stats.duplicateClustersFound}`);
    console.log(`  Events merged:    ${stats.eventsMerged}`);
    console.log(`  Events archived:  ${stats.eventsArchived}`);
    console.log(`  Errors:           ${stats.errors}`);
    if (DRY_RUN) {
        console.log('\n  Run without --dry-run to apply these changes.');
    }
    console.log('');
}

if (require.main === module) {
    mergeExistingDuplicates()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[Migration] Fatal error:', err);
            process.exit(1);
        });
}

export { mergeExistingDuplicates };
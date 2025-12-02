import Event from '@/lib/models/Event';

interface ArchiveStats {
    archived: number;
    skipped: number;
    errors: number;
}

/**
 * Archives events where both start and end dates have completely passed.
 * 
 * Archiving Logic:
 * - Events with only startDate: archived if startDate < today
 * - Events with endDate: archived only if endDate < today
 * - Already archived events are skipped
 * - Ongoing events (start passed, end not reached) remain active
 * 
 * @returns Statistics about the archiving operation
 */
export async function archivePastEvents(): Promise<ArchiveStats> {
    const stats: ArchiveStats = {
        archived: 0,
        skipped: 0,
        errors: 0,
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`[Archive] Starting archival process for events before ${today.toISOString()}`);

    try {
        // Find events that should be archived
        const eventsToArchive = await Event.find({
            isArchived: { $ne: true },
            $or: [
                // Events with no endDate: archive if startDate has passed
                {
                    endDate: { $exists: false },
                    startDate: { $lt: today },
                },
                // Events with endDate: archive only if endDate has passed
                {
                    endDate: { $exists: true, $ne: null, $lt: today },
                },
            ],
        }).select('_id title startDate endDate');

        console.log(`[Archive] Found ${eventsToArchive.length} events to archive`);

        if (eventsToArchive.length === 0) {
            console.log('[Archive] No events to archive');
            return stats;
        }

        // Bulk update to set isArchived flag
        const result = await Event.updateMany(
            {
                _id: { $in: eventsToArchive.map(e => e._id) },
            },
            {
                $set: {
                    isArchived: true,
                    archivedAt: new Date(),
                },
            }
        );

        stats.archived = result.modifiedCount;

        console.log(`[Archive] Successfully archived ${stats.archived} events`);

        // Log sample of archived events
        const sampleSize = Math.min(5, eventsToArchive.length);
        console.log(`[Archive] Sample of archived events (showing ${sampleSize}):`);
        eventsToArchive.slice(0, sampleSize).forEach(event => {
            const endInfo = event.endDate ? ` - ${event.endDate.toLocaleDateString('en-AU')}` : '';
            console.log(
                `  - "${event.title}" (${event.startDate.toLocaleDateString('en-AU')}${endInfo})`
            );
        });

    } catch (error: any) {
        console.error('[Archive] Error during archival:', error.message);
        stats.errors++;
    }

    return stats;
}

/**
 * Retrieves count of archived events.
 * Useful for displaying archive statistics on the UI.
 */
export async function getArchivedCount(): Promise<number> {
    try {
        return await Event.countDocuments({ isArchived: true });
    } catch (error) {
        console.error('[Archive] Error counting archived events:', error);
        return 0;
    }
}

/**
 * Manually unarchives an event (admin function).
 * Useful if an event was incorrectly archived or dates were updated.
 * 
 * @param eventId - ID of the event to unarchive
 * @returns true if successful, false otherwise
 */
export async function unarchiveEvent(eventId: string): Promise<boolean> {
    try {
        const result = await Event.updateOne(
            { _id: eventId },
            {
                $set: { isArchived: false },
                $unset: { archivedAt: '' },
            }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        console.error('[Archive] Error unarchiving event:', error);
        return false;
    }
}
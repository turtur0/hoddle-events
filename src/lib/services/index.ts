/**
 * Centralised exports for all service modules
 * Provides both named and default exports for convenient importing
 */

// ============================================
// ANALYTICS SERVICE
// ============================================

export {
    computePriceDistribution,
    computeTimeline,
    computePopularityData,
} from './analytics-service';

export type {
    PriceDistribution,
    TimelineData,
    PopularityData,
} from './analytics-service';

// ============================================
// EMAIL DIGEST SERVICE
// ============================================

export { sendScheduledDigests } from './email-digest-service';

// ============================================
// NOTIFICATION SERVICE
// ============================================

export {
    processNewEventNotifications,
    processFavouritedEventUpdate,
    getUnreadNotifications,
    getAllNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
} from './notification-service';

export type { EventChanges } from './notification-service';

// ============================================
// ARCHIVE SERVICE
// ============================================

export {
    archivePastEvents,
    getArchivedCount,
    unarchiveEvent,
} from './archive-service';

// ============================================
// DEFAULT EXPORT (All Services)
// ============================================

import * as analyticsService from './analytics-service';
import * as emailDigestService from './email-digest-service';
import * as notificationService from './notification-service';
import * as archiveService from './archive-service';

/**
 * Default export providing all service functions
 * Useful for importing all services at once: `import services from '@/lib/services'`
 */
export default {
    // Analytics
    computePriceDistribution: analyticsService.computePriceDistribution,
    computeTimeline: analyticsService.computeTimeline,
    computePopularityData: analyticsService.computePopularityData,

    // Email Digest
    sendScheduledDigests: emailDigestService.sendScheduledDigests,

    // Notifications
    processNewEventNotifications: notificationService.processNewEventNotifications,
    processFavouritedEventUpdate: notificationService.processFavouritedEventUpdate,
    getUnreadNotifications: notificationService.getUnreadNotifications,
    getAllNotifications: notificationService.getAllNotifications,
    getUnreadCount: notificationService.getUnreadCount,
    markAsRead: notificationService.markAsRead,
    markAllAsRead: notificationService.markAllAsRead,

    // Archive
    archivePastEvents: archiveService.archivePastEvents,
    getArchivedCount: archiveService.getArchivedCount,
    unarchiveEvent: archiveService.unarchiveEvent,
} as const;
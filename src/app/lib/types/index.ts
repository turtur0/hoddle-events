/**
 * Central type definitions for Melbourne Events Aggregator
 * 
 * Import from this file in your application:
 * import { NormalisedEvent, TicketmasterEvent } from '@/lib/types';
 */

// Shared event types
export type {
  NormalisedEvent,
  EventSource,
  EventWithId,
} from './events';

// Ticketmaster types
export type {
  TicketmasterEvent,
  TicketmasterResponse,
} from './ticketmaster';

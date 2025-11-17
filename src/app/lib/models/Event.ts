import mongoose, { Schema, Model } from 'mongoose';

export interface IEvent {
  title: string;
  description: string;
  category: string;
  
  startDate: Date;
  endDate?: Date;
  
  venue: {
    name: string;
    address: string;
    suburb: string;
  };
  
  priceMin?: number;
  priceMax?: number;
  isFree: boolean;
  
  bookingUrl: string;
  imageUrl?: string;
  
  source: 'ticketmaster' | 'eventbrite' | 'artscentre';
  sourceId: string;
  
  scrapedAt: Date;
  lastUpdated: Date;
}

const EventSchema = new Schema<IEvent>({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: false,
    default: 'No description available',
  },
  category: {
    type: String,
    required: true,
  },
  
  startDate: {
    type: Date,
    required: true,
    index: true,
  },
  endDate: {
    type: Date,
    required: false,
  },
  
  venue: {
    name: { type: String, required: true },
    address: { type: String, required: false, default: 'TBA' },
    suburb: { type: String, required: false, default: 'Melbourne' },
  },
  
  priceMin: Number,
  priceMax: Number,
  isFree: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  bookingUrl: {
    type: String,
    required: true,
  },
  imageUrl: String,
  
  source: {
    type: String,
    enum: ['ticketmaster', 'eventbrite', 'artscentre'],
    required: true,
  },
  sourceId: {
    type: String,
    required: true,
  },
  
  scrapedAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Text search index
EventSchema.index({ title: 'text', description: 'text', 'venue.name': 'text' });

// Compound index for filtering
EventSchema.index({ startDate: 1, category: 1 });

// UPDATED: Use title + venue + source as unique constraint
// This prevents "HAIR - THE MUSICAL" at "Comedy Theatre" from being added multiple times
EventSchema.index(
  { 
    title: 1, 
    'venue.name': 1, 
    source: 1 
  }, 
  { unique: true }
);

// Also keep sourceId index for reference (non-unique now)
EventSchema.index({ source: 1, sourceId: 1 });

const Event: Model<IEvent> = mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

export default Event;

// NEW: Add serialized type for client components
export interface SerializedEvent extends Omit<IEvent, 'startDate' | 'endDate' | 'scrapedAt' | 'lastUpdated'> {
  _id: string;
  startDate: string;
  endDate?: string;
  scrapedAt: string;
  lastUpdated: string;
}
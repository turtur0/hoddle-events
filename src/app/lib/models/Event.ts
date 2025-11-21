import mongoose, { Schema, Model } from 'mongoose';

export interface IEvent {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  
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
  
  source: 'ticketmaster' | 'marriner' | 'artscentre';
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
    index: true, // Index for filtering
  },
  subcategory: {
    type: String,
    required: false,
    index: true, // Index for filtering
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
EventSchema.index({ startDate: 1, category: 1, subcategory: 1 });

// Unique constraint
EventSchema.index(
  { 
    title: 1, 
    'venue.name': 1, 
    source: 1 
  }, 
  { unique: true }
);

EventSchema.index({ source: 1, sourceId: 1 });

const Event: Model<IEvent> = mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

export default Event;

export interface SerializedEvent extends Omit<IEvent, 'startDate' | 'endDate' | 'scrapedAt' | 'lastUpdated'> {
  _id: string;
  startDate: string;
  endDate?: string;
  scrapedAt: string;
  lastUpdated: string;
}
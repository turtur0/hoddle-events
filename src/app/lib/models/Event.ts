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
    required: true,
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
  },
  
  venue: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    suburb: { type: String, required: true },
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

// Create indexes for search and filtering
EventSchema.index({ title: 'text', description: 'text', 'venue.name': 'text' });
EventSchema.index({ startDate: 1, category: 1 });
EventSchema.index({ source: 1, sourceId: 1 }, { unique: true });

// Prevent model recompilation in development
const Event: Model<IEvent> = mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);

export default Event;
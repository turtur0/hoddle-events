import mongoose, { Schema, Model } from 'mongoose';

export interface IEvent {
  _id: any;
  title: string;
  description: string;
  category: string;
  subcategories: string[];

  startDate: Date;
  endDate?: Date;

  venue: {
    name: string;
    address: string;
    suburb: string;
  };

  priceMin?: number;
  priceMax?: number;
  priceDetails?: string;
  isFree: boolean;

  bookingUrl: string;
  bookingUrls?: Record<string, string>;
  imageUrl?: string;
  videoUrl?: string;

  sources: string[];
  primarySource: 'ticketmaster' | 'marriner' | 'whatson';
  sourceIds: Record<string, string>;

  accessibility?: string[];
  ageRestriction?: string;
  duration?: string;

  scrapedAt: Date;
  lastUpdated: Date;
  mergedFrom?: string[];

  stats: {
    viewCount: number;
    favouriteCount: number;
    clickthroughCount: number;

    categoryPopularityPercentile?: number;
    rawPopularityScore?: number;
    lastPopularityUpdate?: Date;
  };
}

const EventSchema = new Schema<IEvent>({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: 'No description available' },
  category: { type: String, required: true, index: true },
  subcategories: [{ type: String }],

  startDate: { type: Date, required: true, index: true },
  endDate: Date,

  venue: {
    name: { type: String, required: true },
    address: { type: String, default: 'TBA' },
    suburb: { type: String, default: 'Melbourne' },
  },

  priceMin: Number,
  priceMax: Number,
  priceDetails: String,
  isFree: { type: Boolean, default: false, index: true },

  bookingUrl: { type: String, required: true },
  bookingUrls: { type: Map, of: String },
  imageUrl: String,
  videoUrl: String,

  sources: [{ type: String }],
  primarySource: {
    type: String,
    enum: ['ticketmaster', 'marriner', 'whatson'],
    required: true,
  },
  sourceIds: { type: Map, of: String },

  accessibility: [String],
  ageRestriction: String,
  duration: String,

  scrapedAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  mergedFrom: [String],

  stats: {
    viewCount: { type: Number, default: 0 },
    favouriteCount: { type: Number, default: 0 },
    clickthroughCount: { type: Number, default: 0 },
    categoryPopularityPercentile: { type: Number, min: 0, max: 1 },
    rawPopularityScore: { type: Number },
    lastPopularityUpdate: { type: Date },
  },
}, { timestamps: true });

// Indexes
EventSchema.index({ title: 'text', description: 'text', 'venue.name': 'text' });
EventSchema.index({ startDate: 1, category: 1 });
EventSchema.index({ sources: 1 });
EventSchema.index({ primarySource: 1, 'sourceIds.$**': 1 });
EventSchema.index({ 'stats.categoryPopularityPercentile': 1 });
EventSchema.index(
  { title: 1, 'venue.name': 1, startDate: 1 },
  { unique: true }
);

const Event: Model<IEvent> = mongoose.models.Event || mongoose.model<IEvent>('Event', EventSchema);
export default Event;

export interface SerializedEvent extends Omit<IEvent, 'startDate' | 'endDate' | 'scrapedAt' | 'lastUpdated'> {
  _id: string;
  startDate: string;
  endDate?: string;
  scrapedAt: string;
  lastUpdated: string;
}
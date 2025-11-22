import mongoose, { Schema, Model } from 'mongoose';

export interface IUserInteraction {
    userId: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    interactionType: 'view' | 'favourite' | 'unfavourite' | 'clickthrough';
    source: 'search' | 'recommendation' | 'category_browse' | 'homepage' | 'direct' | 'similar_events';
    timestamp: Date;
    sessionId?: string;
}

const UserInteractionSchema = new Schema<IUserInteraction>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
        index: true
    },
    interactionType: {
        type: String,
        enum: ['view', 'favourite', 'unfavourite', 'clickthrough'],
        required: true
    },
    source: {
        type: String,
        enum: ['search', 'recommendation', 'category_browse', 'homepage', 'direct', 'similar_events'],
        default: 'direct'
    },
    timestamp: { type: Date, default: Date.now },
    sessionId: String,
}, { timestamps: false });

// Compound indexes for efficient queries
UserInteractionSchema.index({ userId: 1, eventId: 1, interactionType: 1 });
UserInteractionSchema.index({ userId: 1, timestamp: -1 });
UserInteractionSchema.index({ eventId: 1, interactionType: 1 });

const UserInteraction: Model<IUserInteraction> =
    mongoose.models.UserInteraction ||
    mongoose.model<IUserInteraction>('UserInteraction', UserInteractionSchema);

export default UserInteraction;
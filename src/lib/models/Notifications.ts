// lib/models/Notification.ts
import mongoose, { Schema, Model } from 'mongoose';

export interface INotification {
    userId: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    type: 'new_event' | 'event_soon' | 'similar_to_favorite';

    title: string;
    message: string;
    relevanceScore?: number; // Why they got this (for debugging)

    read: boolean;
    createdAt: Date;
    expiresAt: Date; // Auto-delete after 7 days
}

const NotificationSchema = new Schema<INotification>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true, // For fast queries by user
    },
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
    },
    type: {
        type: String,
        enum: ['new_event', 'event_soon', 'similar_to_favorite'],
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    relevanceScore: {
        type: Number,
        min: 0,
        max: 1,
    },
    read: {
        type: Boolean,
        default: false,
        index: true, // For counting unread
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true, // For sorting
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        index: true, // For TTL
    },
});

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// TTL index: automatically delete old notifications
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Notification: Model<INotification> =
    mongoose.models.Notification ||
    mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
// lib/models/Notification.ts
import mongoose, { Schema, Model } from 'mongoose';

export interface INotification {
    userId: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    type: 'keyword_match' | 'recommendation' | 'favorite_update';
    title: string;
    message: string;
    relevanceScore?: number;
    read: boolean;
    createdAt: Date;
    expiresAt: Date;
}

const NotificationSchema = new Schema<INotification>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true,
    },
    type: {
        type: String,
        enum: ['keyword_match', 'recommendation', 'favorite_update'],
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
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        index: true,
    },
});

// Compound index for efficient queries
NotificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

// TTL index for automatic cleanup
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent duplicate notifications for same user/event
NotificationSchema.index({ userId: 1, eventId: 1, type: 1 });

const Notification: Model<INotification> =
    mongoose.models.Notification ||
    mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
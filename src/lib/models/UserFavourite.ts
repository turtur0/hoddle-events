import mongoose, { Schema, Model } from 'mongoose';

export interface IUserFavourite {
    userId: mongoose.Types.ObjectId;
    eventId: mongoose.Types.ObjectId;
    createdAt: Date;
}

const UserFavouriteSchema = new Schema<IUserFavourite>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    eventId: {
        type: Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    createdAt: { type: Date, default: Date.now },
});

// Unique constraint: user can only favourite an event once
UserFavouriteSchema.index({ userId: 1, eventId: 1 }, { unique: true });
UserFavouriteSchema.index({ userId: 1, createdAt: -1 });

const UserFavourite: Model<IUserFavourite> =
    mongoose.models.UserFavourite ||
    mongoose.model<IUserFavourite>('UserFavourite', UserFavouriteSchema);

export default UserFavourite;
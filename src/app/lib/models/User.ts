import mongoose, { Schema, Model } from 'mongoose';

export interface IUser {
    email: string;
    name: string;
    passwordHash: string;

    // Preferences
    preferences: {
        categories: Record<string, number>; // e.g., { music: 0.8, theatre: 0.5 }
        priceRange: {
            min: number;
            max: number;
        };
        popularityPreference: number; // 0 = niche, 1 = mainstream
        locations: string[]; // suburbs like 'Melbourne CBD', 'St Kilda'
        notifications: {
            inApp: boolean;
            email: boolean;
            emailFrequency: 'instant' | 'daily' | 'weekly';
        };
    };

    userVector?: number[];
    clusterGroup?: string;

    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
        },

        preferences: {
            categories: {
                type: Map,
                of: Number,
                default: new Map(),
            },
            priceRange: {
                min: { type: Number, default: 0 },
                max: { type: Number, default: 500 },
            },
            popularityPreference: { type: Number, default: 0.5 },
            locations: { type: [String], default: [] },
            notifications: {
                inApp: { type: Boolean, default: true },
                email: { type: Boolean, default: false },
                emailFrequency: { type: String, default: 'weekly' },
            },
        },

        userVector: [Number],
        clusterGroup: String,
    },
    { timestamps: true }
);

// Index for email lookup
UserSchema.index({ email: 1 });

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
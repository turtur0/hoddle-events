// lib/models/User.ts - UPDATED SCHEMA
import mongoose, { Schema, Model } from 'mongoose';

export interface IUser {
    email: string;
    name: string;
    username?: string;
    passwordHash?: string;
    provider?: 'credentials' | 'google';

    favorites: mongoose.Types.ObjectId[];
    preferences: {
        selectedCategories: string[];
        selectedSubcategories: string[];
        categoryWeights: Record<string, number>;
        priceRange: {
            min: number;
            max: number;
        };
        popularityPreference: number;
        locations: string[];
        notifications: {
            inApp: boolean;
            email: boolean;
            emailFrequency: 'weekly' | 'monthly';
            keywords: string[];
            lastEmailSent?: Date;
            smartFiltering: {
                enabled: boolean;
                minRecommendationScore: number;
            };
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
        username: {
            type: String,
            unique: true,
            sparse: true,
            trim: true,
            lowercase: true,
        },
        passwordHash: {
            type: String,
        },
        provider: {
            type: String,
            enum: ['credentials', 'google'],
            default: 'credentials',
        },
        favorites: [{
            type: Schema.Types.ObjectId,
            ref: 'Event',
        }],
        preferences: {
            selectedCategories: {
                type: [String],
                default: [],
            },
            selectedSubcategories: {
                type: [String],
                default: [],
            },
            categoryWeights: {
                type: Map,
                of: Number,
                default: new Map(),
            },
            priceRange: {
                min: { type: Number, default: 0 },
                max: { type: Number, default: 500 },
            },
            popularityPreference: { type: Number, default: 0.5 },
            locations: { type: [String], default: ['Melbourne'] },
            notifications: {
                inApp: { type: Boolean, default: true },
                email: { type: Boolean, default: false },
                emailFrequency: {
                    type: String,
                    enum: ['weekly', 'monthly'],
                    default: 'weekly'
                },
                keywords: { type: [String], default: [] },
                lastEmailSent: { type: Date },
                smartFiltering: {
                    enabled: { type: Boolean, default: true },
                    minRecommendationScore: { type: Number, default: 0.6 },
                },
            },
        },
        userVector: [Number],
        clusterGroup: String,
    },
    { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
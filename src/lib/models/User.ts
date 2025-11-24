import mongoose, { Schema, Model } from 'mongoose';

export interface IUser {
    email: string;
    name: string;
    username?: string;
    passwordHash?: string;
    provider?: 'credentials' | 'google';

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
            emailFrequency: 'instant' | 'daily' | 'weekly';
            smartFiltering: {
                enabled: boolean;
                minRecommendationScore: number;
            };
            keywords: string[]; // e.g., ['taylor swift', 'hamilton']
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
            unique: true,  // This creates an index automatically
            lowercase: true,
            trim: true,
            // Remove index: true if you had it here
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        username: {
            type: String,
            unique: true,
            sparse: true,  // This creates an index automatically
            trim: true,
            lowercase: true,
            // Remove index: true if you had it here
        },
        passwordHash: {
            type: String,
        },
        provider: {
            type: String,
            enum: ['credentials', 'google'],
            default: 'credentials',
        },

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
                    enum: ['instant', 'daily', 'weekly'],
                    default: 'weekly'
                },
                smartFiltering: {
                    enabled: { type: Boolean, default: true },
                    minRecommendationScore: { type: Number, default: 0.6 },
                },
                keywords: { type: [String], default: [] },
            },
        },

        userVector: [Number],
        clusterGroup: String,
    },
    { timestamps: true }
);

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
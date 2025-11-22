import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export async function POST(request: NextRequest) {
    try {
        const { email, password, name, username } = await request.json();

        // Validation
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters' },
                { status: 400 }
            );
        }

        // Validate username if provided
        if (username) {
            if (username.length < 3) {
                return NextResponse.json(
                    { error: 'Username must be at least 3 characters' },
                    { status: 400 }
                );
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                return NextResponse.json(
                    { error: 'Username can only contain letters, numbers, and underscores' },
                    { status: 400 }
                );
            }
        }

        await connectDB();

        // Check if email exists
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Check if username exists (if provided)
        if (username) {
            const existingUsername = await User.findOne({ username: username.toLowerCase() });
            if (existingUsername) {
                return NextResponse.json(
                    { error: 'Username already taken' },
                    { status: 409 }
                );
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            email,
            name,
            username: username?.toLowerCase(),
            passwordHash,
            provider: 'credentials',
            preferences: {
                selectedCategories: [],
                selectedSubcategories: [],
                categoryWeights: {},
                priceRange: { min: 0, max: 500 },
                popularityPreference: 0.5,
                locations: ['Melbourne'],
                notifications: {
                    inApp: true,
                    email: false,
                    emailFrequency: 'weekly',
                },
            },
        });

        return NextResponse.json(
            {
                message: 'User created successfully',
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    username: user.username,
                },
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: error.message || 'Signup failed' },
            { status: 500 }
        );
    }
}
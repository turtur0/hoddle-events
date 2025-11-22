import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/app/lib/db';
import User from '@/app/lib/models/User';
import { CATEGORIES } from '@/app/lib/categories';

export async function POST(request: NextRequest) {
    try {
        const { email, password, name } = await request.json();

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

        await connectDB();

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { error: 'Email already registered' },
                { status: 409 }
            );
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Initialize default preferences
        const defaultCategories: Record<string, number> = {};
        CATEGORIES.forEach(cat => {
            defaultCategories[cat.value] = 0.5; // Default neutral preference
        });

        // Create user
        const user = await User.create({
            email,
            name,
            passwordHash,
            preferences: {
                categories: defaultCategories,
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
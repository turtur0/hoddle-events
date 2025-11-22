// src/app/api/user/username/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { username } = await request.json();

        if (!username || username.length < 3) {
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

        await connectDB();

        // Check if username is already taken
        const existingUser = await User.findOne({
            username: username.toLowerCase(),
            email: { $ne: session.user.email } // Exclude current user
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'Username already taken' },
                { status: 409 }
            );
        }

        // Update user's username
        await User.findOneAndUpdate(
            { email: session.user.email },
            { username: username.toLowerCase() },
            { new: true }
        );

        return NextResponse.json({
            message: 'Username updated successfully',
            username: username.toLowerCase(),
        });
    } catch (error: any) {
        console.error('Username update error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update username' },
            { status: 500 }
        );
    }
}
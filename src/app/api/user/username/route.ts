import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models';

/**
 * POST /api/user/username
 * Updates the user's username.
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        const { username } = await request.json();

        // Validate username
        const validationError = validateUsername(username);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        await connectDB();

        // Check if username is already taken (case-insensitive, excluding current user)
        const existingUser = await User.findOne({
            usernameLower: username.toLowerCase(),
            email: { $ne: session.user.email }
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'Username already taken' },
                { status: 409 }
            );
        }

        // Update username (preserve original case)
        await User.findOneAndUpdate(
            { email: session.user.email },
            {
                username: username,
                usernameLower: username.toLowerCase()
            },
            { new: true }
        );

        return NextResponse.json({
            message: 'Username updated successfully',
            username: username,
        });
    } catch (error: any) {
        console.error('Username update error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update username' },
            { status: 500 }
        );
    }
}

/** Validates username format and length. */
function validateUsername(username: string): string | null {
    if (!username || username.length < 3) {
        return 'Username must be at least 3 characters';
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return 'Username can only contain letters, numbers, and underscores';
    }

    return null;
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User, UserFavourite, UserInteraction } from '@/lib/models';

/**
 * GET /api/user/account
 * Retrieves current user's account information.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        await connectDB();
        const user = await User.findById(session.user.id).select('name username email');

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
            name: user.name,
            username: user.username,
            email: user.email,
        });
    } catch (error) {
        console.error('Error getting account:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PUT /api/user/account
 * Updates user account information (name, username, password).
 */
export async function PUT(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        const { name, username, currentPassword, newPassword } = await req.json();

        await connectDB();
        const user = await User.findById(session.user.id);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Update username if provided and different
        if (username && username !== user.username) {
            await validateAndUpdateUsername(user, username);
        }

        // Update name
        if (name) {
            user.name = name;
        }

        // Update password if provided
        if (newPassword) {
            await updatePassword(user, currentPassword, newPassword);
        }

        await user.save();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating account:', error);

        // Return specific error messages
        if (error.message === 'Username already taken' ||
            error.message === 'Current password required' ||
            error.message === 'Current password incorrect') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}

/**
 * DELETE /api/user/account
 * Deletes user account and all associated data.
 */
export async function DELETE() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
        }

        await connectDB();
        const userId = new mongoose.Types.ObjectId(session.user.id);

        // Delete user and all related data in parallel
        await Promise.all([
            User.findByIdAndDelete(userId),
            UserFavourite.deleteMany({ userId }),
            UserInteraction.deleteMany({ userId }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting account:', error);
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}

/** Validates and updates username (preserves case). */
async function validateAndUpdateUsername(user: any, username: string) {
    const existing = await User.findOne({ usernameLower: username.toLowerCase() });
    if (existing) {
        throw new Error('Username already taken');
    }
    user.username = username;
    user.usernameLower = username.toLowerCase();
}

/** Updates user password after verifying current password. */
async function updatePassword(user: any, currentPassword: string, newPassword: string) {
    if (!currentPassword) {
        throw new Error('Current password required');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash || '');
    if (!isValid) {
        throw new Error('Current password incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
}
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';
import UserFavourite from '@/lib/models/UserFavourite';
import UserInteraction from '@/lib/models/UserInteraction';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// GET - Get account info
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

// PUT - Update account info
export async function PUT(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { name, username, currentPassword, newPassword } = await req.json();

        await connectDB();
        const user = await User.findById(session.user.id);

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Validate username if provided
        if (username && username !== user.username) {
            const existing = await User.findOne({ username: username.toLowerCase() });
            if (existing) {
                return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
            }
            user.username = username.toLowerCase();
        }

        // Update name
        if (name) user.name = name;

        // Update password if provided
        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json(
                    { error: 'Current password required' },
                    { status: 400 }
                );
            }

            // Verify current password
            const isValid = await bcrypt.compare(currentPassword, user.passwordHash || '');
            if (!isValid) {
                return NextResponse.json({ error: 'Current password incorrect' }, { status: 400 });
            }

            user.passwordHash = await bcrypt.hash(newPassword, 10);
        }

        await user.save();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating account:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}

// DELETE - Delete account
export async function DELETE() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();
        const userId = new mongoose.Types.ObjectId(session.user.id);

        // Delete user and all related data
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
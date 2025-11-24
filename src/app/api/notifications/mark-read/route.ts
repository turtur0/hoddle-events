// app/api/notifications/mark-read/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { markAsRead, markAllAsRead } from '@/lib/services/notificationService';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const body = await request.json();
        const { notificationIds, markAll } = body;

        if (markAll) {
            await markAllAsRead(session.user.id);
        } else if (notificationIds && Array.isArray(notificationIds)) {
            await markAsRead(notificationIds);
        } else {
            return NextResponse.json(
                { error: 'Invalid request' },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        return NextResponse.json(
            { error: 'Failed to mark notifications as read' },
            { status: 500 }
        );
    }
}
import { NextRequest, NextResponse } from 'next/server';
import { sendScheduledDigests } from '@/lib/services/emailDigestService';
import { connectDB } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error('[Cron] Unauthorised access attempt');
        return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const frequency = request.nextUrl.searchParams.get('frequency') as 'weekly' | 'monthly';

    if (!frequency || !['weekly', 'monthly'].includes(frequency)) {
        return NextResponse.json(
            { error: 'Invalid frequency. Must be "weekly" or "monthly"' },
            { status: 400 }
        );
    }

    try {
        console.log(`[Cron] Starting ${frequency} digest job`);

        await connectDB();

        const results = await sendScheduledDigests(frequency);

        console.log(`[Cron] Job complete:`, results);

        return NextResponse.json({
            success: true,
            frequency,
            timestamp: new Date().toISOString(),
            ...results,
        });
    } catch (error: any) {
        console.error('[Cron] Job failed:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
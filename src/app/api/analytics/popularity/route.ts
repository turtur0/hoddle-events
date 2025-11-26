// app/api/analytics/popularity/route.ts
import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { computePopularityData } from '@/lib/services/analyticsService';

export async function GET() {
    try {
        await connectDB();
        const data = await computePopularityData();
        return NextResponse.json({ data });
    } catch (error) {
        console.error('[Analytics] Popularity error:', error);
        return NextResponse.json({ error: 'Failed to compute popularity data' }, { status: 500 });
    }
}

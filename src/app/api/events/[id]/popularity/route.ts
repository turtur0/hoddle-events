
// app/api/events/[id]/popularity/route.ts (NEW)

import { NextRequest, NextResponse } from 'next/server';
import { compareToCategory } from '@/lib/ml/popularityService';
import { connectDB } from '@/lib/db';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await connectDB();

        const comparison = await compareToCategory(params.id);

        return NextResponse.json({
            percentile: comparison.percentile,
            comparedToAvg: comparison.comparedToAvg,
            categoryAvg: comparison.categoryAvg,
            description: getPopularityDescription(comparison.percentile),
        });
    } catch (error) {
        console.error('Error getting event popularity:', error);
        return NextResponse.json(
            { error: 'Failed to get popularity info' },
            { status: 500 }
        );
    }
}

function getPopularityDescription(percentile: number): string {
    if (percentile >= 0.9) return 'Highly popular - one of the most sought-after events in this category';
    if (percentile >= 0.7) return 'Popular - well-attended and well-reviewed';
    if (percentile >= 0.5) return 'Moderately popular - steady interest';
    if (percentile >= 0.3) return 'Niche appeal - perfect for those seeking something different';
    return 'Hidden gem - undiscovered by most';
}
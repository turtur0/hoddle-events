// app/api/events/[id]/popularity/route.ts

import { NextRequest, NextResponse } from 'next/server';
;
import { connectDB } from '@/lib/db';

import { compareToCategory } from '@/lib/ml';

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }  
) {
    try {
        await connectDB();

        const { id } = await context.params;  

        const comparison = await compareToCategory(id);

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
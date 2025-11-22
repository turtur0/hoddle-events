// src/app/api/user/preferences/route.ts
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

    await connectDB();

    const {
      selectedCategories,
      selectedSubcategories,
      popularityPreference,
      notifications,
    } = await request.json();

    // Initialize category weights based on selected categories
    const categoryWeights: Record<string, number> = {};
    selectedCategories.forEach((cat: string) => {
      categoryWeights[cat] = 0.5;
    });

    const user = await User.findOneAndUpdate(
      { email: session.user.email },
      {
        'preferences.selectedCategories': selectedCategories,
        'preferences.selectedSubcategories': selectedSubcategories,
        'preferences.categoryWeights': categoryWeights,
        'preferences.popularityPreference': popularityPreference,
        'preferences.notifications': notifications,
      },
      { new: true }
    );

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Preferences updated',
      hasCompletedOnboarding: true,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        username: user.username,
      },
    });
  } catch (error: any) {
    console.error('Preferences update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ preferences: user.preferences });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
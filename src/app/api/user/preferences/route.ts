import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import User from '@/lib/models/User';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    await connectDB();

    const user = await User.findOne({ email: session.user.email }).select('preferences');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ preferences: user.preferences });
  } catch (error: any) {
    console.error('Get preferences error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    await connectDB();

    const {
      selectedCategories,
      selectedSubcategories,
      popularityPreference,
      priceRange,
      notifications,
    } = await request.json();

    const allCategories = ['music', 'theatre', 'sports', 'arts', 'family', 'other'];
    const categoryWeights: Record<string, number> = {};

    if (selectedCategories && Array.isArray(selectedCategories)) {
      allCategories.forEach((cat: string) => {
        categoryWeights[cat] = selectedCategories.includes(cat) ? 0.8 : 0.2;
      });
    } else {
      allCategories.forEach((cat: string) => {
        categoryWeights[cat] = 0.5;
      });
    }

    const updateFields: any = {};

    if (selectedCategories !== undefined) {
      updateFields['preferences.selectedCategories'] = selectedCategories;
    }
    if (selectedSubcategories !== undefined) {
      updateFields['preferences.selectedSubcategories'] = selectedSubcategories;
    }

    updateFields['preferences.categoryWeights'] = categoryWeights;
    updateFields['preferences.popularityPreference'] = popularityPreference ?? 0.5;
    updateFields['preferences.pricePreference'] = 0.5;
    updateFields['preferences.venuePreference'] = 0.5;

    if (priceRange) {
      if (priceRange.min !== undefined) {
        updateFields['preferences.priceRange.min'] = priceRange.min;
      }
      if (priceRange.max !== undefined) {
        updateFields['preferences.priceRange.max'] = priceRange.max;
      }
    }

    // Email notifications configuration
    if (notifications) {
      if (notifications.inApp !== undefined) {
        updateFields['preferences.notifications.inApp'] = notifications.inApp;
      }
      if (notifications.email !== undefined) {
        updateFields['preferences.notifications.email'] = notifications.email;
      }
      if (notifications.emailFrequency !== undefined) {
        updateFields['preferences.notifications.emailFrequency'] = notifications.emailFrequency;
      }
      if (notifications.keywords !== undefined) {
        updateFields['preferences.notifications.keywords'] = Array.isArray(notifications.keywords)
          ? notifications.keywords
          : [];
      }
      if (notifications.smartFiltering) {
        if (notifications.smartFiltering.enabled !== undefined) {
          updateFields['preferences.notifications.smartFiltering.enabled'] = notifications.smartFiltering.enabled;
        }
        if (notifications.smartFiltering.minRecommendationScore !== undefined) {
          updateFields['preferences.notifications.smartFiltering.minRecommendationScore'] = notifications.smartFiltering.minRecommendationScore;
        }
      }
    }

    const user = await User.findOneAndUpdate(
      { email: session.user.email },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('preferences');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Preferences updated',
      hasCompletedOnboarding: true,
      preferences: user.preferences,
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

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const updateFields: Record<string, any> = {};

    if (body.selectedCategories !== undefined) {
      updateFields['preferences.selectedCategories'] = body.selectedCategories;

      const allCategories = ['music', 'theatre', 'sports', 'arts', 'family', 'other'];
      const categoryWeights: Record<string, number> = {};
      allCategories.forEach((cat: string) => {
        categoryWeights[cat] = body.selectedCategories.includes(cat) ? 0.8 : 0.2;
      });
      updateFields['preferences.categoryWeights'] = categoryWeights;
    }

    if (body.selectedSubcategories !== undefined) {
      updateFields['preferences.selectedSubcategories'] = body.selectedSubcategories;
    }
    if (body.categoryWeights !== undefined) {
      updateFields['preferences.categoryWeights'] = body.categoryWeights;
    }
    if (body.priceRange) {
      if (body.priceRange.min !== undefined) {
        updateFields['preferences.priceRange.min'] = body.priceRange.min;
      }
      if (body.priceRange.max !== undefined) {
        updateFields['preferences.priceRange.max'] = body.priceRange.max;
      }
    }
    if (body.popularityPreference !== undefined) {
      updateFields['preferences.popularityPreference'] = body.popularityPreference;
    }
    if (body.locations !== undefined) {
      updateFields['preferences.locations'] = body.locations;
    }

    if (body.notifications) {
      const notifs = body.notifications;
      if (notifs.inApp !== undefined) {
        updateFields['preferences.notifications.inApp'] = notifs.inApp;
      }
      if (notifs.email !== undefined) {
        updateFields['preferences.notifications.email'] = notifs.email;
      }
      if (notifs.emailFrequency !== undefined) {
        updateFields['preferences.notifications.emailFrequency'] = notifs.emailFrequency;
      }
      if (notifs.keywords !== undefined) {
        updateFields['preferences.notifications.keywords'] = Array.isArray(notifs.keywords)
          ? notifs.keywords
          : [];
      }
      if (notifs.smartFiltering) {
        if (notifs.smartFiltering.enabled !== undefined) {
          updateFields['preferences.notifications.smartFiltering.enabled'] = notifs.smartFiltering.enabled;
        }
        if (notifs.smartFiltering.minRecommendationScore !== undefined) {
          updateFields['preferences.notifications.smartFiltering.minRecommendationScore'] = notifs.smartFiltering.minRecommendationScore;
        }
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided' },
        { status: 400 }
      );
    }

    const user = await User.findOneAndUpdate(
      { email: session.user.email },
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('preferences');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Preferences updated',
      preferences: user.preferences
    });
  } catch (error: any) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
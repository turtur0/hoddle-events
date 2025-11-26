'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import {
  LogOut,
  Settings,
  Loader2,
  User,
  Search,
  Target,
  TrendingUp,
  Bell,
  Mail,
  Sparkles,
  DollarSign,
  Zap,
  Filter,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { BackButton } from '@/components/navigation/BackButton';

interface NotificationSettings {
  inApp: boolean;
  email: boolean;
  emailFrequency: 'daily' | 'weekly';
  keywords?: string[];
  smartFiltering?: {
    enabled: boolean;
    minRecommendationScore: number;
  };
  popularityFilter?: 'all' | 'mainstream' | 'niche' | 'personalized';
}

interface UserPreferences {
  selectedCategories: string[];
  selectedSubcategories: string[];
  popularityPreference: number;
  priceRange?: { min: number; max: number };
  notifications: NotificationSettings;
}

const POPULARITY_CONFIG = {
  0: { label: 'Niche', icon: Search, description: 'Hidden gems and unique events' },
  0.5: { label: 'Balanced', icon: Target, description: 'Mix of popular and niche' },
  1: { label: 'Mainstream', icon: TrendingUp, description: 'Popular and trending events' },
};

export default function Profile() {
  const { data: session, status } = useSession();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect unauthenticated users
  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth/signin?callbackUrl=/profile';
    }
  }, [status]);

  // Fetch user preferences
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch('/api/user/preferences');
        const data = await res.json();
        setPreferences(data.preferences);
      } catch (error) {
        console.error('Error fetching preferences:', error);
      } finally {
        setIsLoading(false);
      }
    }

    if (status === 'authenticated') {
      fetchPreferences();
    }
  }, [status]);

  async function handleSignOut() {
    await signOut({ redirect: true, callbackUrl: '/' });
  }

  // Get popularity configuration based on preference value
  const getPopularityConfig = (value: number) => {
    if (value <= 0.25) return POPULARITY_CONFIG[0];
    if (value >= 0.75) return POPULARITY_CONFIG[1];
    return POPULARITY_CONFIG[0.5];
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const popularityConfig = preferences ? getPopularityConfig(preferences.popularityPreference) : null;
  const PopularityIcon = popularityConfig?.icon;

  return (
    <div className="w-full min-h-screen bg-linear-to-b from-background to-muted/20">
      {/* Header Section */}
      <section className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <BackButton fallbackUrl="/" className="mb-6" />

          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">My Profile</h1>
              <p className="text-muted-foreground mt-1">
                Manage your account and preferences
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="space-y-6">
          {/* Account Info Card */}
          <Card className="border-2 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-2">
                <CardTitle className="text-2xl">{session?.user?.name}</CardTitle>
                <CardDescription className="space-y-1">
                  <div className="flex items-center gap-2 text-base">
                    <Mail className="h-4 w-4" />
                    {session?.user?.email}
                  </div>
                  {session?.user?.username && (
                    <div className="text-sm text-muted-foreground/80">
                      @{session.user.username}
                    </div>
                  )}
                </CardDescription>
              </div>
              <Link href="/settings">
                <Button variant="outline" size="default" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Edit Profile
                </Button>
              </Link>
            </CardHeader>
          </Card>

          {/* Preferences Overview Card */}
          {preferences && (
            <Card className="border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Your Preferences
                </CardTitle>
                <CardDescription>
                  Customize your event discovery experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Categories */}
                {preferences.selectedCategories.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Interested Categories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {preferences.selectedCategories.map((cat) => (
                        <Badge key={cat} className="px-4 py-2 text-sm capitalize">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subcategories */}
                {preferences.selectedSubcategories.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                        Specific Interests
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {preferences.selectedSubcategories.map((sub) => (
                          <Badge key={sub} variant="secondary" className="px-3 py-1.5 text-sm">
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Popularity Preference */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Event Type Preference
                  </h3>
                  {popularityConfig && PopularityIcon && (
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <PopularityIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{popularityConfig.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {popularityConfig.description}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Price Range */}
                {preferences.priceRange && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Price Range
                      </h3>
                      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                        <div className="text-base">
                          ${preferences.priceRange.min} - ${preferences.priceRange.max}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          (Free events always included)
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Notifications */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Notifications
                  </h3>
                  <div className="space-y-2">
                    {/* In-App Notifications */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                      <div className={`rounded-md p-1.5 ${preferences.notifications.inApp ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Bell className={`h-4 w-4 ${preferences.notifications.inApp ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">In-App Notifications</div>
                        <div className="text-xs text-muted-foreground">
                          {preferences.notifications.inApp ? 'Enabled' : 'Disabled'}
                        </div>
                      </div>
                    </div>

                    {/* Email Notifications */}
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                      <div className={`rounded-md p-1.5 ${preferences.notifications.email ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Mail className={`h-4 w-4 ${preferences.notifications.email ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Email Notifications</div>
                        <div className="text-xs text-muted-foreground">
                          {preferences.notifications.email
                            ? `${preferences.notifications.emailFrequency} digest`
                            : 'Disabled'}
                        </div>
                      </div>
                    </div>

                    {/* Smart Filtering */}
                    {preferences.notifications.smartFiltering?.enabled && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                        <div className="rounded-md p-1.5 bg-primary/10">
                          <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">Smart Filtering</div>
                          <div className="text-xs text-muted-foreground">
                            Minimum {Math.round((preferences.notifications.smartFiltering.minRecommendationScore || 0.6) * 100)}% match score
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Keywords */}
                    {preferences.notifications.keywords && preferences.notifications.keywords.length > 0 && (
                      <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                        <div className="rounded-md p-1.5 bg-primary/10 mt-0.5">
                          <Filter className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium mb-1">Keywords</div>
                          <div className="flex flex-wrap gap-1.5">
                            {preferences.notifications.keywords.map((keyword, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sign Out Button */}
          <Button
            variant="destructive"
            size="lg"
            className="w-full gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </section>
    </div>
  );
}
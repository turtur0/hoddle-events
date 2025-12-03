'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { PageLayout } from '@/components/layout/PageLayout';
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
  Package,
  Heart
} from 'lucide-react';

interface NotificationSettings {
  inApp: boolean;
  email: boolean;
  emailFrequency: 'weekly' | 'monthly';
  keywords?: string[];
  smartFiltering?: {
    enabled: boolean;
    minRecommendationScore: number;
  };
  includeFavouriteUpdates?: boolean;
  recommendationsSize?: 'minimal' | 'moderate' | 'comprehensive' | 'custom';
  customRecommendationsCount?: number;
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
} as const;

const RECOMMENDATIONS_SIZE_CONFIG = {
  minimal: { label: 'Minimal', count: '3 events', description: 'Quick highlights' },
  moderate: { label: 'Moderate', count: '5 events', description: 'Balanced selection' },
  comprehensive: { label: 'Comprehensive', count: '10 events', description: 'Full digest' },
  custom: { label: 'Custom', count: 'Custom count', description: 'Your choice' },
} as const;

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth/signin?callbackUrl=/profile';
    }
  }, [status]);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await fetch('/api/user/preferences');
        const data = await res.json();
        setPreferences(data.preferences);
      } catch (error) {
        console.error('Error fetching preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchPreferences();
    }
  }, [status]);

  const handleSignOut = () => signOut({ redirect: true, callbackUrl: '/' });

  const getPopularityConfig = (value: number) => {
    if (value <= 0.25) return POPULARITY_CONFIG[0];
    if (value >= 0.75) return POPULARITY_CONFIG[1];
    return POPULARITY_CONFIG[0.5];
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-centre justify-centre">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading profile" />
      </div>
    );
  }

  const popularityConfig = preferences ? getPopularityConfig(preferences.popularityPreference) : null;
  const PopularityIcon = popularityConfig?.icon;

  const recommendationsConfig = preferences?.notifications.recommendationsSize
    ? RECOMMENDATIONS_SIZE_CONFIG[preferences.notifications.recommendationsSize]
    : null;

  return (
    <PageLayout
      icon={User}
      iconColor="text-primary"
      iconBgColor="bg-primary/10 ring-1 ring-primary/20"
      title="My Profile"
      description="Manage your account and preferences"
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Account Information Card */}
        <Card className="border-2 shadow-sm hover-lift">
          <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-4 sm:space-y-0">
            <div className="space-y-2">
              <CardTitle className="text-2xl">{session?.user?.name}</CardTitle>
              <CardDescription className="space-y-1">
                <div className="flex items-centre gap-2 text-base">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>{session?.user?.email}</span>
                </div>
                {session?.user?.username && (
                  <div className="text-sm text-muted-foreground/80">
                    @{session.user.username}
                  </div>
                )}
              </CardDescription>
            </div>
            <Link href="/settings">
              <Button
                variant="outline"
                size="default"
                className="gap-2 border-2 hover:border-primary/50 hover:bg-primary/10 transition-all hover-lift w-full sm:w-auto"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Edit Profile
              </Button>
            </Link>
          </CardHeader>
        </Card>

        {/* Preferences Overview Card */}
        {preferences && (
          <Card className="border-2 shadow-sm hover-lift">
            <CardHeader>
              <CardTitle className="text-xl flex items-centre gap-2">
                <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                Your Preferences
              </CardTitle>
              <CardDescription>
                Customise your event discovery experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Categories */}
              {preferences.selectedCategories.length > 0 && (
                <section className="space-y-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Interested Categories
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preferences.selectedCategories.map((category) => (
                      <Badge
                        key={category}
                        className="px-4 py-2 text-sm capitalize bg-primary/10 text-primary border-2 border-primary/20 hover:bg-primary/15 transition-colours"
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Subcategories */}
              {preferences.selectedSubcategories.length > 0 && (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Specific Interests
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {preferences.selectedSubcategories.map((subcategory) => (
                        <Badge
                          key={subcategory}
                          className="px-4 py-2 text-sm capitalize bg-teal-500/8 text-teal-600 dark:text-teal-400 dark:bg-teal-400/10 border-2 border-teal-500/20 dark:border-teal-400/20 hover:bg-teal-500/15 dark:hover:bg-teal-400/15 transition-colours"
                        >
                          {subcategory}
                        </Badge>
                      ))}
                    </div>
                  </section>
                </>
              )}

              <Separator />

              {/* Popularity Preference */}
              <section className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Event Type Preference
                </h3>
                {popularityConfig && PopularityIcon && (
                  <div className="flex items-centre gap-3 p-4 bg-muted/50 rounded-lg border-2 hover-lift transition-all">
                    <div className="rounded-lg bg-primary/10 p-2" aria-hidden="true">
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
              </section>

              {/* Price Range */}
              {preferences.priceRange && (
                <>
                  <Separator />
                  <section className="space-y-3">
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-centre gap-2">
                      <DollarSign className="h-4 w-4" aria-hidden="true" />
                      Price Range
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-centre gap-2 sm:gap-3 p-4 bg-muted/50 rounded-lg border-2 hover-lift transition-all">
                      <div className="text-base font-medium">
                        ${preferences.priceRange.min} - ${preferences.priceRange.max}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        (Free events always included)
                      </span>
                    </div>
                  </section>
                </>
              )}

              <Separator />

              {/* Notifications */}
              <section className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-centre gap-2">
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  Notifications
                </h3>
                <div className="space-y-2">
                  {/* In-App Notifications */}
                  <div className="flex items-centre gap-3 p-3 bg-muted/50 rounded-lg border-2 hover-lift transition-all">
                    <div className={`rounded-md p-1.5 ${preferences.notifications.inApp ? 'bg-primary/10' : 'bg-muted'}`} aria-hidden="true">
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
                  <div className="flex items-centre gap-3 p-3 bg-muted/50 rounded-lg border-2 hover-lift transition-all">
                    <div className={`rounded-md p-1.5 ${preferences.notifications.email ? 'bg-primary/10' : 'bg-muted'}`} aria-hidden="true">
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
                    <div className="flex items-centre gap-3 p-3 bg-muted/50 rounded-lg border-2 hover-lift transition-all">
                      <div className="rounded-md p-1.5 bg-primary/10" aria-hidden="true">
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

                  {/* Favourite Updates */}
                  {preferences.notifications.includeFavouriteUpdates && (
                    <div className="flex items-centre gap-3 p-3 bg-muted/50 rounded-lg border-2 hover-lift transition-all">
                      <div className="rounded-md p-1.5 bg-primary/10" aria-hidden="true">
                        <Heart className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Favourite Updates</div>
                        <div className="text-xs text-muted-foreground">
                          Get notified about changes to favourited events
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Recommendations Size */}
                  {recommendationsConfig && preferences.notifications.email && (
                    <div className="flex items-centre gap-3 p-3 bg-muted/50 rounded-lg border-2 hover-lift transition-all">
                      <div className="rounded-md p-1.5 bg-primary/10" aria-hidden="true">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">Email Digest Size</div>
                        <div className="text-xs text-muted-foreground">
                          {recommendationsConfig.label} - {
                            preferences.notifications.recommendationsSize === 'custom' && preferences.notifications.customRecommendationsCount
                              ? `${preferences.notifications.customRecommendationsCount} events`
                              : recommendationsConfig.count
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Keywords */}
                  {preferences.notifications.keywords && preferences.notifications.keywords.length > 0 && (
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border-2 hover-lift transition-all">
                      <div className="rounded-md p-1.5 bg-primary/10 mt-0.5" aria-hidden="true">
                        <Filter className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium mb-1">Keywords</div>
                        <div className="flex flex-wrap gap-1.5">
                          {preferences.notifications.keywords.map((keyword, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs border-2">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </CardContent>
          </Card>
        )}

        {/* Sign Out Button */}
        <Button
          variant="destructive"
          size="lg"
          className="w-full gap-2 hover-lift"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sign Out
        </Button>
      </div>
    </PageLayout>
  );
}
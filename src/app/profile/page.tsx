'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings, ArrowLeft, Loader2, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useEnsureOnboarding } from '@/lib/hooks/useAuthRedirect';

interface UserPreferences {
  selectedCategories: string[];
  selectedSubcategories: string[];
  popularityPreference: number;
  notifications: {
    inApp: boolean;
    email: boolean;
    emailFrequency: string;
  };
}

export default function Profile() {
  const { session, status } = useEnsureOnboarding();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

    if (status !== 'loading') {
      fetchPreferences();
    }
  }, [status]);

  async function handleSignOut() {
    await signOut({ redirect: true, callbackUrl: '/' });
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <section className="bg-gradient-to-b from-primary/5 to-background">
        <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>

          <div className="flex items-center gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <User className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-1">My Profile</h1>
              <p className="text-muted-foreground">
                Manage your account and preferences
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="space-y-6">
          {/* Account Info Card */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-2xl">{session?.user?.name}</CardTitle>
                <CardDescription className="text-base mt-2">
                  {session?.user?.email}
                  {session?.user?.username && (
                    <span className="block text-sm mt-1 text-muted-foreground/80">
                      @{session.user.username}
                    </span>
                  )}
                </CardDescription>
              </div>
              <Link href="/profile/settings">
                <Button variant="outline" size="default">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
            </CardHeader>
          </Card>

          {/* Preferences Card */}
          {preferences && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Your Preferences</CardTitle>
                <CardDescription>
                  Customize your event discovery experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-3 text-base">Interested Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {preferences.selectedCategories.map((cat) => (
                      <Badge key={cat} className="px-4 py-2 text-sm capitalize">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                </div>

                {preferences.selectedSubcategories.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3 text-base">Specific Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {preferences.selectedSubcategories.map((sub) => (
                        <Badge key={sub} variant="secondary" className="px-3 py-1.5 text-sm">
                          {sub}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2 text-base">Event Type Preference</h3>
                  <p className="text-base">
                    {preferences.popularityPreference === 0
                      ? '🔍 Niche & Hidden Gems'
                      : preferences.popularityPreference === 1
                        ? '⭐ Popular Mainstream Events'
                        : '🎯 Balanced Mix of Both'}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-base">Notifications</h3>
                  <p className="text-base">
                    {preferences.notifications.email
                      ? `📧 Email updates: ${preferences.notifications.emailFrequency}`
                      : '🔕 Email notifications disabled'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sign Out Button */}
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </section>
    </div>
  );
}
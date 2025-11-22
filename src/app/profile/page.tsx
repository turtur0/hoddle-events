'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Settings, ArrowLeft, Loader2 } from 'lucide-react';
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
    <div className="w-full bg-background p-4">
      <div className="max-w-2xl mx-auto py-8">
        <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to events
        </Link>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{session?.user?.name}</CardTitle>
                <CardDescription>
                  {session?.user?.email}
                  {session?.user?.username && (
                    <span className="block text-xs mt-1">@{session.user.username}</span>
                  )}
                </CardDescription>
              </div>
              <Link href="/profile/settings">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </Link>
            </CardHeader>
          </Card>

          {preferences && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Interested Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {preferences.selectedCategories.map((cat) => (
                      <span key={cat} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm capitalize">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {preferences.selectedSubcategories.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Specific Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {preferences.selectedSubcategories.map((sub) => (
                        <span key={sub} className="px-2 py-1 bg-muted text-sm rounded">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-2">Event Type</h3>
                  <p className="text-sm">
                    {preferences.popularityPreference === 0
                      ? '🔍 Niche & Hidden Gems'
                      : preferences.popularityPreference === 1
                        ? '⭐ Popular Mainstream'
                        : '🎯 Balanced Mix'}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Notifications</h3>
                  <p className="text-sm">
                    {preferences.notifications.email
                      ? `📧 Email: ${preferences.notifications.emailFrequency}`
                      : 'Email notifications disabled'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
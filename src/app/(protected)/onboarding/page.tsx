// app/(auth)/onboarding/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Loader2, ChevronRight, Bell, Sparkles, User } from 'lucide-react';
import { useRequireOnboarding } from '@/lib/hooks/use-auth-redirect';
import { PopularitySelector } from '@/components/preferences/PopularitySelector';
import { CategorySelector } from '@/components/preferences/CategorySelector';
import { NotificationSettings } from '@/components/preferences/NotificationSettings';
import { PriceRangeSelector } from '@/components/preferences/PriceRangeSelector';
import { CATEGORIES } from '@/lib/constants/categories';

const MIN_CATEGORIES = 2;
type Step = 'username' | 'categories' | 'preferences' | 'notifications';

export default function Onboarding() {
    const router = useRouter();
    const { session, status } = useRequireOnboarding();

    const [step, setStep] = useState<Step>('categories');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Username
    const [username, setUsername] = useState('');
    const [needsUsername, setNeedsUsername] = useState(false);

    // Categories
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedSubcategories, setSelectedSubcategories] = useState<Set<string>>(new Set());

    // Preferences
    const [popularityPref, setPopularityPref] = useState(0.5);
    const [priceMin, setPriceMin] = useState(0);
    const [priceMax, setPriceMax] = useState(500);

    // Notifications
    const [inAppNotifications, setInAppNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(false);
    const [emailFrequency, setEmailFrequency] = useState<'weekly' | 'monthly'>('weekly');
    const [notificationKeywords, setNotificationKeywords] = useState('');
    const [useSmartFiltering, setUseSmartFiltering] = useState(true);
    const [minRecommendationScore, setMinRecommendationScore] = useState(0.6);

    useEffect(() => {
        if (session?.user && !session.user.username) {
            setNeedsUsername(true);
            setStep('username');
        }
    }, [session]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const toggleCategory = (categoryValue: string) => {
        const newSet = new Set(selectedCategories);
        if (newSet.has(categoryValue)) {
            newSet.delete(categoryValue);
            const category = CATEGORIES.find(c => c.value === categoryValue);
            if (category?.subcategories) {
                const newSubs = new Set(selectedSubcategories);
                category.subcategories.forEach(sub => newSubs.delete(sub));
                setSelectedSubcategories(newSubs);
            }
        } else {
            newSet.add(categoryValue);
        }
        setSelectedCategories(newSet);
        setError('');
    };

    const toggleSubcategory = (subcategoryValue: string) => {
        const newSet = new Set(selectedSubcategories);
        newSet.has(subcategoryValue) ? newSet.delete(subcategoryValue) : newSet.add(subcategoryValue);
        setSelectedSubcategories(newSet);
    };

    const handleUsernameSubmit = async () => {
        if (!username || username.length < 3) {
            setError('Username must be at least 3 characters');
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/user/username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to set username');
            }

            setError('');
            setStep('categories');
        } catch (error: any) {
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);
        setError('');

        try {
            const keywords = notificationKeywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);

            const res = await fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedCategories: Array.from(selectedCategories),
                    selectedSubcategories: Array.from(selectedSubcategories),
                    popularityPreference: popularityPref,
                    priceRange: { min: priceMin, max: priceMax },
                    notifications: {
                        inApp: inAppNotifications,
                        email: emailNotifications,
                        emailFrequency: emailNotifications ? emailFrequency : 'weekly',
                        keywords,
                        smartFiltering: {
                            enabled: useSmartFiltering,
                            minRecommendationScore,
                        },
                    },
                }),
            });

            if (!res.ok) throw new Error('Failed to save preferences');

            await fetch('/api/auth/session?update=true');
            await new Promise(resolve => setTimeout(resolve, 500));
            window.location.href = '/';
        } catch (error: any) {
            setError(error.message || 'Failed to save preferences');
            setIsLoading(false);
        }
    };

    const allSteps: Step[] = needsUsername
        ? ['username', 'categories', 'preferences', 'notifications']
        : ['categories', 'preferences', 'notifications'];

    const getStepIcon = (stepName: Step) => {
        switch (stepName) {
            case 'username': return User;
            case 'categories': return Sparkles;
            case 'preferences': return Sparkles;
            case 'notifications': return Bell;
        }
    };

    const currentStepIcon = getStepIcon(step);

    return (
        <div className="w-full min-h-screen bg-linear-to-b from-background via-orange-50/30 to-background dark:from-background dark:via-orange-950/5 dark:to-background">
            <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                {/* Header */}
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 ring-1 ring-primary/20">
                        {currentStepIcon && (() => {
                            const Icon = currentStepIcon;
                            return <Icon className="h-8 w-8 text-primary" />;
                        })()}
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold mb-2">Personalize Your Experience</h1>
                    <p className="text-lg text-muted-foreground">
                        Tell us what you like, and we'll find the best events for you
                    </p>
                </div>

                {/* Username Step */}
                {step === 'username' && (
                    <Card className="border-2 shadow-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-2xl">Choose a Username</CardTitle>
                            <CardDescription className="text-base">
                                Pick a unique username for your account (optional)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-lg text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-base font-medium">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="johndoe"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={isLoading}
                                    className="h-12"
                                />
                                <p className="text-sm text-muted-foreground">
                                    Letters, numbers, and underscores only (min. 3 characters)
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('categories')}
                                    className="flex-1 h-12"
                                    disabled={isLoading}
                                    size="lg"
                                >
                                    Skip
                                </Button>
                                <Button
                                    onClick={handleUsernameSubmit}
                                    className="flex-1 h-12 group"
                                    disabled={isLoading}
                                    size="lg"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Continue
                                            <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Categories Step */}
                {step === 'categories' && (
                    <Card className="border-2 shadow-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-2xl">What interests you?</CardTitle>
                            <CardDescription className="text-base">
                                Select at least {MIN_CATEGORIES} categories, then refine with specific interests
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-lg text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            <CategorySelector
                                selectedCategories={selectedCategories}
                                selectedSubcategories={selectedSubcategories}
                                onCategoryToggle={toggleCategory}
                                onSubcategoryToggle={toggleSubcategory}
                                showSubcategories={true}
                                variant="default"
                            />

                            <Button
                                onClick={() => {
                                    if (selectedCategories.size < MIN_CATEGORIES) {
                                        setError(`Please select at least ${MIN_CATEGORIES} categories`);
                                        return;
                                    }
                                    setError('');
                                    setStep('preferences');
                                }}
                                className="w-full h-12 group"
                                size="lg"
                            >
                                Continue
                                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Preferences Step */}
                {step === 'preferences' && (
                    <Card className="border-2 shadow-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <Sparkles className="h-6 w-6 text-primary" />
                                Event Preferences
                            </CardTitle>
                            <CardDescription className="text-base">
                                Customize your event discovery experience
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <Label className="text-base font-medium">What type of events do you prefer?</Label>
                                <PopularitySelector
                                    value={popularityPref}
                                    onChange={setPopularityPref}
                                    variant="buttons"
                                />
                            </div>

                            <PriceRangeSelector
                                priceMin={priceMin}
                                priceMax={priceMax}
                                onMinChange={setPriceMin}
                                onMaxChange={setPriceMax}
                            />

                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" onClick={() => setStep('categories')} className="flex-1 h-12" size="lg">
                                    Back
                                </Button>
                                <Button onClick={() => setStep('notifications')} className="flex-1 h-12 group" size="lg">
                                    Continue
                                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Notifications Step */}
                {step === 'notifications' && (
                    <Card className="border-2 shadow-sm animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <Bell className="h-6 w-6 text-primary" />
                                Notification Preferences
                            </CardTitle>
                            <CardDescription className="text-base">
                                Get notified about events you'll love
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <NotificationSettings
                                inAppNotifications={inAppNotifications}
                                emailNotifications={emailNotifications}
                                emailFrequency={emailFrequency as any}
                                keywords={notificationKeywords}
                                useSmartFiltering={useSmartFiltering}
                                minRecommendationScore={minRecommendationScore}
                                onInAppChange={setInAppNotifications}
                                onEmailChange={setEmailNotifications}
                                onFrequencyChange={setEmailFrequency as any}
                                onKeywordsChange={setNotificationKeywords}
                                onSmartFilteringChange={setUseSmartFiltering}
                                onScoreChange={setMinRecommendationScore}
                                variant="onboarding"
                            />

                            {error && (
                                <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-lg text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" onClick={() => setStep('preferences')} className="flex-1 h-12" size="lg">
                                    Back
                                </Button>
                                <Button onClick={handleComplete} disabled={isLoading} className="flex-1 h-12 group" size="lg">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Complete Setup
                                            <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Progress Indicator */}
                <div className="flex gap-2 mt-12 justify-center">
                    {allSteps.map((s, idx) => {
                        const currentIdx = allSteps.indexOf(step);
                        return (
                            <div
                                key={s}
                                className={`h-2 rounded-full transition-all duration-300 ${step === s
                                    ? 'bg-primary w-12'
                                    : idx < currentIdx
                                        ? 'bg-primary/60 w-2'
                                        : 'bg-border w-2'
                                    }`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
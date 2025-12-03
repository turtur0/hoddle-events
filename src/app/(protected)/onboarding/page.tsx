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
import type { DigestRecommendationsSize } from '@/lib/constants/preferences';

const MIN_CATEGORIES = 2;
type Step = 'username' | 'categories' | 'preferences' | 'notifications';
type EmailFrequency = 'weekly' | 'monthly';

const STEP_CONFIG = {
    username: { icon: User, title: 'Choose a Username', description: 'Pick a unique username for your account (optional)' },
    categories: { icon: Sparkles, title: 'What interests you?', description: `Select at least ${MIN_CATEGORIES} categories, then refine with specific interests` },
    preferences: { icon: Sparkles, title: 'Event Preferences', description: 'Customise your event discovery experience' },
    notifications: { icon: Bell, title: 'Notification Preferences', description: 'Get notified about events you\'ll love' },
} as const;

export default function Onboarding() {
    const router = useRouter();
    const { session, status } = useRequireOnboarding();

    const [step, setStep] = useState<Step>('categories');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [username, setUsername] = useState('');
    const [needsUsername, setNeedsUsername] = useState(false);

    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedSubcategories, setSelectedSubcategories] = useState<Set<string>>(new Set());

    const [popularityPref, setPopularityPref] = useState(0.5);
    const [priceMin, setPriceMin] = useState(0);
    const [priceMax, setPriceMax] = useState(500);

    const [inAppNotifications, setInAppNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(false);
    const [emailFrequency, setEmailFrequency] = useState<EmailFrequency>('weekly');
    const [notificationKeywords, setNotificationKeywords] = useState('');
    const [useSmartFiltering, setUseSmartFiltering] = useState(true);
    const [minRecommendationScore, setMinRecommendationScore] = useState(0.6);
    const [includeFavouriteUpdates, setIncludeFavouriteUpdates] = useState(true);
    const [recommendationsSize, setRecommendationsSize] = useState<DigestRecommendationsSize>('moderate');
    const [customRecommendationsCount, setCustomRecommendationsCount] = useState(5);

    useEffect(() => {
        if (session?.user && !session.user.username) {
            setNeedsUsername(true);
            setStep('username');
        }
    }, [session]);

    const toggleCategory = (categoryValue: string) => {
        const newCategories = new Set(selectedCategories);

        if (newCategories.has(categoryValue)) {
            newCategories.delete(categoryValue);
            const category = CATEGORIES.find(c => c.value === categoryValue);
            if (category?.subcategories) {
                const newSubs = new Set(selectedSubcategories);
                category.subcategories.forEach(sub => newSubs.delete(sub));
                setSelectedSubcategories(newSubs);
            }
        } else {
            newCategories.add(categoryValue);
        }

        setSelectedCategories(newCategories);
        setError('');
    };

    const toggleSubcategory = (subcategoryValue: string) => {
        const newSubs = new Set(selectedSubcategories);
        newSubs.has(subcategoryValue) ? newSubs.delete(subcategoryValue) : newSubs.add(subcategoryValue);
        setSelectedSubcategories(newSubs);
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
                body: JSON.stringify({ username }), // Keep original case
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to set username');
            }

            setError('');
            setStep('categories');
        } catch (err: any) {
            setError(err.message);
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
                        includeFavouriteUpdates,
                        recommendationsSize,
                        customRecommendationsCount,
                    },
                }),
            });

            if (!res.ok) throw new Error('Failed to save preferences');

            await fetch('/api/auth/session?update=true');
            await new Promise(resolve => setTimeout(resolve, 500));
            window.location.href = '/';
        } catch (err: any) {
            setError(err.message || 'Failed to save preferences');
            setIsLoading(false);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-centre justify-centre">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
            </div>
        );
    }

    const allSteps: Step[] = needsUsername
        ? ['username', 'categories', 'preferences', 'notifications']
        : ['categories', 'preferences', 'notifications'];

    const currentStepConfig = STEP_CONFIG[step];
    const StepIcon = currentStepConfig.icon;

    return (
        <div className="w-full min-h-screen bg-linear-to-b from-primary/5 via-background to-background">
            <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <header className="mb-8">
                    <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                        <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20" aria-hidden="true">
                            <StepIcon className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-2">
                                Personalise Your Experience
                            </h1>
                            <p className="text-base sm:text-lg text-muted-foreground">
                                Tell us what you like, and we'll find the best events for you
                            </p>
                        </div>
                    </div>
                </header>

                {step === 'username' && (
                    <Card className="border-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-xl sm:text-2xl">{currentStepConfig.title}</CardTitle>
                            <CardDescription className="text-sm sm:text-base">
                                {currentStepConfig.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-lg text-destructive text-sm" role="alert">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="username" className="text-base font-medium">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="JohnDoe"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={isLoading}
                                    className="h-12 border-2"
                                    aria-describedby="username-hint"
                                />
                                <p id="username-hint" className="text-sm text-muted-foreground">
                                    Letters, numbers, and underscores only (min. 3 characters)
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('categories')}
                                    className="flex-1 h-12 border-2"
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
                                            <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {step === 'categories' && (
                    <Card className="border-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-xl sm:text-2xl">{currentStepConfig.title}</CardTitle>
                            <CardDescription className="text-sm sm:text-base">
                                {currentStepConfig.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-lg text-destructive text-sm" role="alert">
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
                                <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {step === 'preferences' && (
                    <Card className="border-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-xl sm:text-2xl flex items-centre gap-2">
                                <Sparkles className="h-5 w-6 text-primary" aria-hidden="true" />
                                {currentStepConfig.title}
                            </CardTitle>
                            <CardDescription className="text-sm sm:text-base">
                                {currentStepConfig.description}
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

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('categories')}
                                    className="flex-1 h-12 border-2"
                                    size="lg"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={() => setStep('notifications')}
                                    className="flex-1 h-12 group"
                                    size="lg"
                                >
                                    Continue
                                    <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {step === 'notifications' && (
                    <Card className="border-2 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                        <CardHeader>
                            <CardTitle className="text-xl sm:text-2xl flex items-centre gap-2">
                                <Bell className="h-5 w-6 text-primary" aria-hidden="true" />
                                {currentStepConfig.title}
                            </CardTitle>
                            <CardDescription className="text-sm sm:text-base">
                                {currentStepConfig.description}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <NotificationSettings
                                inAppNotifications={inAppNotifications}
                                emailNotifications={emailNotifications}
                                emailFrequency={emailFrequency}
                                keywords={notificationKeywords}
                                useSmartFiltering={useSmartFiltering}
                                minRecommendationScore={minRecommendationScore}
                                includeFavouriteUpdates={includeFavouriteUpdates}
                                recommendationsSize={recommendationsSize}
                                customRecommendationsCount={customRecommendationsCount}
                                onInAppChange={setInAppNotifications}
                                onEmailChange={setEmailNotifications}
                                onFrequencyChange={setEmailFrequency}
                                onKeywordsChange={setNotificationKeywords}
                                onSmartFilteringChange={setUseSmartFiltering}
                                onScoreChange={setMinRecommendationScore}
                                onFavouriteUpdatesChange={setIncludeFavouriteUpdates}
                                onRecommendationsSizeChange={setRecommendationsSize}
                                onCustomCountChange={setCustomRecommendationsCount}
                                variant="onboarding"
                            />

                            {error && (
                                <div className="p-4 bg-destructive/10 border-2 border-destructive/20 rounded-lg text-destructive text-sm" role="alert">
                                    {error}
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setStep('preferences')}
                                    className="flex-1 h-12 border-2"
                                    size="lg"
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleComplete}
                                    disabled={isLoading}
                                    className="flex-1 h-12 group"
                                    size="lg"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Complete Setup
                                            <ChevronRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <nav className="flex gap-2 mt-12 justify-centre" aria-label="Onboarding progress">
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
                                role="progressbar"
                                aria-valuenow={idx < currentIdx ? 100 : step === s ? 50 : 0}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`Step ${idx + 1}: ${STEP_CONFIG[s].title}`}
                            />
                        );
                    })}
                </nav>
            </div>
        </div>
    );
}
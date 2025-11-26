'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CATEGORIES } from '@/lib/constants/categories';
import {
    Loader2,
    ChevronRight,
    Check,
    Bell,
    Filter,
    Zap,
    DollarSign,
    Mail,
    Sparkles,
    TrendingUp,
    Target,
    Gem
} from 'lucide-react';
import { useRequireOnboarding } from '@/lib/hooks/useAuthRedirect';
import { PopularitySelector } from '@/components/preferences/popularity-selector';
import { POPULARITY_OPTIONS } from '@/lib/constants/preferences';

const MIN_CATEGORIES = 2;
type Step = 'username' | 'categories' | 'preferences' | 'notifications';

export default function Onboarding() {
    const router = useRouter();
    const { session, status } = useRequireOnboarding();

    // Step management
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
    const [popularityFilter, setPopularityFilter] = useState<'all' | 'mainstream' | 'niche' | 'personalized'>('personalized');

    // Check if username is needed
    useEffect(() => {
        if (session?.user && !session.user.username) {
            setNeedsUsername(true);
            setStep('username');
        }
    }, [session]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const toggleCategory = (categoryValue: string) => {
        const newSet = new Set(selectedCategories);
        if (newSet.has(categoryValue)) {
            newSet.delete(categoryValue);
            // Remove associated subcategories
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

    const handleContinueFromCategories = () => {
        if (selectedCategories.size < MIN_CATEGORIES) {
            setError(`Please select at least ${MIN_CATEGORIES} categories`);
            return;
        }
        setError('');
        setStep('preferences');
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
                        popularityFilter,
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

    const popularityOptions = [
        { value: 0, label: 'Niche', icon: Gem, description: 'Hidden indie events, smaller venues, emerging artists' },
        { value: 0.5, label: 'Balanced', icon: Target, description: 'Mix of both popular and unique events' },
        { value: 1, label: 'Mainstream', icon: TrendingUp, description: 'Popular events, major venues, well-known acts' },
    ];

    return (
        <div className="w-full min-h-screen bg-linear-to-br from-background via-muted/20 to-background">
            <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                {/* Header */}
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold mb-3">Personalize Your Experience</h1>
                    <p className="text-lg text-muted-foreground">
                        Tell us what you like, and we'll find the best events for you
                    </p>
                </div>

                {/* Username Step */}
                {step === 'username' && (
                    <Card className="border-2">
                        <CardHeader>
                            <CardTitle className="text-2xl">Choose a Username</CardTitle>
                            <CardDescription className="text-base">
                                Pick a unique username for your account (optional)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-3">
                                <Label htmlFor="username" className="text-base font-medium">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="johndoe"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={isLoading}
                                    className="text-base h-12"
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
                                    className="flex-1 h-12"
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
                                            <ChevronRight className="ml-2 h-5 w-5" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Categories Step */}
                {step === 'categories' && (
                    <Card className="border-2">
                        <CardHeader>
                            <CardTitle className="text-2xl">What interests you?</CardTitle>
                            <CardDescription className="text-base">
                                Select at least {MIN_CATEGORIES} categories, then refine with specific interests
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Main categories */}
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map((category) => (
                                    <button
                                        key={category.value}
                                        onClick={() => toggleCategory(category.value)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategories.has(category.value)
                                            ? 'bg-primary text-primary-foreground shadow-sm'
                                            : 'bg-muted hover:bg-muted/80'
                                            }`}
                                    >
                                        {selectedCategories.has(category.value) && (
                                            <Check className="inline-block w-4 h-4 mr-1" />
                                        )}
                                        {category.label}
                                    </button>
                                ))}
                            </div>

                            {/* Subcategories */}
                            {selectedCategories.size > 0 && (
                                <div className="space-y-6 pt-4 border-t">
                                    <div>
                                        <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                                            Refine your interests (optional)
                                        </h3>
                                        {CATEGORIES.filter(cat => selectedCategories.has(cat.value)).map(category => (
                                            <div key={category.value} className="mb-4">
                                                <p className="text-sm font-medium mb-2">{category.label}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {category.subcategories?.map(sub => (
                                                        <button
                                                            key={sub}
                                                            onClick={() => toggleSubcategory(sub)}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedSubcategories.has(sub)
                                                                ? 'bg-primary/20 text-primary border border-primary'
                                                                : 'bg-background hover:bg-muted border border-border'
                                                                }`}
                                                        >
                                                            {sub}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <Button onClick={handleContinueFromCategories} className="w-full h-12" size="lg">
                                Continue
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Preferences Step */}
                {step === 'preferences' && (
                    <Card className="border-2">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <Sparkles className="h-6 w-6" />
                                Event Preferences
                            </CardTitle>
                            <CardDescription className="text-base">
                                Customize your event discovery experience
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Event Type Preference */}
                            <div className="space-y-4">
                                <Label className="text-base font-medium">What type of events do you prefer?</Label>
                                <PopularitySelector
                                    value={popularityPref}
                                    onChange={setPopularityPref}
                                    variant="buttons"
                                />
                                <p className="text-xs text-muted-foreground">
                                    {POPULARITY_OPTIONS.find(opt => opt.value === popularityPref)?.description}
                                </p>
                            </div>

                            {/* Price Range */}
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2 text-base font-medium">
                                    <DollarSign className="h-4 w-4" />
                                    Price Range
                                </Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="priceMin" className="text-xs text-muted-foreground">Minimum</Label>
                                        <Input
                                            id="priceMin"
                                            type="number"
                                            value={priceMin}
                                            onChange={(e) => setPriceMin(Number(e.target.value))}
                                            min={0}
                                            className="mt-1.5"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="priceMax" className="text-xs text-muted-foreground">Maximum</Label>
                                        <Input
                                            id="priceMax"
                                            type="number"
                                            value={priceMax}
                                            onChange={(e) => setPriceMax(Number(e.target.value))}
                                            min={0}
                                            className="mt-1.5"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Free events are always included
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" onClick={() => setStep('categories')} className="flex-1 h-12" size="lg">
                                    Back
                                </Button>
                                <Button onClick={() => setStep('notifications')} className="flex-1 h-12" size="lg">
                                    Continue
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Notifications Step */}
                {step === 'notifications' && (
                    <Card className="border-2">
                        <CardHeader>
                            <CardTitle className="text-2xl flex items-center gap-2">
                                <Bell className="h-6 w-6" />
                                Notification Preferences
                            </CardTitle>
                            <CardDescription className="text-base">
                                Get notified about events you'll love
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* In-App Notifications */}
                            <div className="flex items-start justify-between gap-4 p-4 bg-muted/50 rounded-lg border">
                                <div className="space-y-1 flex-1">
                                    <Label htmlFor="inApp" className="text-base font-medium cursor-pointer">
                                        In-App Notifications
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Get notified about new matching events
                                    </p>
                                </div>
                                <Checkbox
                                    id="inApp"
                                    checked={inAppNotifications}
                                    onCheckedChange={(checked) => setInAppNotifications(checked === true)}
                                    className="mt-1"
                                />
                            </div>

                            {/* Email Notifications */}
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-4 p-4 bg-muted/50 rounded-lg border">
                                    <div className="space-y-1 flex-1">
                                        <Label htmlFor="email" className="text-base font-medium cursor-pointer flex items-center gap-2">
                                            <Mail className="h-4 w-4" />
                                            Email Notifications
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Receive email digests
                                        </p>
                                    </div>
                                    <Checkbox
                                        id="email"
                                        checked={emailNotifications}
                                        onCheckedChange={(checked) => setEmailNotifications(checked === true)}
                                        className="mt-1"
                                    />
                                </div>
                            </div>

                            {emailNotifications && (
                                <div className="ml-4 p-4 bg-background border rounded-lg space-y-3">
                                    <Label className="text-sm font-medium">Email Frequency</Label>
                                    <div className="space-y-2">
                                        {(['weekly', 'monthly'] as const).map((freq) => (
                                            <div key={freq} className="flex items-center gap-3">
                                                <input
                                                    type="radio"
                                                    id={freq}
                                                    checked={emailFrequency === freq}
                                                    onChange={() => setEmailFrequency(freq)}
                                                    className="w-4 h-4 cursor-pointer"
                                                />
                                                <Label htmlFor={freq} className="cursor-pointer text-sm flex items-center gap-2">
                                                    <Mail className="h-3.5 w-3.5" />
                                                    {freq === 'weekly'
                                                        ? 'Weekly digest (Every Sunday at 6 PM)'
                                                        : 'Monthly digest (First Sunday of month)'}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Curated events matching your preferences, keyword alerts, and favourite updates
                                    </p>
                                </div>
                            )}

                            {/* Keywords */}
                            <div className="space-y-3">
                                <Label htmlFor="keywords" className="flex items-center gap-2 text-base font-medium">
                                    <Filter className="h-4 w-4" />
                                    Keywords (Optional)
                                </Label>
                                <Input
                                    id="keywords"
                                    value={notificationKeywords}
                                    onChange={(e) => setNotificationKeywords(e.target.value)}
                                    placeholder="e.g., taylor swift, hamilton, comedy"
                                    className="h-11"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Get priority notifications for these keywords (comma-separated)
                                </p>
                            </div>

                            {/* Smart Filtering */}
                            <div className="space-y-3">
                                <div className="flex items-start justify-between gap-4 p-4 bg-muted/50 rounded-lg border">
                                    <div className="space-y-1 flex-1">
                                        <Label htmlFor="smartFilter" className="text-base font-medium cursor-pointer flex items-center gap-2">
                                            <Zap className="h-4 w-4" />
                                            Smart Filtering
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Only notify about events matching your event type preference
                                        </p>
                                    </div>
                                    <Checkbox
                                        id="smartFilter"
                                        checked={useSmartFiltering}
                                        onCheckedChange={(checked) => setUseSmartFiltering(checked === true)}
                                        className="mt-1"
                                    />
                                </div>

                                {useSmartFiltering && (
                                    <div className="ml-4 p-4 bg-background border rounded-lg space-y-4">
                                        <div>
                                            <Label className="text-sm font-medium mb-3 block">
                                                Minimum Match Score: {Math.round(minRecommendationScore * 100)}%
                                            </Label>
                                            <Slider
                                                value={[minRecommendationScore]}
                                                onValueChange={([value]) => setMinRecommendationScore(value)}
                                                min={0.3}
                                                max={0.9}
                                                step={0.1}
                                                className="w-full"
                                            />
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Higher scores mean fewer but more relevant notifications
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-muted-foreground flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
                                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                You can always change these settings later in your profile
                            </p>

                            {error && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <Button variant="outline" onClick={() => setStep('preferences')} className="flex-1 h-12" size="lg">
                                    Back
                                </Button>
                                <Button onClick={handleComplete} disabled={isLoading} className="flex-1 h-12" size="lg">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Complete Setup
                                            <ChevronRight className="ml-2 h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Progress Indicator */}
                <div className="flex gap-3 mt-12 justify-center">
                    {allSteps.map((s, idx) => {
                        const currentIdx = allSteps.indexOf(step);
                        return (
                            <div
                                key={s}
                                className={`h-2 rounded-full transition-all ${step === s
                                    ? 'bg-primary w-12'
                                    : idx < currentIdx
                                        ? 'bg-primary/60 w-2'
                                        : 'bg-muted w-2'
                                    }`}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
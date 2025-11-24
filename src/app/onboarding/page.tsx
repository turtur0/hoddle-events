'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CATEGORIES } from '@/lib/categories';
import { Loader2, ChevronRight, Check } from 'lucide-react';
import { useRequireOnboarding } from '@/lib/hooks/useAuthRedirect';

const MIN_CATEGORIES = 2;
type Step = 'username' | 'categories' | 'preferences' | 'notifications';

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
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [emailFrequency, setEmailFrequency] = useState<'daily' | 'weekly'>('weekly');

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

    async function handleComplete() {
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    selectedCategories: Array.from(selectedCategories),
                    selectedSubcategories: Array.from(selectedSubcategories),
                    popularityPreference: popularityPref,
                    notifications: {
                        email: notificationsEnabled,
                        emailFrequency: notificationsEnabled ? emailFrequency : 'weekly',
                        inApp: true,
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
    }

    const allSteps: Step[] = needsUsername
        ? ['username', 'categories', 'preferences', 'notifications']
        : ['categories', 'preferences', 'notifications'];

    return (
        <div className="w-full min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
            <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
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
                                <label htmlFor="username" className="text-base font-medium">Username</label>
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

                {/* Step 1: Categories & Subcategories */}
                {step === 'categories' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>What interests you?</CardTitle>
                            <CardDescription>
                                Select at least {MIN_CATEGORIES} categories, then refine with specific interests
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                                    {error}
                                </div>
                            )}

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

                            <Button onClick={handleContinueFromCategories} className="w-full">
                                Continue
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Step 2: Preferences */}
                {step === 'preferences' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Event Preferences</CardTitle>
                            <CardDescription>Do you prefer mainstream or niche events?</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div>
                                <div className="flex justify-between mb-4">
                                    <Label>Event Type Preference</Label>
                                    <span className="text-sm font-semibold">
                                        {popularityPref === 0 ? 'Niche' : popularityPref === 1 ? 'Mainstream' : 'Balanced'}
                                    </span>
                                </div>

                                <div className="flex gap-2 bg-muted p-1 rounded-lg">
                                    {[
                                        { value: 0, label: 'Niche Gems', icon: '🔍' },
                                        { value: 0.5, label: 'Balanced', icon: '🎯' },
                                        { value: 1, label: 'Mainstream', icon: '⭐' },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => setPopularityPref(option.value)}
                                            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${popularityPref === option.value
                                                ? 'bg-primary text-primary-foreground shadow-sm'
                                                : 'hover:bg-background'
                                                }`}
                                        >
                                            <span className="mr-1">{option.icon}</span>
                                            {option.label}
                                        </button>
                                    ))}
                                </div>

                                <p className="text-xs text-muted-foreground mt-3">
                                    {popularityPref === 0
                                        ? 'Hidden indie events, smaller venues, emerging artists'
                                        : popularityPref === 1
                                            ? 'Popular events, major venues, well-known acts'
                                            : 'Mix of both popular and unique events'}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStep('categories')} className="flex-1">
                                    Back
                                </Button>
                                <Button onClick={() => setStep('notifications')} className="flex-1">
                                    Continue
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Step 3: Notifications */}
                {step === 'notifications' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Stay Updated</CardTitle>
                            <CardDescription>
                                How would you like to receive event recommendations?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id="email-notifications"
                                    checked={notificationsEnabled}
                                    onCheckedChange={(checked) => setNotificationsEnabled(checked === true)}
                                />
                                <Label htmlFor="email-notifications" className="cursor-pointer">
                                    Send me email updates about new events
                                </Label>
                            </div>

                            {notificationsEnabled && (
                                <div className="ml-6 space-y-3 p-4 bg-muted rounded-lg">
                                    <Label className="font-medium">Email Frequency</Label>
                                    <div className="space-y-2">
                                        {(['daily', 'weekly'] as const).map((freq) => (
                                            <div key={freq} className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    id={freq}
                                                    name="frequency"
                                                    value={freq}
                                                    checked={emailFrequency === freq}
                                                    onChange={(e) => setEmailFrequency(e.target.value as 'daily' | 'weekly')}
                                                    className="w-4 h-4"
                                                />
                                                <Label htmlFor={freq} className="cursor-pointer text-sm">
                                                    {freq === 'daily'
                                                        ? '📧 Daily digest (best events from today)'
                                                        : '📬 Weekly digest (highlights from the week)'}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground">
                                💡 You can always change these settings in your profile
                            </p>

                            {error && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setStep('preferences')} className="flex-1">
                                    Back
                                </Button>
                                <Button onClick={handleComplete} disabled={isLoading} className="flex-1">
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
                                            ? 'bg-primary w-2'
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
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Checkbox } from '@/components/ui/Checkbox';
import { Separator } from '@/components/ui/Separator';
import { Slider } from '@/components/ui/Slider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/Dialog';
import {
    Loader2,
    Save,
    User,
    Bell,
    Sparkles,
    Check,
    AlertCircle,
    Trash2,
    Lock,
    Filter,
    DollarSign,
    Zap,
    Search,
    Target,
    TrendingUp,
    Mail,
} from 'lucide-react';
import { BackButton } from '@/components/navigation/BackButton';
import { CATEGORIES } from '@/lib/constants/categories';
import { PopularitySelector } from '@/components/preferences/PopularitySelector';

// Types for better code clarity
interface UserPreferences {
    selectedCategories: string[];
    selectedSubcategories: string[];
    popularityPreference: number;
    priceRange: { min: number; max: number };
    notifications: NotificationSettings;
}

interface NotificationSettings {
    inApp: boolean;
    email: boolean;
    emailFrequency: 'weekly' | 'monthly';
    keywords: string[];
    smartFiltering: {
        enabled: boolean;
        minRecommendationScore: number;
    };
}

interface OriginalValues {
    name: string;
    username: string;
    selectedCategories: Set<string>;
    selectedSubcategories: Set<string>;
    popularityPref: number;
    inAppNotifications: boolean;
    emailNotifications: boolean;
    emailFrequency: 'weekly' | 'monthly';
    notificationKeywords: string;
    useSmartFiltering: boolean;
    minRecommendationScore: number;
    priceMin: number;
    priceMax: number;
}

const POPULARITY_OPTIONS = [
    { value: 0, label: 'Niche', icon: Search, description: 'Hidden gems and unique events' },
    { value: 0.5, label: 'Balanced', icon: Target, description: 'Mix of popular and niche' },
    { value: 1, label: 'Mainstream', icon: TrendingUp, description: 'Popular and trending events' },
] as const;

export default function SettingsPage() {
    const router = useRouter();
    const { data: session, status, update } = useSession();

    // Account Information
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');

    // Password Management
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Event Preferences
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedSubcategories, setSelectedSubcategories] = useState<Set<string>>(new Set());
    const [popularityPref, setPopularityPref] = useState(0.5);

    // Notification Preferences
    const [inAppNotifications, setInAppNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(false);
    const [emailFrequency, setEmailFrequency] = useState<'weekly' | 'monthly'>('weekly');
    const [notificationKeywords, setNotificationKeywords] = useState<string>('');
    const [useSmartFiltering, setUseSmartFiltering] = useState(true);
    const [minRecommendationScore, setMinRecommendationScore] = useState(0.6);
    const [popularityFilter, setPopularityFilter] = useState<'all' | 'mainstream' | 'niche' | 'personalized'>('personalized');
    const [priceMin, setPriceMin] = useState(0);
    const [priceMax, setPriceMax] = useState(500);

    // State Management
    const [originalValues, setOriginalValues] = useState<OriginalValues | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Dialog States
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

    // Load user settings on mount
    useEffect(() => {
        loadSettings();
    }, [session, status]);

    // Track unsaved changes
    useEffect(() => {
        if (!originalValues) return;
        setHasUnsavedChanges(checkForChanges());
    }, [
        name, username, selectedCategories, selectedSubcategories, popularityPref,
        inAppNotifications, emailNotifications, emailFrequency, notificationKeywords,
        useSmartFiltering, minRecommendationScore, popularityFilter, priceMin, priceMax,
        currentPassword, newPassword, originalValues
    ]);

    // Warn before leaving with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    async function loadSettings() {
        if (status === 'loading') return;

        try {
            const [prefsRes, userRes] = await Promise.all([
                fetch('/api/user/preferences'),
                fetch('/api/user/account'),
            ]);

            const prefsData = await prefsRes.json();
            const userData = await userRes.json();

            // Set account information
            setName(userData.name || '');
            setUsername(userData.username || '');
            setEmail(userData.email || '');

            // Set event preferences
            const prefs = prefsData.preferences;
            setSelectedCategories(new Set(prefs.selectedCategories));
            setSelectedSubcategories(new Set(prefs.selectedSubcategories));
            setPopularityPref(prefs.popularityPreference);

            // Set notification preferences
            const notifs = prefs.notifications || {};
            setInAppNotifications(notifs.inApp ?? true);
            setEmailNotifications(notifs.email ?? false);
            setEmailFrequency(notifs.emailFrequency || 'weekly');
            setNotificationKeywords((notifs.keywords || []).join(', '));
            setUseSmartFiltering(notifs.smartFiltering?.enabled ?? true);
            setMinRecommendationScore(notifs.smartFiltering?.minRecommendationScore ?? 0.6);
            setPopularityFilter(notifs.popularityFilter || 'personalized');
            setPriceMin(prefs.priceRange?.min ?? 0);
            setPriceMax(prefs.priceRange?.max ?? 500);

            // Store original values for change detection
            setOriginalValues({
                name: userData.name || '',
                username: userData.username || '',
                selectedCategories: new Set(prefs.selectedCategories),
                selectedSubcategories: new Set(prefs.selectedSubcategories),
                popularityPref: prefs.popularityPreference,
                inAppNotifications: notifs.inApp ?? true,
                emailNotifications: notifs.email ?? false,
                emailFrequency: notifs.emailFrequency || 'weekly',
                notificationKeywords: (notifs.keywords || []).join(', '),
                useSmartFiltering: notifs.smartFiltering?.enabled ?? true,
                minRecommendationScore: notifs.smartFiltering?.minRecommendationScore ?? 0.6,
                priceMin: prefs.priceRange?.min ?? 0,
                priceMax: prefs.priceRange?.max ?? 500,
            });
        } catch (error) {
            setError('Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    }

    function checkForChanges(): boolean {
        if (!originalValues) return false;

        return (
            name !== originalValues.name ||
            username !== originalValues.username ||
            !areSetsEqual(selectedCategories, originalValues.selectedCategories) ||
            !areSetsEqual(selectedSubcategories, originalValues.selectedSubcategories) ||
            popularityPref !== originalValues.popularityPref ||
            inAppNotifications !== originalValues.inAppNotifications ||
            emailNotifications !== originalValues.emailNotifications ||
            emailFrequency !== originalValues.emailFrequency ||
            notificationKeywords !== originalValues.notificationKeywords ||
            useSmartFiltering !== originalValues.useSmartFiltering ||
            minRecommendationScore !== originalValues.minRecommendationScore ||
            priceMin !== originalValues.priceMin ||
            priceMax !== originalValues.priceMax ||
            currentPassword !== '' ||
            newPassword !== ''
        );
    }

    function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
        return a.size === b.size && [...a].every((val) => b.has(val));
    }

    function toggleCategory(categoryValue: string) {
        const newSet = new Set(selectedCategories);

        if (newSet.has(categoryValue)) {
            newSet.delete(categoryValue);
            // Remove associated subcategories
            const category = CATEGORIES.find((c) => c.value === categoryValue);
            if (category?.subcategories) {
                const newSubs = new Set(selectedSubcategories);
                category.subcategories.forEach((sub) => newSubs.delete(sub));
                setSelectedSubcategories(newSubs);
            }
        } else {
            newSet.add(categoryValue);
        }

        setSelectedCategories(newSet);
    }

    function toggleSubcategory(subcategoryValue: string) {
        const newSet = new Set(selectedSubcategories);
        newSet.has(subcategoryValue)
            ? newSet.delete(subcategoryValue)
            : newSet.add(subcategoryValue);
        setSelectedSubcategories(newSet);
    }

    async function handleSave() {
        setError('');
        setSuccess(false);
        setIsSaving(true);

        try {
            // Validate password change if provided
            if (newPassword) {
                if (!currentPassword) {
                    throw new Error('Current password is required to set a new password');
                }
                if (newPassword.length < 8) {
                    throw new Error('New password must be at least 8 characters');
                }
                if (newPassword !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
            }

            // Update account information
            const accountRes = await fetch('/api/user/account', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    username: username || undefined,
                    currentPassword: currentPassword || undefined,
                    newPassword: newPassword || undefined,
                }),
            });

            if (!accountRes.ok) {
                const data = await accountRes.json();
                throw new Error(data.error || 'Failed to update account');
            }

            // Parse notification keywords
            const keywords = notificationKeywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);

            // Update preferences
            const prefsRes = await fetch('/api/user/preferences', {
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
                        emailFrequency,
                        keywords,
                        smartFiltering: {
                            enabled: useSmartFiltering,
                            minRecommendationScore,
                        },
                        popularityFilter,
                    },
                }),
            });

            if (!prefsRes.ok) throw new Error('Failed to save preferences');

            await update();

            // Clear password fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            // Update original values
            setOriginalValues({
                name,
                username,
                selectedCategories: new Set(selectedCategories),
                selectedSubcategories: new Set(selectedSubcategories),
                popularityPref,
                inAppNotifications,
                emailNotifications,
                emailFrequency,
                notificationKeywords,
                useSmartFiltering,
                minRecommendationScore,
                priceMin,
                priceMax,
            });

            setSuccess(true);

            // Redirect to profile after short delay
            setTimeout(() => {
                router.push('/profile');
            }, 1500);

        } catch (error: any) {
            setError(error.message || 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    }

    async function handleDelete() {
        if (deleteConfirmText !== 'DELETE') {
            setError('Please type DELETE to confirm');
            return;
        }

        setIsDeleting(true);
        try {
            const res = await fetch('/api/user/account', {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete account');

            window.location.href = '/';
        } catch (error: any) {
            setError(error.message || 'Failed to delete account');
            setIsDeleting(false);
        }
    }

    function handleNavigation(href: string) {
        if (hasUnsavedChanges) {
            setPendingNavigation(href);
            setShowUnsavedDialog(true);
        } else {
            router.push(href);
        }
    }

    function confirmNavigation() {
        if (pendingNavigation) {
            router.push(pendingNavigation);
        }
    }

    if (status === 'loading' || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

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
                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Account Settings</h1>
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
                    {/* Status Messages */}
                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <span className="text-sm">{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400">
                            <Check className="h-5 w-5 shrink-0 mt-0.5" />
                            <span className="text-sm">Settings saved successfully! Redirecting...</span>
                        </div>
                    )}

                    {/* Account Information Card */}
                    <Card className="border-2 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Account Information
                            </CardTitle>
                            <CardDescription>Update your personal details</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Display Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Your name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Optional username"
                                />
                                <p className="text-xs text-muted-foreground">Optional field for personalization</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Email Address</Label>
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{email}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">Cannot be changed</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Password Change Card */}
                    <Card className="border-2 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Lock className="h-5 w-5" />
                                Change Password
                            </CardTitle>
                            <CardDescription>Update your account password</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Minimum 8 characters"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Re-enter new password"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Event Preferences Card */}
                    <Card className="border-2 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Sparkles className="h-5 w-5" />
                                Event Preferences
                            </CardTitle>
                            <CardDescription>Customize your event recommendations</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Categories */}
                            <div className="space-y-3">
                                <Label className="text-base font-medium">Categories</Label>
                                <div className="flex flex-wrap gap-2">
                                    {CATEGORIES.map((category) => (
                                        <button
                                            key={category.value}
                                            onClick={() => toggleCategory(category.value)}
                                            className={`
                            px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${selectedCategories.has(category.value)
                                                    ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20'
                                                    : 'bg-muted hover:bg-muted/80'
                                                }
                        `}
                                        >
                                            {selectedCategories.has(category.value) && (
                                                <Check className="inline w-4 h-4 mr-1.5 -ml-0.5" />
                                            )}
                                            {category.label}
                                        </button>
                                    ))}
                                </div>
                            </div>


                            {/* Subcategories */}
                            {selectedCategories.size > 0 && (
                                <div className="space-y-4">
                                    <Label className="text-base font-medium">Subcategories</Label>
                                    {CATEGORIES.filter((cat) => selectedCategories.has(cat.value)).map(
                                        (category) => (
                                            <div key={category.value} className="space-y-2">
                                                <p className="text-sm font-medium text-muted-foreground">{category.label}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {category.subcategories?.map((sub) => (
                                                        <button
                                                            key={sub}
                                                            onClick={() => toggleSubcategory(sub)}
                                                            className={`
                                px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                ${selectedSubcategories.has(sub)
                                                                    ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
                                                                    : 'bg-background hover:bg-muted border border-border'
                                                                }
                              `}
                                                        >
                                                            {sub}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}

                            <Separator />

                            {/* Popularity Preference */}
                            <div className="space-y-4">
                                <div>
                                    <Label className="text-base font-medium">Event Type Preference</Label>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Choose the type of events you prefer to discover
                                    </p>
                                </div>

                                <PopularitySelector
                                    value={popularityPref}
                                    onChange={setPopularityPref}
                                    variant="cards"
                                />
                            </div>

                            <Separator />

                            {/* Price Range */}
                            <div className="space-y-3">
                                <Label className="flex items-center gap-2">
                                    <DollarSign className="h-4 w-4" />
                                    Price Range
                                </Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="priceMin" className="text-xs">Minimum</Label>
                                        <Input
                                            id="priceMin"
                                            type="number"
                                            value={priceMin}
                                            onChange={(e) => setPriceMin(Number(e.target.value))}
                                            min={0}
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="priceMax" className="text-xs">Maximum</Label>
                                        <Input
                                            id="priceMax"
                                            type="number"
                                            value={priceMax}
                                            onChange={(e) => setPriceMax(Number(e.target.value))}
                                            min={0}
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Free events always included
                                </p>
                            </div>
                        </CardContent>
                    </Card>


                    <Card className="border-2 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Bell className="h-5 w-5" />
                                Notification Preferences
                            </CardTitle>
                            <CardDescription>
                                Control how you receive updates about new events
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* In-App Notifications */}
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 flex-1">
                                    <Label htmlFor="inApp" className="text-base cursor-pointer">In-App Notifications</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Show notification alerts within the app
                                    </p>
                                </div>
                                <Checkbox
                                    id="inApp"
                                    checked={inAppNotifications}
                                    onCheckedChange={(checked) => setInAppNotifications(checked === true)}
                                    className="mt-1"
                                />
                            </div>

                            <Separator />


                            {/* Email Notifications */}
                            <div className="space-y-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1 flex-1">
                                        <Label htmlFor="email" className="text-base cursor-pointer">Email Notifications</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Receive email digests about new events
                                        </p>
                                    </div>
                                    <Checkbox
                                        id="email"
                                        checked={emailNotifications}
                                        onCheckedChange={(checked) => setEmailNotifications(checked === true)}
                                        className="mt-1"
                                    />
                                </div>

                                {emailNotifications && (
                                    <div className="ml-6 p-4 bg-muted/50 border border-border rounded-lg space-y-3">
                                        <Label className="text-sm font-medium">Email Frequency</Label>
                                        <div className="space-y-2">
                                            {(['weekly', 'monthly'] as const).map((freq) => (
                                                <div key={freq} className="flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        id={`freq-${freq}`}
                                                        checked={emailFrequency === freq}
                                                        onChange={() => setEmailFrequency(freq)}
                                                        className="w-4 h-4 text-primary"
                                                    />
                                                    <Label htmlFor={`freq-${freq}`} className="cursor-pointer text-sm">
                                                        {freq === 'weekly' ? 'Weekly digest (Sundays at 6 PM)' : 'Monthly digest (First Sunday)'}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Emails include keyword matches, favourite updates, and personalised recommendations
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Keywords */}
                            <div className="space-y-3">
                                <Label htmlFor="keywords" className="flex items-center gap-2">
                                    <Filter className="h-4 w-4" />
                                    Keywords (Optional)
                                </Label>
                                <Input
                                    id="keywords"
                                    value={notificationKeywords}
                                    onChange={(e) => setNotificationKeywords(e.target.value)}
                                    placeholder="e.g., taylor swift, hamilton, comedy"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Get priority alerts for these keywords (comma-separated)
                                </p>
                            </div>

                            <Separator />

                            {/* Smart Filtering */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="smartFilter" className="flex items-center gap-2">
                                            <Zap className="h-4 w-4" />
                                            Smart Filtering
                                        </Label>
                                        <p className="text-sm text-muted-foreground">
                                            Only notify about events matching your preferences
                                        </p>
                                    </div>
                                    <Checkbox
                                        id="smartFilter"
                                        checked={useSmartFiltering}
                                        onCheckedChange={(checked) => setUseSmartFiltering(checked === true)}
                                    />
                                </div>

                                {useSmartFiltering && (
                                    <div className="ml-6 p-4 bg-muted rounded-lg space-y-4">
                                        <div>
                                            <Label className="text-sm mb-2 block">
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
                                                Higher = fewer, more relevant notifications
                                            </p>
                                        </div>
                                        <p className="text-xs text-muted-foreground flex items-start gap-2 p-3 bg-background/50 rounded border">
                                            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                            Notifications will respect your Event Type Preference above
                                        </p>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Price Range - same as Event Preferences */}
                        </CardContent>
                    </Card>

                    {/* Actions */}
                    <div className="flex gap-4">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => handleNavigation('/profile')}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving} size="lg" className="flex-1">
                            {isSaving ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-5 w-5" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Delete Account */}
                    <Card className="border-2 border-destructive/20">
                        <CardHeader>
                            <CardTitle className="text-xl text-destructive flex items-center gap-2">
                                <Trash2 className="h-5 w-5" />
                                Danger Zone
                            </CardTitle>
                            <CardDescription>Permanently delete your account and all data</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="destructive"
                                onClick={() => setShowDeleteDialog(true)}
                                disabled={isDeleting}
                            >
                                Delete Account
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Unsaved Changes Dialog */}
            <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unsaved Changes</DialogTitle>
                        <DialogDescription>
                            You have unsaved changes. Do you want to save them before leaving?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={confirmNavigation}>
                            Leave Without Saving
                        </Button>
                        <Button
                            onClick={async () => {
                                await handleSave();
                                setShowUnsavedDialog(false);
                                if (pendingNavigation) router.push(pendingNavigation);
                            }}
                        >
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Account Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete Account</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. All your data, favourites, and preferences will be
                            permanently deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Label>Type DELETE to confirm</Label>
                        <Input
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="DELETE"
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Forever'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
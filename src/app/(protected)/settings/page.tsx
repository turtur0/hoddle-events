'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { PageLayout } from '@/components/layout/PageLayout';
import { Loader2, Save, User, Bell, Sparkles, Check, AlertCircle, Trash2, Lock, Mail, Target, DollarSign } from 'lucide-react';
import { PopularitySelector } from '@/components/preferences/PopularitySelector';
import { CategorySelector } from '@/components/preferences/CategorySelector';
import { NotificationSettings } from '@/components/preferences/NotificationSettings';
import { PriceRangeSelector } from '@/components/preferences/PriceRangeSelector';
import { CATEGORIES } from '@/lib/constants/categories';
import type { DigestRecommendationsSize } from '@/lib/constants/preferences';

type EmailFrequency = 'weekly' | 'monthly';

export default function SettingsPage() {
    const router = useRouter();
    const { data: session, status, update } = useSession();

    // Account state
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Preferences state
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [selectedSubcategories, setSelectedSubcategories] = useState<Set<string>>(new Set());
    const [popularityPref, setPopularityPref] = useState(0.5);
    const [priceMin, setPriceMin] = useState(0);
    const [priceMax, setPriceMax] = useState(500);

    // Notification state
    const [inAppNotifications, setInAppNotifications] = useState(true);
    const [emailNotifications, setEmailNotifications] = useState(false);
    const [emailFrequency, setEmailFrequency] = useState<EmailFrequency>('weekly');
    const [notificationKeywords, setNotificationKeywords] = useState('');
    const [useSmartFiltering, setUseSmartFiltering] = useState(true);
    const [minRecommendationScore, setMinRecommendationScore] = useState(0.6);
    const [includeFavouriteUpdates, setIncludeFavouriteUpdates] = useState(true);
    const [recommendationsSize, setRecommendationsSize] = useState<DigestRecommendationsSize>('moderate');
    const [customRecommendationsCount, setCustomRecommendationsCount] = useState(5);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Load settings on mount
    useEffect(() => {
        const loadSettings = async () => {
            if (status === 'loading') return;

            try {
                const [prefsRes, userRes] = await Promise.all([
                    fetch('/api/user/preferences'),
                    fetch('/api/user/account'),
                ]);

                const [prefsData, userData] = await Promise.all([
                    prefsRes.json(),
                    userRes.json()
                ]);

                // Set account data
                setName(userData.name || '');
                setUsername(userData.username || '');
                setEmail(userData.email || '');

                // Set preferences
                const prefs = prefsData.preferences;
                setSelectedCategories(new Set(prefs.selectedCategories || []));
                setSelectedSubcategories(new Set(prefs.selectedSubcategories || []));
                setPopularityPref(prefs.popularityPreference ?? 0.5);
                setPriceMin(prefs.priceRange?.min ?? 0);
                setPriceMax(prefs.priceRange?.max ?? 500);

                // Set notifications
                const notifs = prefs.notifications || {};
                setInAppNotifications(notifs.inApp ?? true);
                setEmailNotifications(notifs.email ?? false);
                setEmailFrequency(notifs.emailFrequency || 'weekly');
                setNotificationKeywords((notifs.keywords || []).join(', '));
                setUseSmartFiltering(notifs.smartFiltering?.enabled ?? true);
                setMinRecommendationScore(notifs.smartFiltering?.minRecommendationScore ?? 0.6);
                setIncludeFavouriteUpdates(notifs.includeFavouriteUpdates ?? true);
                setRecommendationsSize(notifs.recommendationsSize || 'moderate');
                setCustomRecommendationsCount(notifs.customRecommendationsCount || 5);
            } catch (err) {
                setError('Failed to load settings');
            } finally {
                setIsLoading(false);
            }
        };

        loadSettings();
    }, [status]);

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
    };

    const toggleSubcategory = (subcategoryValue: string) => {
        const newSubs = new Set(selectedSubcategories);
        newSubs.has(subcategoryValue) ? newSubs.delete(subcategoryValue) : newSubs.add(subcategoryValue);
        setSelectedSubcategories(newSubs);
    };

    const handleSave = async () => {
        setError('');
        setSuccess(false);
        setIsSaving(true);

        try {
            if (newPassword) {
                if (!currentPassword) throw new Error('Current password required');
                if (newPassword.length < 8) throw new Error('New password must be at least 8 characters');
                if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
            }

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

            const keywords = notificationKeywords
                .split(',')
                .map(k => k.trim())
                .filter(k => k.length > 0);

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
                        includeFavouriteUpdates,
                        recommendationsSize,
                        customRecommendationsCount,
                    },
                }),
            });

            if (!prefsRes.ok) throw new Error('Failed to save preferences');

            await update();

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            setSuccess(true);
            setTimeout(() => router.push('/profile'), 1500);
        } catch (err: any) {
            setError(err.message || 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (deleteConfirmText !== 'DELETE') {
            setError('Please type DELETE to confirm');
            return;
        }

        setIsDeleting(true);
        try {
            const res = await fetch('/api/user/account', { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete account');
            window.location.href = '/';
        } catch (err: any) {
            setError(err.message || 'Failed to delete account');
            setIsDeleting(false);
        }
    };

    if (status === 'loading' || isLoading) {
        return (
            <div className="min-h-screen flex items-centre justify-centre">
                <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading settings" />
            </div>
        );
    }

    return (
        <PageLayout
            icon={User}
            iconColor="text-primary"
            iconBgColor="bg-primary/10 ring-1 ring-primary/20"
            title="Account Settings"
            description="Manage your account and preferences"
            maxWidth="4xl"
        >
            <div className="space-y-6">
                {error && (
                    <div className="flex items-start gap-3 p-4 bg-destructive/10 border-2 border-destructive/20 rounded-lg text-destructive" role="alert">
                        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {success && (
                    <div className="flex items-start gap-3 p-4 bg-green-500/10 border-2 border-green-500/20 rounded-lg text-green-600 dark:text-green-400" role="status">
                        <Check className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="text-sm">Settings saved successfully! Redirecting...</span>
                    </div>
                )}

                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-centre gap-2">
                            <User className="h-5 w-5 text-primary" aria-hidden="true" />
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
                                className="border-2"
                                aria-required="true"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="border-2"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Email Address</Label>
                            <div className="flex items-centre gap-2 px-3 py-2 bg-muted rounded-md border-2">
                                <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                <span className="text-sm">{email}</span>
                                <span className="ml-auto text-xs text-muted-foreground">Cannot be changed</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-centre gap-2">
                            <Lock className="h-5 w-5 text-primary" aria-hidden="true" />
                            Change Password
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            type="password"
                            placeholder="Current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="border-2"
                            autoComplete="current-password"
                        />
                        <Input
                            type="password"
                            placeholder="New password (min. 8 characters)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="border-2"
                            autoComplete="new-password"
                        />
                        <Input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="border-2"
                            autoComplete="new-password"
                        />
                    </CardContent>
                </Card>

                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-centre gap-2">
                            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" />
                            Event Preferences
                        </CardTitle>
                        <CardDescription>Customise your event discovery experience</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="space-y-4">
                            <div className="flex items-centre gap-2">
                                <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Categories & Interests
                                </h3>
                            </div>
                            <CategorySelector
                                selectedCategories={selectedCategories}
                                selectedSubcategories={selectedSubcategories}
                                onCategoryToggle={toggleCategory}
                                onSubcategoryToggle={toggleSubcategory}
                                variant="compact"
                            />
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-centre gap-2">
                                <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Event Type Preference
                                </h3>
                            </div>
                            <PopularitySelector
                                value={popularityPref}
                                onChange={setPopularityPref}
                                variant="cards"
                            />
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-centre gap-2">
                                <DollarSign className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                                    Price Range
                                </h3>
                            </div>
                            <PriceRangeSelector
                                priceMin={priceMin}
                                priceMax={priceMax}
                                onMinChange={setPriceMin}
                                onMaxChange={setPriceMax}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="card-interactive">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-centre gap-2">
                            <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
                            Notification Preferences
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
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
                            variant="settings"
                        />
                    </CardContent>
                </Card>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => router.push('/profile')}
                        className="flex-1 border-2 hover-lift"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        size="lg"
                        className="flex-1 hover-lift group"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-5 w-5" aria-hidden="true" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>

                <Card className="border-2 border-destructive/20">
                    <CardHeader>
                        <CardTitle className="text-xl text-destructive flex items-centre gap-2">
                            <Trash2 className="h-5 w-5" aria-hidden="true" />
                            Danger Zone
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="destructive"
                            onClick={() => setShowDeleteDialog(true)}
                            className="hover-lift"
                        >
                            Delete Account
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete Account</DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. Type DELETE to confirm.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="border-2"
                        aria-label="Confirmation text"
                    />
                    <DialogFooter className="gap-2 flex-col sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            className="border-2 w-full sm:w-auto"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                            className="w-full sm:w-auto"
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
        </PageLayout>
    );
}
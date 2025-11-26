// components/preferences/notification-settings.tsx
'use client';

import { Bell, Mail, Filter, Zap, Sparkles } from 'lucide-react';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Slider } from '@/components/ui/Slider';
import { Separator } from '@/components/ui/Separator';

interface NotificationSettingsProps {
    inAppNotifications: boolean;
    emailNotifications: boolean;
    emailFrequency: 'weekly' | 'monthly';
    keywords: string;
    useSmartFiltering: boolean;
    minRecommendationScore: number;
    onInAppChange: (enabled: boolean) => void;
    onEmailChange: (enabled: boolean) => void;
    onFrequencyChange: (frequency: 'weekly' | 'monthly' | 'weekly') => void;
    onKeywordsChange: (keywords: string) => void;
    onSmartFilteringChange: (enabled: boolean) => void;
    onScoreChange: (score: number) => void;
    variant?: 'onboarding' | 'settings';
}

export function NotificationSettings({
    inAppNotifications,
    emailNotifications,
    emailFrequency,
    keywords,
    useSmartFiltering,
    minRecommendationScore,
    onInAppChange,
    onEmailChange,
    onFrequencyChange,
    onKeywordsChange,
    onSmartFilteringChange,
    onScoreChange,
    variant = 'settings',
}: NotificationSettingsProps) {
    const isOnboarding = variant === 'onboarding';
    const frequencyOptions: Array<'weekly' | 'monthly' | 'weekly'> =
        isOnboarding ? ['weekly', 'monthly'] : ['weekly', 'monthly'];

    const getFrequencyLabel = (freq: 'weekly' | 'monthly') => {
        if (freq === 'weekly') return 'Weekly digest (Every Sunday at 6 PM)';
        if (freq === 'monthly') return 'Monthly digest (First Sunday of month)';
    };

    return (
        <div className="space-y-6">
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
                    onCheckedChange={(checked) => onInAppChange(checked === true)}
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
                        onCheckedChange={(checked) => onEmailChange(checked === true)}
                        className="mt-1"
                    />
                </div>

                {emailNotifications && (
                    <div className="ml-4 p-4 bg-background border rounded-lg space-y-3">
                        <Label className="text-sm font-medium">Email Frequency</Label>
                        <div className="space-y-2">
                            {frequencyOptions.map((freq) => (
                                <div key={freq} className="flex items-center gap-3">
                                    <input
                                        type="radio"
                                        id={freq}
                                        checked={emailFrequency === freq}
                                        onChange={() => onFrequencyChange(freq)}
                                        className="w-4 h-4 cursor-pointer"
                                    />
                                    <Label htmlFor={freq} className="cursor-pointer text-sm flex items-center gap-2">
                                        <Mail className="h-3.5 w-3.5" />
                                        {getFrequencyLabel(freq)}
                                    </Label>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Curated events matching your preferences, keyword alerts, and favourite updates
                        </p>
                    </div>
                )}
            </div>

            {variant === 'settings' && <Separator />}

            {/* Keywords */}
            <div className="space-y-3">
                <Label htmlFor="keywords" className="flex items-center gap-2 text-base font-medium">
                    <Filter className="h-4 w-4" />
                    Keywords (Optional)
                </Label>
                <Input
                    id="keywords"
                    value={keywords}
                    onChange={(e) => onKeywordsChange(e.target.value)}
                    placeholder="e.g., taylor swift, hamilton, comedy"
                    className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                    Get priority notifications for these keywords (comma-separated)
                </p>
            </div>

            {variant === 'settings' && <Separator />}

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
                        onCheckedChange={(checked) => onSmartFilteringChange(checked === true)}
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
                                onValueChange={([value]) => onScoreChange(value)}
                                min={0.3}
                                max={0.9}
                                step={0.1}
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                Higher scores mean fewer but more relevant notifications
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-start gap-2 p-3 bg-background/50 rounded border">
                            <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            Notifications will respect your Event Type Preference
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
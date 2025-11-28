'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { BackButton } from '@/components/navigation/BackButton';
import {
    Bell,
    Search,
    Sparkles,
    Heart,
    Loader2,
    Check,
    CheckCheck,
} from 'lucide-react';

interface Notification {
    _id: string;
    eventId: {
        _id: string;
        title: string;
    };
    type: 'keyword_match' | 'recommendation' | 'favorite_update';
    title: string;
    message: string;
    createdAt: string;
    read: boolean;
    relevanceScore?: number;
}

const NOTIFICATION_CONFIG = {
    keyword_match: {
        icon: Search,
        color: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/20',
        label: 'Keyword Match',
    },
    recommendation: {
        icon: Sparkles,
        color: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/20',
        label: 'Recommended',
    },
    favorite_update: {
        icon: Heart,
        color: 'text-pink-600 dark:text-pink-400',
        bgColor: 'bg-pink-500/10',
        borderColor: 'border-pink-500/20',
        label: 'Favorite Update',
    },
};

function formatTimeAgo(date: string): string {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return `${Math.floor(diffInSeconds / 604800)}w ago`;
}

export default function NotificationsPage() {
    const { status } = useSession();
    const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') {
            window.location.href = '/auth/signin?callbackUrl=/notifications';
        } else if (status === 'authenticated') {
            fetchNotifications();
        }
    }, [status]);

    async function fetchNotifications() {
        try {
            const response = await fetch('/api/notifications/all');
            if (response.ok) {
                const data = await response.json();
                setAllNotifications(data.notifications);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setIsLoading(false);
        }
    }

    async function markAsRead(notificationId: string) {
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationIds: [notificationId] }),
            });

            setAllNotifications(prev =>
                prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }

    async function markAllAsRead() {
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAll: true }),
            });

            setAllNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }

    if (status === 'loading' || isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const unreadNotifications = allNotifications.filter(n => !n.read);
    const readNotifications = allNotifications.filter(n => n.read);

    return (
        <div className="w-full min-h-screen bg-linear-to-b from-background to-muted/20">
            {/* Header */}
            <section className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
                <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
                    <BackButton fallbackUrl="/" className="mb-8" />

                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <div className="rounded-2xl bg-primary/10 p-3 ring-1 ring-primary/20">
                                <Bell className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                                    Notifications
                                </h1>
                                <p className="text-muted-foreground mt-1">
                                    Stay updated on events you care about
                                </p>
                            </div>
                        </div>

                        {unreadNotifications.length > 0 && (
                            <Button
                                onClick={markAllAsRead}
                                variant="outline"
                                className="gap-2 border-2 hover:border-primary/40 hover:bg-primary/5 transition-all"
                            >
                                <CheckCheck className="h-4 w-4" />
                                Mark all read
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            {/* Content */}
            <section className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
                <Tabs defaultValue="unread" className="space-y-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="unread" className="gap-2">
                            Unread
                            {unreadNotifications.length > 0 && (
                                <Badge variant="secondary" className="ml-1 bg-primary/10 text-primary border border-primary/20">
                                    {unreadNotifications.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="all">All</TabsTrigger>
                    </TabsList>

                    <TabsContent value="unread" className="space-y-3">
                        {unreadNotifications.length === 0 ? (
                            <Card className="p-12 text-center border-2 border-border/50">
                                <div className="rounded-full bg-muted/50 p-6 w-fit mx-auto mb-4">
                                    <Bell className="h-12 w-12 text-muted-foreground/40" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                                <p className="text-sm text-muted-foreground">
                                    No new notifications at the moment
                                </p>
                            </Card>
                        ) : (
                            unreadNotifications.map((notification) => (
                                <NotificationCard
                                    key={notification._id}
                                    notification={notification}
                                    onMarkAsRead={markAsRead}
                                />
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="all" className="space-y-3">
                        {allNotifications.length === 0 ? (
                            <Card className="p-12 text-center border-2 border-border/50">
                                <div className="rounded-full bg-muted/50 p-6 w-fit mx-auto mb-4">
                                    <Bell className="h-12 w-12 text-muted-foreground/40" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">No notifications yet</h3>
                                <p className="text-sm text-muted-foreground">
                                    We'll notify you when we find events you might like
                                </p>
                            </Card>
                        ) : (
                            allNotifications.map((notification) => (
                                <NotificationCard
                                    key={notification._id}
                                    notification={notification}
                                    onMarkAsRead={markAsRead}
                                />
                            ))
                        )}
                    </TabsContent>
                </Tabs>
            </section>
        </div>
    );
}

function NotificationCard({
    notification,
    onMarkAsRead,
}: {
    notification: Notification;
    onMarkAsRead: (id: string) => void;
}) {
    const config = NOTIFICATION_CONFIG[notification.type];
    const Icon = config.icon;

    return (
        <Card
            className={`p-4 border-2 transition-all hover:shadow-md ${!notification.read
                    ? 'bg-primary/5 border-primary/30 hover:border-primary/40'
                    : 'border-border/50 hover:border-border'
                }`}
        >
            <div className="flex gap-4">
                <div className={`rounded-lg border ${config.borderColor} p-3 ${config.bgColor} shrink-0 h-fit`}>
                    <Icon className={`h-5 w-5 ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs font-semibold uppercase tracking-wide ${config.color}`}>
                            {config.label}
                        </span>
                        {notification.relevanceScore && notification.relevanceScore >= 0.8 && (
                            <Badge
                                variant="secondary"
                                className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                            >
                                {Math.round(notification.relevanceScore * 100)}% match
                            </Badge>
                        )}
                        {!notification.read && (
                            <Badge variant="default" className="text-xs">
                                New
                            </Badge>
                        )}
                    </div>

                    <h3 className="font-semibold text-base mb-1">{notification.title}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{notification.message}</p>

                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                            {formatTimeAgo(notification.createdAt)}
                        </span>
                        <Link href={`/events/${notification.eventId._id}`}>
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-2 hover:border-primary/40 hover:bg-primary/5 transition-all"
                            >
                                View Event
                            </Button>
                        </Link>
                        {!notification.read && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onMarkAsRead(notification._id)}
                                className="gap-2 hover:bg-accent transition-all"
                            >
                                <Check className="h-3 w-3" />
                                Mark read
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
}
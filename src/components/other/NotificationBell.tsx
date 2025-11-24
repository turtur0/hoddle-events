'use client';

import { useState, useEffect } from 'react';
import { Bell, Search, Sparkles, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

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
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        label: 'Keyword Match',
    },
    recommendation: {
        icon: Sparkles,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        label: 'Recommended',
    },
    favorite_update: {
        icon: Heart,
        color: 'text-pink-500',
        bgColor: 'bg-pink-500/10',
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

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    async function fetchNotifications() {
        try {
            const response = await fetch('/api/notifications/unread');
            if (response.ok) {
                const data = await response.json();
                setNotifications(data.notifications);
                setUnreadCount(data.count);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    async function markAsRead(notificationId: string) {
        try {
            await fetch('/api/notifications/mark-read', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationIds: [notificationId] }),
            });

            setNotifications(prev => prev.filter(n => n._id !== notificationId));
            setUnreadCount(prev => Math.max(0, prev - 1));
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

            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                            variant="destructive"
                        >
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-96">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold text-base">Notifications</h3>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={markAllAsRead}
                            className="text-xs h-7"
                        >
                            Mark all read
                        </Button>
                    )}
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground font-medium">
                                No new notifications
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                We'll notify you when something interesting happens
                            </p>
                        </div>
                    ) : (
                        notifications.slice(0, 5).map((notification) => {
                            const config = NOTIFICATION_CONFIG[notification.type];
                            const Icon = config.icon;

                            return (
                                <Link
                                    key={notification._id}
                                    href={`/events/${notification.eventId._id}`}
                                    onClick={() => {
                                        markAsRead(notification._id);
                                        setIsOpen(false);
                                    }}
                                >
                                    <DropdownMenuItem className="flex gap-3 p-4 cursor-pointer hover:bg-muted/50 focus:bg-muted/50">
                                        <div className={`rounded-lg p-2 ${config.bgColor} shrink-0`}>
                                            <Icon className={`h-4 w-4 ${config.color}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-xs font-medium ${config.color}`}>
                                                    {config.label}
                                                </span>
                                                {notification.relevanceScore && notification.relevanceScore >= 0.8 && (
                                                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                                                        {Math.round(notification.relevanceScore * 100)}%
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="font-medium text-sm leading-tight mb-1">
                                                {notification.title}
                                            </div>
                                            <div className="text-sm text-muted-foreground leading-tight line-clamp-2">
                                                {notification.message}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-2">
                                                {formatTimeAgo(notification.createdAt)}
                                            </div>
                                        </div>
                                    </DropdownMenuItem>
                                </Link>
                            );
                        })
                    )}
                </div>

                {notifications.length > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <div className="p-2">
                            <Link href="/notifications" onClick={() => setIsOpen(false)}>
                                <Button 
                                    variant="ghost" 
                                    className="w-full justify-between h-9"
                                >
                                    <span className="text-sm font-medium">View all notifications</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
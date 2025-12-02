// src/components/layout/Header.tsx
'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, ChevronDown, Music, Theater, Trophy, Palette, Users, Sparkles, Menu, LogOut, Settings, User, Heart, BarChart3, Archive } from "lucide-react";
import { ThemeToggle } from '../other/ThemeToggle';
import { NotificationBell } from "../notifications/NotificationBell";
import { AuthModal } from '../auth/AuthModals';
import { Button } from '../ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/lib/utils';

const CATEGORY_LINKS = [
  { label: "Music", slug: "music", icon: Music, description: "Concerts, gigs & live music", color: "text-orange-600 dark:text-orange-400" },
  { label: "Theatre", slug: "theatre", icon: Theater, description: "Plays, musicals & performances", color: "text-rose-600 dark:text-rose-400" },
  { label: "Sports", slug: "sports", icon: Trophy, description: "Games, matches & competitions", color: "text-teal-600 dark:text-teal-400" },
  { label: "Arts & Culture", slug: "arts", icon: Palette, description: "Exhibitions, film & festivals", color: "text-purple-600 dark:text-purple-400" },
  { label: "Family", slug: "family", icon: Users, description: "Kids shows & family fun", color: "text-emerald-600 dark:text-emerald-400" },
  { label: "Other", slug: "other", icon: Sparkles, description: "Workshops, networking & more", color: "text-sky-600 dark:text-sky-400" },
];

// Shared button styles for consistency
const headerButtonStyles = "border-2 border-border bg-background text-foreground hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]";
const activeButtonStyles = "bg-primary/10 border-primary/50 text-primary";

function AuthModalHandler({ onOpenModal }: { onOpenModal: (view: 'signin' | 'signup') => void }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const authParam = searchParams.get('auth');
    if (authParam === 'signin' || authParam === 'signup') {
      onOpenModal(authParam);
      const url = new URL(window.location.href);
      url.searchParams.delete('auth');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams, onOpenModal]);

  return null;
}

function HeaderContent() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'signin' | 'signup'>('signin');

  const isOnCategoryPage = pathname?.startsWith('/category/');
  const currentCategory = isOnCategoryPage ? pathname.split('/')[2] : null;
  const isOnEventsPage = pathname === '/events';
  const isOnArchivedPage = pathname === '/events/archived';
  const isOnBrowsePage = isOnCategoryPage || isOnEventsPage || isOnArchivedPage;
  const isOnInsightsPage = pathname === '/insights';
  const isOnNotificationsPage = pathname === '/notifications';
  const isOnProfilePages = pathname === '/favourites' || pathname === '/profile' || pathname === '/settings';

  const openAuthModal = (view: 'signin' | 'signup') => {
    setAuthModalView(view);
    setTimeout(() => setAuthModalOpen(true), 0);
  };

  const handleAuthModal = (view: 'signin' | 'signup') => {
    setAuthModalView(view);
    setAuthModalOpen(true);
  };

  async function handleSignOut() {
    await signOut({ redirect: true, callbackUrl: '/' });
  }

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 transition-all">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl group">
            <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm transition-transform group-hover:scale-105">
              ME
            </span>
            <span className="hidden xs:inline">Melbourne Events</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {/* Insights Link - Desktop */}
            <Link href="/insights" className="hidden md:block">
              <Button
                variant="outline"
                size="sm"
                className={cn(headerButtonStyles, isOnInsightsPage && activeButtonStyles, "gap-2")}
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden lg:inline">Insights</span>
              </Button>
            </Link>

            {/* Browse Events Dropdown - Desktop */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("hidden sm:flex gap-1", headerButtonStyles, isOnBrowsePage && activeButtonStyles)}
                >
                  Browse Events
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Categories</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CATEGORY_LINKS.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = currentCategory === cat.slug;
                  return (
                    <DropdownMenuItem key={cat.slug} asChild>
                      <Link
                        href={`/category/${cat.slug}`}
                        className={cn(
                          "flex items-start gap-3 py-2 cursor-pointer transition-colors",
                          isActive && "bg-accent"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 mt-0.5", isActive ? cat.color : "text-muted-foreground")} />
                        <div>
                          <p className={cn("font-medium", isActive && cat.color)}>{cat.label}</p>
                          <p className="text-xs text-muted-foreground">{cat.description}</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/events"
                    className={cn("flex items-center gap-3 py-2 cursor-pointer transition-colors", isOnEventsPage && "bg-accent")}
                  >
                    <Search className={cn("h-5 w-5", isOnEventsPage ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className={cn("font-medium", isOnEventsPage && "text-primary")}>All Events</p>
                      <p className="text-xs text-muted-foreground">Search & filter everything</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/events/archived"
                    className={cn("flex items-center gap-3 py-2 cursor-pointer transition-colors", isOnArchivedPage && "bg-accent")}
                  >
                    <Archive className={cn("h-5 w-5", isOnArchivedPage ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className={cn("font-medium", isOnArchivedPage && "text-primary")}>Event Archive</p>
                      <p className="text-xs text-muted-foreground">Browse past events</p>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className={cn("sm:hidden", headerButtonStyles)}>
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/events" className={cn("flex items-center gap-2 cursor-pointer transition-colors", isOnEventsPage && "bg-accent text-primary")}>
                    <Search className="h-4 w-4" />
                    All Events
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/events/archived" className={cn("flex items-center gap-2 cursor-pointer transition-colors", isOnArchivedPage && "bg-accent text-primary")}>
                    <Archive className="h-4 w-4" />
                    Event Archive
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/insights" className={cn("flex items-center gap-2 cursor-pointer transition-colors", isOnInsightsPage && "bg-accent text-primary")}>
                    <BarChart3 className="h-4 w-4" />
                    Insights
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Categories</DropdownMenuLabel>
                {CATEGORY_LINKS.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = currentCategory === cat.slug;
                  return (
                    <DropdownMenuItem key={cat.slug} asChild>
                      <Link href={`/category/${cat.slug}`} className={cn("flex items-center gap-2 cursor-pointer transition-colors", isActive && cn("bg-accent", cat.color))}>
                        <Icon className="h-4 w-4" />
                        {cat.label}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/about" className="cursor-pointer transition-colors">About</Link>
                </DropdownMenuItem>
                {session?.user && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href="/favourites" className={cn("flex items-center gap-2 cursor-pointer transition-colors", pathname === '/favourites' && "bg-accent text-primary")}>
                        <Heart className="h-4 w-4" />
                        My Favourites
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className={cn("flex items-center gap-2 cursor-pointer transition-colors", pathname === '/profile' && "bg-accent text-primary")}>
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className={cn("flex items-center gap-2 cursor-pointer transition-colors", pathname === '/settings' && "bg-accent text-primary")}>
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleSignOut} className="text-destructive hover:text-destructive cursor-pointer transition-colors">
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Notification Bell */}
            {session?.user && <NotificationBell isActive={isOnNotificationsPage} />}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Auth Buttons / User Menu - Desktop */}
            {status === 'loading' ? (
              <div className="hidden sm:block h-9 w-20 bg-muted rounded animate-pulse" />
            ) : session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("hidden sm:flex gap-2", headerButtonStyles, isOnProfilePages && activeButtonStyles)}>
                    <User className="h-4 w-4" />
                    <span className="hidden md:inline">{session.user.name}</span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col space-y-1">
                    <span className="font-medium">{session.user.name}</span>
                    <span className="text-xs font-normal text-muted-foreground">{session.user.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/favourites" className={cn("flex items-center gap-2 cursor-pointer transition-colors", pathname === '/favourites' && "bg-accent text-primary")}>
                      <Heart className="h-4 w-4" />
                      My Favourites
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className={cn("flex items-center gap-2 cursor-pointer transition-colors", pathname === '/profile' && "bg-accent text-primary")}>
                      <User className="h-4 w-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className={cn("flex items-center gap-2 cursor-pointer transition-colors", pathname === '/settings' && "bg-accent text-primary")}>
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer transition-colors">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden sm:flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openAuthModal('signin')} className={headerButtonStyles}>
                  Sign In
                </Button>
                <Button variant="outline" size="sm" onClick={() => openAuthModal('signup')} className={headerButtonStyles}>
                  Sign Up
                </Button>
              </div>
            )}
          </nav>
        </div>

        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} defaultView={authModalView} />
      </header>

      <Suspense fallback={null}>
        <AuthModalHandler onOpenModal={handleAuthModal} />
      </Suspense>
    </>
  );
}

export function Header() {
  return (
    <Suspense fallback={
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 font-bold text-lg sm:text-xl">
            <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm">ME</span>
            <span className="hidden xs:inline">Melbourne Events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </header>
    }>
      <HeaderContent />
    </Suspense>
  );
}
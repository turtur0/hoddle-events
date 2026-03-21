'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, ChevronDown, Music, Theater, Trophy, Palette, Users, Sparkles, Menu, LogOut, Settings, User, Heart, BarChart3, Archive, X } from "lucide-react";
import { NotificationBell } from "../notifications/NotificationBell";
import { AuthModal } from '../auth/AuthModals';
import { Button } from '../ui/Button';
import { Lexend_Giga } from 'next/font/google';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { cn } from '@/lib/utils';

const lexendGiga = Lexend_Giga({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
});

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

// Mobile full-screen menu component
function MobileMenu({
  isOpen,
  onClose,
  pathname,
  session,
  onSignOut,
  onOpenAuth
}: {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  session: any;
  onSignOut: () => void;
  onOpenAuth: (view: 'signin' | 'signup') => void;
}) {
  const isOnCategoryPage = pathname?.startsWith('/category/');
  const currentCategory = isOnCategoryPage ? pathname.split('/')[2] : null;
  const isOnEventsPage = pathname === '/events';
  const isOnArchivedPage = pathname === '/events/archived';
  const isOnInsightsPage = pathname === '/insights';

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleLinkClick = () => {
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 sm:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile menu panel - dynamic height */}
      <div
        className={cn(
          "fixed inset-x-0 top-0 max-h-[85vh] z-50 bg-background border-b shadow-lg transition-transform duration-300 ease-out sm:hidden flex flex-col",
          isOpen ? "translate-y-0" : "-translate-y-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b shrink-0">
          <span className={cn(lexendGiga.className, "text-xl font-bold text-primary")}>
            HODDLE
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="hover:bg-primary/10"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Menu content - responsive sizing */}
        <div className="overflow-y-auto flex-1 overscroll-contain">
          <div className="p-3 xs:p-4 space-y-1.5 xs:space-y-2">
            {/* Quick navigation */}
            <div className="space-y-0.5 xs:space-y-1">
              <Link
                href="/events"
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 rounded-lg transition-colors active:scale-95",
                  isOnEventsPage
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                <Search className="h-4 w-4 xs:h-5 xs:w-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm xs:text-base">All Events</p>
                  <p className="text-xs xs:text-sm text-muted-foreground hidden xs:block">Search & filter everything</p>
                </div>
              </Link>

              <Link
                href="/events/archived"
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 rounded-lg transition-colors active:scale-95",
                  isOnArchivedPage
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                <Archive className="h-4 w-4 xs:h-5 xs:w-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm xs:text-base">Event Archive</p>
                  <p className="text-xs xs:text-sm text-muted-foreground hidden xs:block">Browse past events</p>
                </div>
              </Link>

              <Link
                href="/insights"
                onClick={handleLinkClick}
                className={cn(
                  "flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 rounded-lg transition-colors active:scale-95",
                  isOnInsightsPage
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent"
                )}
              >
                <BarChart3 className="h-4 w-4 xs:h-5 xs:w-5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm xs:text-base">Insights</p>
                  <p className="text-xs xs:text-sm text-muted-foreground hidden xs:block">Analytics & trends</p>
                </div>
              </Link>
            </div>

            {/* Categories section */}
            <div className="pt-2 xs:pt-3">
              <p className="text-xs xs:text-sm font-medium text-muted-foreground px-3 xs:px-4 pb-1 xs:pb-2">Categories</p>
              <div className="space-y-0.5 xs:space-y-1">
                {CATEGORY_LINKS.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = currentCategory === cat.slug;
                  return (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      onClick={handleLinkClick}
                      className={cn(
                        "flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 rounded-lg transition-colors active:scale-95",
                        isActive
                          ? cn("bg-primary/10", cat.color)
                          : "hover:bg-accent"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 xs:h-5 xs:w-5 shrink-0", isActive ? cat.color : "text-muted-foreground")} />
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium text-sm xs:text-base", isActive && cat.color)}>{cat.label}</p>
                        <p className="text-xs xs:text-sm text-muted-foreground hidden xs:block">{cat.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* User section */}
            {session?.user ? (
              <div className="pt-2 xs:pt-3 border-t">
                <p className="text-xs xs:text-sm font-medium text-muted-foreground px-3 xs:px-4 pb-1 xs:pb-2">Account</p>
                <div className="space-y-0.5 xs:space-y-1">
                  <Link
                    href="/favourites"
                    onClick={handleLinkClick}
                    className={cn(
                      "flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 rounded-lg transition-colors active:scale-95",
                      pathname === '/favourites'
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    <Heart className="h-4 w-4 xs:h-5 xs:w-5 shrink-0" />
                    <span className="font-medium text-sm xs:text-base">My Favourites</span>
                  </Link>

                  <Link
                    href="/profile"
                    onClick={handleLinkClick}
                    className={cn(
                      "flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 rounded-lg transition-colors active:scale-95",
                      pathname === '/profile'
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    <User className="h-4 w-4 xs:h-5 xs:w-5 shrink-0" />
                    <span className="font-medium text-sm xs:text-base">Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={handleLinkClick}
                    className={cn(
                      "flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 rounded-lg transition-colors active:scale-95",
                      pathname === '/settings'
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    <Settings className="h-4 w-4 xs:h-5 xs:w-5 shrink-0" />
                    <span className="font-medium text-sm xs:text-base">Settings</span>
                  </Link>

                  <button
                    onClick={() => {
                      handleLinkClick();
                      onSignOut();
                    }}
                    className="flex items-center gap-2.5 xs:gap-3 p-3 xs:p-3.5 rounded-lg transition-colors active:scale-95 hover:bg-destructive/10 text-destructive w-full"
                  >
                    <LogOut className="h-4 w-4 xs:h-5 xs:w-5 shrink-0" />
                    <span className="font-medium text-sm xs:text-base">Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="pt-2 xs:pt-3 border-t space-y-1.5 xs:space-y-2">
                <Button
                  onClick={() => {
                    handleLinkClick();
                    onOpenAuth('signin');
                  }}
                  className="w-full h-11 xs:h-12 text-sm xs:text-base"
                  variant="default"
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => {
                    handleLinkClick();
                    onOpenAuth('signup');
                  }}
                  className="w-full h-11 xs:h-12 text-sm xs:text-base"
                  variant="outline"
                >
                  Sign Up
                </Button>
              </div>
            )}

            {/* About link */}
            <div className="pt-1.5 xs:pt-2 pb-4 xs:pb-6">
              <Link
                href="/about"
                onClick={handleLinkClick}
                className="block text-center text-xs xs:text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                About Hoddle
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function HeaderContent() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<'signin' | 'signup'>('signin');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
          <Link href="/" className="flex items-center group">
            <span className={cn(
              lexendGiga.className,
              "text-xl sm:text-2xl font-bold text-primary transition-transform group-hover:scale-105"
            )}>
              HODDLE
            </span>
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

            {/* Mobile Menu Button */}
            <Button
              variant="outline"
              size="icon"
              className={cn("sm:hidden", headerButtonStyles)}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Notification Bell */}
            {session?.user && <NotificationBell isActive={isOnNotificationsPage} />}

            {/* Auth Buttons / User Menu - Desktop */}
            {status === 'loading' ? (
              <div className="hidden sm:block h-9 w-20 bg-muted rounded animate-pulse" />
            ) : session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("hidden sm:flex gap-2", headerButtonStyles, isOnProfilePages && activeButtonStyles)}>
                    <User className="h-4 w-4" />
                    <span className="hidden md:inline">{session.user.username}</span>
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col space-y-1">
                    <span className="font-medium">{session.user.username}</span>
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

      {/* Mobile full-screen menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        pathname={pathname}
        session={session}
        onSignOut={handleSignOut}
        onOpenAuth={openAuthModal}
      />

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
          <div className={cn(lexendGiga.className, "text-xl sm:text-2xl font-bold text-primary")}>
            HODDLE
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
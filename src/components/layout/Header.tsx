'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, ChevronDown, Music, Theater, Trophy, Palette, Users, Sparkles, Menu, LogOut, Settings, User, Heart, BarChart3 } from "lucide-react";
import { ThemeToggle } from '../theme/ThemeToggle';
import { NotificationBell } from "../notifications/NotificationBell";
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
  { label: "Music", slug: "music", icon: Music, description: "Concerts, gigs & live music" },
  { label: "Theatre", slug: "theatre", icon: Theater, description: "Plays, musicals & performances" },
  { label: "Sports", slug: "sports", icon: Trophy, description: "Games, matches & competitions" },
  { label: "Arts & Culture", slug: "arts", icon: Palette, description: "Exhibitions, film & festivals" },
  { label: "Family", slug: "family", icon: Users, description: "Kids shows & family fun" },
  { label: "Other", slug: "other", icon: Sparkles, description: "Workshops, networking & more" },
];

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Check if we're on a category page
  const isOnCategoryPage = pathname?.startsWith('/category/');
  const currentCategory = isOnCategoryPage ? pathname.split('/')[2] : null;

  // Check if we're on the events page
  const isOnEventsPage = pathname === '/events';

  // Check if we're on any browse-related page (categories or all events)
  const isOnBrowsePage = isOnCategoryPage || isOnEventsPage;

  async function handleSignOut() {
    await signOut({ redirect: true, callbackUrl: '/' });
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg sm:text-xl">
          <span className="xs:inline">Melbourne Events</span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Insights Link - Desktop */}
          <Link href="/insights" className="hidden md:block">
            <Button
              variant={pathname === '/insights' ? 'default' : 'ghost'}
              size="sm"
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden lg:inline">Insights</span>
            </Button>
          </Link>

          {/* Browse Events Dropdown - Desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={isOnBrowsePage ? 'default' : 'outline'}
                size="sm"
                className="hidden sm:flex gap-1"
              >
                Browse Events
                <ChevronDown className="h-4 w-4" />
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
                        "flex items-start gap-3 py-2",
                        isActive && "bg-accent"
                      )}
                    >
                      <Icon className={cn(
                        "h-5 w-5 mt-0.5",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                      <div>
                        <p className={cn(
                          "font-medium",
                          isActive && "text-primary"
                        )}>
                          {cat.label}
                        </p>
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
                  className={cn(
                    "flex items-center gap-3 py-2",
                    isOnEventsPage && "bg-accent"
                  )}
                >
                  <Search className={cn(
                    "h-5 w-5",
                    isOnEventsPage ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div>
                    <p className={cn(
                      "font-medium",
                      isOnEventsPage && "text-primary"
                    )}>
                      All Events
                    </p>
                    <p className="text-xs text-muted-foreground">Search & filter everything</p>
                  </div>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="sm:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* All Events */}
              <DropdownMenuItem asChild>
                <Link
                  href="/events"
                  className={cn(
                    "flex items-center gap-2",
                    isOnEventsPage && "bg-accent text-primary"
                  )}
                >
                  <Search className="h-4 w-4" />
                  All Events
                </Link>
              </DropdownMenuItem>

              {/* Insights */}
              <DropdownMenuItem asChild>
                <Link
                  href="/insights"
                  className={cn(
                    "flex items-center gap-2",
                    pathname === '/insights' && "bg-accent text-primary"
                  )}
                >
                  <BarChart3 className="h-4 w-4" />
                  Insights
                </Link>
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Categories</DropdownMenuLabel>

              {/* Categories */}
              {CATEGORY_LINKS.map((cat) => {
                const Icon = cat.icon;
                const isActive = currentCategory === cat.slug;
                return (
                  <DropdownMenuItem key={cat.slug} asChild>
                    <Link
                      href={`/category/${cat.slug}`}
                      className={cn(
                        "flex items-center gap-2",
                        isActive && "bg-accent text-primary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {cat.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}

              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/about">About</Link>
              </DropdownMenuItem>

              {/* User Menu Items (Mobile) */}
              {session?.user && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/favourites"
                      className={cn(
                        "flex items-center gap-2",
                        pathname === '/favourites' && "bg-accent text-primary"
                      )}
                    >
                      <Heart className="h-4 w-4" />
                      My Favourites
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/profile"
                      className={cn(
                        "flex items-center gap-2",
                        pathname === '/profile' && "bg-accent text-primary"
                      )}
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link
                      href="/settings"
                      className={cn(
                        "flex items-center gap-2",
                        pathname === '/settings' && "bg-accent text-primary"
                      )}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Notification Bell - Only show for authenticated users */}
          {session?.user && <NotificationBell />}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Auth Buttons / User Menu - Desktop */}
          {status === 'loading' ? (
            <div className="hidden sm:block h-9 w-20 bg-muted rounded animate-pulse" />
          ) : session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={
                    pathname === '/favourites' ||
                      pathname === '/profile' ||
                      pathname === '/settings'
                      ? 'default'
                      : 'outline'
                  }
                  size="sm"
                  className="hidden sm:flex gap-2"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden md:inline">{session.user.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col space-y-1">
                  <span className="font-medium">{session.user.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{session.user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/favourites"
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      pathname === '/favourites' && "bg-accent text-primary"
                    )}
                  >
                    <Heart className="h-4 w-4" />
                    My Favourites
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/profile"
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      pathname === '/profile' && "bg-accent text-primary"
                    )}
                  >
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings"
                    className={cn(
                      "flex items-center gap-2 cursor-pointer",
                      pathname === '/settings' && "bg-accent text-primary"
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden sm:flex gap-2">
              <Link href="/signin">
                <Button variant="outline" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button variant="outline" size="sm">Sign Up</Button>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
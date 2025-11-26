'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, ChevronDown, Music, Theater, Trophy, Palette, Users, Sparkles, Menu, LogOut, Settings, User, Heart } from "lucide-react";
import { ThemeToggle } from '../theme/ThemeToggle';
import { NotificationBell } from "../other/NotificationBell";
import { Button } from '../ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

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
          {/* Browse Events Dropdown - Hidden on mobile */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden sm:flex gap-1">
                Browse Events
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Categories</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CATEGORY_LINKS.map((cat) => {
                const Icon = cat.icon;
                return (
                  <DropdownMenuItem key={cat.slug} asChild>
                    <Link
                      href={`/category/${cat.slug}`}
                      className="flex items-start gap-3 py-2"
                    >
                      <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{cat.label}</p>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/events" className="flex items-center gap-3 py-2">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">All Events</p>
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
              <DropdownMenuItem asChild>
                <Link href="/events" className="flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  All Events
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Categories</DropdownMenuLabel>
              {CATEGORY_LINKS.map((cat) => {
                const Icon = cat.icon;
                return (
                  <DropdownMenuItem key={cat.slug} asChild>
                    <Link href={`/category/${cat.slug}`} className="flex items-center gap-2">
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
              {session?.user && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/favourites" className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      My Favourites
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2">
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
                <Button variant="outline" size="sm" className="hidden sm:flex gap-2">
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
                  <Link href="/favourites" className="flex items-center gap-2 cursor-pointer">
                    <Heart className="h-4 w-4" />
                    My Favourites
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
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
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ChevronDown, Music, Theater, Trophy, Palette, Users, Sparkles, Menu } from "lucide-react";
import { ThemeToggle } from "../theme/theme-toggle";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
              <Button variant="ghost" size="sm" className="hidden sm:flex gap-1">
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
              <Button variant="ghost" size="icon" className="sm:hidden">
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
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
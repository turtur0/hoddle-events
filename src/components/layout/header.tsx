import Link from "next/link";
import { Calendar, Search } from "lucide-react";
import { ThemeToggle } from "../theme/theme-toggle";
import { Button } from "../ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 flex justify-center">
      <div className="container flex h-16 items-center justify-between w-full">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <span>Melbourne Events</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <Search className="h-4 w-4 mr-2" />
              Browse Events
            </Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
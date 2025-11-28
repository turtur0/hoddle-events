import Link from "next/link";
import { Button } from '@/components/ui/Button';
import { Calendar, Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="w-full min-h-[80vh] flex items-center justify-center bg-linear-to-b from-muted/20 to-background animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
      <div className="container max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted/50 border-2 border-border/50 p-8 mb-8 backdrop-blur-sm">
            <Calendar className="h-16 w-16 text-muted-foreground" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Page Not Found</h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-md">
            The page you're looking for doesn't exist or may have been moved.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto border-2 border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 transition-all group shadow-sm"
            >
              <Link href="/" className="flex items-center justify-center">
                <Home className="mr-2 h-5 w-5" />
                Go to Home
              </Link>
            </Button>

            <Button
              variant="outline"
              size="lg"
              asChild
              className="w-full sm:w-auto border-2 border-secondary/30 hover:border-secondary/50 hover:bg-secondary/10 transition-all group"
            >
              <Link href="/events" className="flex items-center justify-center">
                <Search className="mr-2 h-5 w-5" />
                Browse Events
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
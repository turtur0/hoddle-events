import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <div className="rounded-full bg-muted p-6 mb-6">
          <Calendar className="h-12 w-12 text-muted-foreground" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">Page Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild>
            <Link href="/">Go to Home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/events">Browse Events</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
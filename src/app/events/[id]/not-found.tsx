import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <main className="container py-16">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Calendar className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Event Not Found</h1>
          <p className="text-muted-foreground mb-6 max-w-md">
            The event you're looking for doesn't exist or may have been removed.
          </p>
          <Button asChild>
            <Link href="/">Back to Events</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
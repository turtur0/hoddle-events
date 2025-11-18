import { Card, CardContent, CardFooter } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export function EventCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      {/* Image skeleton */}
      <Skeleton className="h-48 w-full rounded-b-none" />

      <CardContent className="p-4">
        {/* Badge skeleton */}
        <Skeleton className="h-5 w-20 mb-2" />

        {/* Title skeleton */}
        <Skeleton className="h-6 w-full mb-2" />
        <Skeleton className="h-6 w-3/4 mb-4" />

        {/* Date skeleton */}
        <Skeleton className="h-4 w-32 mb-2" />

        {/* Venue skeleton */}
        <Skeleton className="h-4 w-40 mb-2" />

        {/* Price skeleton */}
        <Skeleton className="h-4 w-24" />
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Skeleton className="h-10 w-full" />
      </CardFooter>
    </Card>
  );
}
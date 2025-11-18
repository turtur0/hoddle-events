import { Calendar } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "No events found",
  description = "We couldn't find any events matching your criteria. Try adjusting your filters or check back later.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Calendar className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="font-bold text-xl mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}
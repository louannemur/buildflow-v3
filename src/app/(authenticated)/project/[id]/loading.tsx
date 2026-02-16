import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectStepLoading() {
  return (
    <div className="p-6 sm:p-8">
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

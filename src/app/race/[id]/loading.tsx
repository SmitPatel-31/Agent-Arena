import { Skeleton } from '@/components/skeleton';

export default function Loading() {
  return (
    <div role="status" aria-label="Loading race" className="flex flex-col gap-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-24" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[60vh] rounded-2xl" />
        <Skeleton className="h-[60vh] rounded-2xl" />
      </div>
    </div>
  );
}

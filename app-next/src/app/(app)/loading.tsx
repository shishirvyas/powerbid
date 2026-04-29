import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AppLoading() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-44 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted/80" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-6 w-20 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-muted/80" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

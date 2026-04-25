import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="space-y-6 animate-in fade-in-50">
      <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
      <Card>
        <CardHeader><CardTitle>Coming soon</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Customer directory and contacts management.
        </CardContent>
      </Card>
    </div>
  );
}

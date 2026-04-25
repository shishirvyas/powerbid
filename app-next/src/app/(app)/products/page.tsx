import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="space-y-6 animate-in fade-in-50">
      <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
      <Card>
        <CardHeader><CardTitle>Coming soon</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Product catalogue with brand, unit and GST mapping.
        </CardContent>
      </Card>
    </div>
  );
}

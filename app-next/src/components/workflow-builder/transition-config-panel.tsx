"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkflowBuilderStore } from "@/lib/workflow-builder-store";

export function TransitionConfigPanel() {
  const { edges, selectedEdgeId, updateSelectedEdge } = useWorkflowBuilderStore();

  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  return (
    <Card className="border-slate-200/80 bg-white">
      <CardHeader className="pb-2 pt-2">
        <CardTitle className="text-sm">Transition Config Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!selectedEdge ? (
          <p className="text-xs text-slate-500">Select a transition edge to configure trigger rules.</p>
        ) : (
          <>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
              {selectedEdge.source} → {selectedEdge.target}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Trigger Event</Label>
              <Input
                value={selectedEdge.data?.trigger ?? ""}
                onChange={(event) => updateSelectedEdge({ trigger: event.target.value })}
                placeholder="order.submitted"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Guard Condition</Label>
              <Textarea
                value={selectedEdge.data?.guard ?? ""}
                onChange={(event) => updateSelectedEdge({ guard: event.target.value })}
                placeholder="total_amount > 0 && all_items_valid"
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Auto Action</Label>
              <Select
                value={selectedEdge.data?.autoAction ?? "none"}
                onChange={(event) =>
                  updateSelectedEdge({
                    autoAction: event.target.value as "none" | "invalidate_rfq" | "block_po" | "hold_production",
                  })
                }
              >
                <option value="none">None</option>
                <option value="invalidate_rfq">Invalidate RFQ</option>
                <option value="block_po">Block PO</option>
                <option value="hold_production">Hold Production</option>
              </Select>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

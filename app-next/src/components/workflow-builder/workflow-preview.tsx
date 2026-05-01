"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkflowBuilderStore } from "@/lib/workflow-builder-store";

export function WorkflowPreview() {
  const { nodes, edges } = useWorkflowBuilderStore();

  return (
    <Card className="border-slate-200/80 bg-white">
      <CardHeader className="pb-2 pt-2">
        <CardTitle className="text-sm">Workflow Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">States</div>
            <div className="space-y-2">
              {nodes.map((node) => (
                <div key={node.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
                  <span className="font-medium text-slate-700">{node.data.label}</span>
                  <span className="text-slate-500">{node.data.roles.length} roles</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Transitions</div>
            <div className="space-y-2">
              {edges.map((edge) => (
                <div key={edge.id} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
                  <div className="font-medium text-slate-700">{edge.source} → {edge.target}</div>
                  <div className="mt-1 text-slate-500">Trigger: {edge.data?.trigger || "-"}</div>
                  <div className="text-slate-500">Auto action: {edge.data?.autoAction || "none"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

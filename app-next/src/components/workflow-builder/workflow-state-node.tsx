"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { WorkflowNodeData } from "@/lib/workflow-builder-store";

export function WorkflowStateNode({ data, selected }: NodeProps) {
  const payload = data as WorkflowNodeData;

  return (
    <div
      className={[
        "min-w-[170px] rounded-xl border bg-white p-3 shadow-sm transition-all",
        selected ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-slate-400"
      />
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">State</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{payload.label}</div>
      <div className="mt-2 text-[11px] text-slate-500">
        {payload.roles.length > 0 ? `${payload.roles.length} role(s) assigned` : "No roles assigned"}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-blue-500"
      />
    </div>
  );
}

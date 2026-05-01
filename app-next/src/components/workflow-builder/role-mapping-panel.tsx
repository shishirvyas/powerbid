"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkflowBuilderStore } from "@/lib/workflow-builder-store";

const roleOptions = ["admin", "sales", "procurement", "production", "stores", "qa"];

export function RoleMappingPanel() {
  const { nodes, selectedNodeId, assignRolesToSelectedNode } = useWorkflowBuilderStore();

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedRoles = selectedNode?.data.roles ?? [];

  const toggleRole = (role: string) => {
    const next = selectedRoles.includes(role)
      ? selectedRoles.filter((value) => value !== role)
      : selectedRoles.concat(role);
    assignRolesToSelectedNode(next);
  };

  return (
    <Card className="border-slate-200/80 bg-white">
      <CardHeader className="pb-2 pt-2">
        <CardTitle className="text-sm">Role Mapping Panel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!selectedNode ? (
          <p className="text-xs text-slate-500">Select a state node to map roles.</p>
        ) : (
          <>
            <div>
              <div className="text-xs font-medium text-slate-600">State</div>
              <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm font-medium text-slate-800">
                {selectedNode.data.label}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {roleOptions.map((role) => {
                const checked = selectedRoles.includes(role);
                return (
                  <label
                    key={role}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole(role)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                    />
                    <span className="capitalize">{role}</span>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

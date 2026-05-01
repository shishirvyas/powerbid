"use client";

import "@xyflow/react/dist/style.css";

import { Download, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { WorkflowDesignerCanvas } from "@/components/workflow-builder/workflow-designer-canvas";
import { RoleMappingPanel } from "@/components/workflow-builder/role-mapping-panel";
import { TransitionConfigPanel } from "@/components/workflow-builder/transition-config-panel";
import { WorkflowPreview } from "@/components/workflow-builder/workflow-preview";

export function WorkflowBuilderScreen() {
  return (
    <section className="space-y-3">
      <PageHeader
        title="Workflow Builder"
        description="Design states, transitions, roles, and trigger logic in one enterprise-grade workspace."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4" />
              Import JSON
            </Button>
            <Button size="sm">
              <Download className="h-4 w-4" />
              Export JSON
            </Button>
          </>
        }
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <WorkflowDesignerCanvas />
        <div className="space-y-3">
          <RoleMappingPanel />
          <TransitionConfigPanel />
        </div>
      </div>

      <WorkflowPreview />
    </section>
  );
}

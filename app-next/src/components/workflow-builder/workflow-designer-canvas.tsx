"use client";

import * as React from "react";
import {
  Background,
  Controls,
  MiniMap,
  type OnSelectionChangeFunc,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { Plus, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkflowBuilderStore } from "@/lib/workflow-builder-store";
import { WorkflowStateNode } from "@/components/workflow-builder/workflow-state-node";

const nodeTypes = {
  workflowState: WorkflowStateNode,
};

const paletteStates = ["Draft", "Review", "Approved", "On Hold", "Cancelled"];

function CanvasInner() {
  const reactFlow = useReactFlow();
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addStateNode,
    selectNode,
    selectEdge,
    reset,
  } = useWorkflowBuilderStore();

  const [dragLabel, setDragLabel] = React.useState<string>("State");

  const onDragOver = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const bounds = (event.target as HTMLElement).getBoundingClientRect();
      const position = reactFlow.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      addStateNode(dragLabel, position);
    },
    [addStateNode, dragLabel, reactFlow],
  );

  const onSelectionChange = React.useCallback<OnSelectionChangeFunc>(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (selectedNodes.length > 0) {
        selectNode(selectedNodes[0].id);
        return;
      }
      if (selectedEdges.length > 0) {
        selectEdge(selectedEdges[0].id);
        return;
      }
      selectNode(null);
      selectEdge(null);
    },
    [selectEdge, selectNode],
  );

  return (
    <Card className="h-[540px] overflow-hidden border-slate-200/80 bg-white">
      <CardHeader className="border-b border-slate-200/80 bg-slate-50/70 pb-2 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">Workflow Designer</CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={reset}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex h-[492px] flex-col">
          <div className="flex items-center gap-2 border-b border-slate-200/80 bg-white px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Drag states</div>
            {paletteStates.map((stateLabel) => (
              <button
                key={stateLabel}
                draggable
                onDragStart={() => setDragLabel(stateLabel)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:border-blue-200 hover:bg-blue-50"
                type="button"
              >
                <Plus className="h-3 w-3" />
                {stateLabel}
              </button>
            ))}
          </div>
          <div className="relative flex-1" onDrop={onDrop} onDragOver={onDragOver}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onSelectionChange={onSelectionChange}
              fitView
              className="bg-[radial-gradient(circle_at_1px_1px,#e2e8f0_1px,transparent_0)] [background-size:20px_20px]"
            >
              <MiniMap className="!bg-white" pannable zoomable />
              <Controls />
              <Background gap={20} size={0} />
            </ReactFlow>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkflowDesignerCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

"use client";

import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  MarkerType,
} from "@xyflow/react";

export type WorkflowNodeData = {
  label: string;
  roles: string[];
};

export type WorkflowEdgeData = {
  trigger: string;
  guard: string;
  autoAction: "none" | "invalidate_rfq" | "block_po" | "hold_production";
};

type WorkflowNode = Node<WorkflowNodeData>;
type WorkflowEdge = Edge<WorkflowEdgeData>;

type WorkflowBuilderState = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  addStateNode: (label: string, position: { x: number; y: number }) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  assignRolesToSelectedNode: (roles: string[]) => void;
  updateSelectedEdge: (patch: Partial<WorkflowEdgeData>) => void;
  reset: () => void;
};

const initialNodes: WorkflowNode[] = [
  {
    id: "state-draft",
    type: "workflowState",
    position: { x: 120, y: 120 },
    data: { label: "Draft", roles: ["sales"] },
  },
  {
    id: "state-review",
    type: "workflowState",
    position: { x: 420, y: 120 },
    data: { label: "Review", roles: ["admin", "procurement"] },
  },
  {
    id: "state-approved",
    type: "workflowState",
    position: { x: 760, y: 120 },
    data: { label: "Approved", roles: ["admin"] },
  },
];

const initialEdges: WorkflowEdge[] = [
  {
    id: "transition-submit",
    source: "state-draft",
    target: "state-review",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { trigger: "order.submitted", guard: "amount > 0", autoAction: "none" },
  },
  {
    id: "transition-approve",
    source: "state-review",
    target: "state-approved",
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { trigger: "order.approved", guard: "all_checks_passed", autoAction: "none" },
  },
];

const makeId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

export const useWorkflowBuilderStore = create<WorkflowBuilderState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  selectedEdgeId: null,

  onNodesChange: (changes) => {
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) }));
  },

  onConnect: (connection) => {
    const id = makeId("transition");
    set((state) => ({
      edges: addEdge(
        {
          ...connection,
          id,
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          data: {
            trigger: "entity.transitioned",
            guard: "",
            autoAction: "none",
          },
        },
        state.edges,
      ),
      selectedEdgeId: id,
      selectedNodeId: null,
    }));
  },

  addStateNode: (label, position) => {
    const id = makeId("state");
    set((state) => ({
      nodes: state.nodes.concat({
        id,
        type: "workflowState",
        position,
        data: { label, roles: [] },
      }),
      selectedNodeId: id,
      selectedEdgeId: null,
    }));
  },

  selectNode: (id) => {
    set({ selectedNodeId: id, selectedEdgeId: null });
  },

  selectEdge: (id) => {
    set({ selectedEdgeId: id, selectedNodeId: null });
  },

  assignRolesToSelectedNode: (roles) => {
    const nodeId = get().selectedNodeId;
    if (!nodeId) return;
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, roles } } : node,
      ),
    }));
  },

  updateSelectedEdge: (patch) => {
    const edgeId = get().selectedEdgeId;
    if (!edgeId) return;
    set((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              data: {
                trigger: edge.data?.trigger ?? "",
                guard: edge.data?.guard ?? "",
                autoAction: edge.data?.autoAction ?? "none",
                ...patch,
              },
            }
          : edge,
      ),
    }));
  },

  reset: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },
}));

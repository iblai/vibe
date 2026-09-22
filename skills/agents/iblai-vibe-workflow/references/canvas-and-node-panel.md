# Workflow builder — canvas component and node config panel (Steps 7–8)

Moved out of `SKILL.md` to keep the skill scannable; this is the full text.

## Step 7: Build the Canvas Component

`components/workflows/workflow-canvas.tsx` -- a custom canvas (no ReactFlow).

### Critical implementation details

1. **Node dimension measurement**: Nodes auto-size to content, so you MUST
   measure actual rendered dimensions with refs. Without this, edge lines
   won't connect to handle dots:

   ```typescript
   const nodeRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
   const nodeSizesRef = useRef<Map<string, { w: number; h: number }>>(new Map());

   useEffect(() => {
     let changed = false;
     nodeRefsMap.current.forEach((el, id) => {
       const rect = el.getBoundingClientRect();
       const w = rect.width / zoom;
       const h = rect.height / zoom;
       const prev = nodeSizesRef.current.get(id);
       if (!prev || Math.abs(prev.w - w) > 1 || Math.abs(prev.h - h) > 1) {
         nodeSizesRef.current.set(id, { w, h });
         changed = true;
       }
     });
     if (changed) {
       setNodes((prev) => prev.map((n) => {
         const measured = nodeSizesRef.current.get(n.id);
         if (measured && (n.width !== measured.w || n.height !== measured.h))
           return { ...n, width: measured.w, height: measured.h };
         return n;
       }));
     }
   });

   const nodeRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
     if (el) nodeRefsMap.current.set(id, el);
     else nodeRefsMap.current.delete(id);
   }, []);
   ```

   Attach `ref={nodeRef(node.id)}` to **every** node div (Start, End, While,
   Conditional, User-Approval, Note, Agent, and Default). Missing even one
   will cause edge misalignment for that node type.

2. **Handle position math**: The handle dots are positioned with CSS
   (`left: -HANDLE_RADIUS - 2`), so the edge endpoint must match:

   ```typescript
   const HANDLE_RADIUS = 6;
   const HANDLE_OFFSET = 2; // NOT 8! Must equal center of handle dot relative to node edge

   function getHandlePosition(node: CanvasNode, handle: string) {
     const w = node.width ?? NODE_WIDTH;
     const h = node.height ?? NODE_HEIGHT;
     switch (handle) {
       case "left":   return { x: node.position.x - HANDLE_OFFSET, y: node.position.y + h / 2 };
       case "right":  return { x: node.position.x + w + HANDLE_OFFSET, y: node.position.y + h / 2 };
       case "top":    return { x: node.position.x + w / 2, y: node.position.y - HANDLE_OFFSET };
       case "bottom": return { x: node.position.x + w / 2, y: node.position.y + h + HANDLE_OFFSET };
     }
   }
   ```

   The handle dot CSS is `left: -(HANDLE_RADIUS + 2)` = -8px from node edge.
   The dot is 12px wide, so its center is at -8 + 6 = -2px from node edge.
   Therefore `HANDLE_OFFSET = 2` makes the edge endpoint hit the center.

3. **Drop handler**: Read from `e.dataTransfer`, NOT from a ref:

   ```typescript
   const handleDrop = (e: React.DragEvent) => {
     e.preventDefault();
     const raw = e.dataTransfer.getData("application/json") || e.dataTransfer.getData("text/plain");
     if (!raw) return;
     const item = JSON.parse(raw);
     // ... create node at drop position
   };
   ```

   Using a ref for the dragged item causes "Cannot read properties of null"
   because the sidebar's `onDragStart` may not fire before `onDrop`.

4. **Edge rendering**: SVG layer for bezier curves with pan/zoom transform.
   Use two paths per edge -- one transparent for click target, one visible:

   ```tsx
   <path d={path} stroke="transparent" strokeWidth="12" fill="none" onClick={() => removeEdge(edge.id)} />
   <path d={path} stroke="#38A1E5" strokeWidth="2" fill="none" strokeLinecap="round" />
   ```

5. **Node type renderers**: Each node type needs its own visual:
   - **Start**: play icon, right handle only
   - **End**: stop icon (red), left handle only
   - **Agent**: bot icon, pencil config button, all 4 handles
   - **Conditional**: branch icon, dynamic condition rows with per-condition right handles + left handle
   - **While**: dashed border container, loop icon, left + right handles
   - **User-Approval**: thumbs-up icon, approve/reject rows with right handles + left handle
   - **Note**: amber sticky note background, no handles
   - **Default** (transform, set-state, etc.): bot icon, type label, all 4 handles

6. **Middle-click panning**: Handle `e.button === 1` BEFORE the `e.button !== 0` guard:

   ```typescript
   const handleCanvasMouseDown = (e) => {
     if (e.button === 1) { // middle-click -> pan
       setIsPanning(true);
       setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
       return;
     }
     if (e.button !== 0) return; // only left-click below
     // ...
   };
   ```

   If you check `e.button !== 0` first, TypeScript narrows the type to `0`
   and `e.button === 1` becomes a type error.

7. **Click vs drag distinction**: The config panel must open on mouseup
   (click without drag), NOT on mousedown. Otherwise dragging a node also
   opens its config panel:

   ```typescript
   const handleNodeMouseDown = (e, nodeId) => {
     // Select the node, set up drag tracking
     dragStartRef.current = { x: e.clientX, y: e.clientY };
     dragMovedRef.current = false;
     setDraggedNode(nodeId);
     // Do NOT open config panel here
   };

   const handleMouseUp = () => {
     if (draggedNode) {
       setNodes((prev) => prev.map((n) => ({ ...n, dragging: false })));
       if (dragMovedRef.current) {
         saveToHistory(nodes, edges);
       } else {
         // Click without drag -- open config panel
         setSelectedNodeForConfig(draggedNode);
       }
     }
     // ... cleanup
   };
   ```

   Use `DRAG_THRESHOLD = 3` pixels to distinguish click from drag:

   ```typescript
   // In handleMouseMove:
   if (dragStartRef.current) {
     const dx = Math.abs(e.clientX - dragStartRef.current.x);
     const dy = Math.abs(e.clientY - dragStartRef.current.y);
     if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) dragMovedRef.current = true;
   }
   ```

### WorkflowCanvas props

```typescript
interface WorkflowCanvasProps {
  draggedItem: { id: string; label: string; type: string } | null;
  clickedItem: { id: string; label: string; type: string } | null;
  onStateChange?: (nodes: CanvasNode[], edges: CanvasEdge[]) => void;
  initialNodes?: CanvasNode[];
  initialEdges?: CanvasEdge[];
}
```

## Step 8: Build the Node Config Panel

`components/workflows/node-config-panel.tsx` -- opens when a node is clicked.

### Critical: Event propagation

The config panel MUST stop event propagation on both `onClick` AND
`onMouseDown`. Without this, clicks inside the panel bubble to the canvas,
which deselects the node and closes the panel:

```typescript
const panelShell = (children: React.ReactNode) => (
  <div
    className="absolute top-4 right-4 z-20 flex max-h-[calc(100vh-14rem)] w-[320px] flex-col rounded-xl border border-zinc-200 bg-white shadow-xl"
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
  >
    <div className="flex-1 space-y-3 overflow-y-auto p-3">{children}</div>
  </div>
);
```

Any modals spawned from the panel (e.g. "Add variable" modal) also need
`onClick` and `onMouseDown` stopPropagation on their overlay:

```tsx
{showAddVar && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
    onClick={(e) => e.stopPropagation()}
    onMouseDown={(e) => e.stopPropagation()}
  >
    {/* modal content */}
  </div>
)}
```

### Props

```typescript
interface NodeConfigPanelProps {
  nodeId: string;
  nodeType: string;
  nodeData: NodeConfig;
  onClose: () => void;
  onUpdateNode: (nodeId: string, updates: Partial<NodeConfig>) => void;
  org?: string;
}
```

### Sync pattern with isLocalUpdate ref

Use an `isLocalUpdate` ref to prevent sync loops. When the panel updates
nodeData via `onUpdateNode`, the parent re-renders with new nodeData.
The sync effect should skip that update to avoid overwriting the user's
input cursor position:

```typescript
const isLocalUpdate = useRef(false);

const update = useCallback((updates: Partial<NodeConfig>) => {
  isLocalUpdate.current = true;
  onUpdateNode(nodeId, updates);
}, [nodeId, onUpdateNode]);

// Sync from external changes (undo/redo, switching nodes)
useEffect(() => {
  if (isLocalUpdate.current) {
    isLocalUpdate.current = false;
    return;
  }
  setNodeName(nodeData.label);
  setInstructions(nodeData.instructions ?? "");
  setStateVariables(nodeData.stateVariables ?? []);
  setConditions(nodeData.conditions ?? [{ id: "c-1", caseName: "", expression: "" }]);
  setWhileExpr(nodeData.whileExpression ?? "");
  setTransformExprs(nodeData.transformExpressions ?? [{ id: "t-1", key: "", value: "" }]);
  setTransformMode(nodeData.transformMode ?? "expressions");
  setAssignments(nodeData.setStateAssignments ?? [{ id: "a-1", variable: "", value: "" }]);
  setEndOutput(nodeData.output ?? "");
  setApprovalMsg(nodeData.userApprovalMessage ?? "");
  setContinueOnError(nodeData.continueOnError ?? false);
}, [nodeData]);
```

### Node type panels

Each node type gets its own panel:
- **start**: State variable list + "Add variable" modal with type picker (String/Number/Boolean/Object/List)
- **agent**: Name, instructions textarea, model (read-only), "Continue on error" toggle
- **conditional** (`if-else` or `conditional`): Dynamic condition list with add/remove
- **while**: Expression textarea
- **transform**: Mode toggle (expressions/object) + key/value pairs
- **set-state**: Variable/value assignment pairs
- **end**: Output textarea
- **user-approval**: Name + approval message textarea
- **guardrails**: Checkbox list for PII, Moderation, Jailbreak, Hallucination
- **file-search**: Max results + query
- **mcp**: Placeholder for MCP server connections
- **fallback**: Name field only

### Continue on error toggle (agent panel)

The agent panel includes a "Continue on error" toggle switch:

```tsx
<div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/80 p-2.5">
  <span className="text-xs text-zinc-700">Continue on error</span>
  <button
    onClick={() => {
      const next = !continueOnError;
      setContinueOnError(next);
      update({ continueOnError: next });
    }}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
      continueOnError ? "bg-[#38A1E5]" : "bg-zinc-300"
    }`}
  >
    <span
      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
        continueOnError ? "translate-x-4" : "translate-x-0.5"
      }`}
    />
  </button>
</div>
```

### handleUpdateNode in the canvas

```typescript
const handleUpdateNode = useCallback(
  (nid: string, updates: Partial<NodeConfig>) => {
    setNodes((prev) => {
      const newNodes = prev.map((n) => {
        if (n.id !== nid) return n;
        // Sync mentor_id when entry_mentor_id is set
        const shouldSync = n.type === "mentor" && updates.entry_mentor_id !== undefined;
        const normalized = shouldSync ? { ...updates, mentor_id: updates.entry_mentor_id } : updates;
        return { ...n, data: { ...n.data, ...normalized } };
      });
      saveToHistory(newNodes, edges);
      return newNodes;
    });
  },
  [edges, saveToHistory]
);
```

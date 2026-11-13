# Workflow exports

What `/iblai-vibe-workflow` mounts is two components; this is everything
else the SDK exports for workflows, for a host that composes its own editor
or calls the API from its own UI.

## Lower-level pieces

- From `/next`: `WorkflowCanvas` (`initialNodes` / `initialEdges` /
  `onStateChange`, `onDraggedItem` / `onClickedItem`, `previewMode`, `org` /
  `defaultMentorId` / `username`, `onOpenAgentSettings`, `agentSettings`,
  `classifierModels`, `onTryClassifier`, `focusRequest`), `NodeConfigPanel`
  (`nodeId`, `nodeType`, `nodeData`, `onUpdateNode`, `onDeleteNode`,
  `workflowVariables`, `stepReferences`, `placeholderVariables`,
  `placeholderSteps`, `classifierModels`, `onTryClassifier`, `focusField`,
  …), `WorkflowPreviewChat`, and their `*Props` types.
- From `@iblai/iblai-js/web-containers`: `WorkflowSidebar` (`onDragStart`,
  `onItemClick`, `nodeTypes?`, `className?`), `CreateWorkflowModal`,
  `DeleteWorkflowModal`, `ConnectorManagementDialog`, `ToolDialogs`, and the
  definition helpers — `NodeConfig`, `collectWorkflowVariables`,
  `collectVariableUsages`, `placeholderSources`, `migrateWorkflowDefinition`,
  `isValidVariableName`, `classifierBranches`, `categoryIdFor`,
  `reconcileClassifierEdges`, `startVariableDefaults`, `CLASSIFIER_HANDLES`,
  `CLASSIFIER_LIMITS`, `IBLAI_DECISION_MODEL`, `WHILE_MAX_ITERATIONS`,
  `INPUT_PLACEHOLDER`, `variablePlaceholder`, `stepPlaceholder`.

The node data model (every `NodeConfig` field per step, the handles, the
migrations) is in [`node-data-model.md`](node-data-model.md).

## Data-layer hooks

From `@iblai/iblai-js/data-layer` (`workflowsApiSlice`):

- `useGetWorkflowsQuery` / `useLazyGetWorkflowsQuery` — `{ org, params?: {
  search, is_active, is_template, created_by, sort, limit, offset } }` →
  `PaginatedWorkflowList`
- `useGetWorkflowQuery`, `useCreateWorkflowMutation` (`{ org, data: { name,
  description?, definition? } }`), `usePatchWorkflowMutation` (`{ org,
  uniqueId, data: { name?, description?, definition?, chat_name?,
  chat_proactive_response? } }`), `useUpdateWorkflowMutation`,
  `useDeleteWorkflowMutation`
- `useValidateWorkflowMutation`, `usePublishWorkflowMutation` (`{ org,
  uniqueId, data?: { definition? } }`), `useUnpublishWorkflowMutation`,
  `useActivateWorkflowMutation`, `useDeactivateWorkflowMutation` — the last
  three and validate answer `WorkflowValidationResponse` `{ is_valid,
  errors, warnings, error_details?, warning_details?, workflow? }`
- `useTestWorkflowClassifierMutation` (`{ org, uniqueId, data: { node_id,
  input, variables? } }` → `ClassifierTestResponse`)
- `useChatWithWorkflowMutation` (`{ org, uniqueId, message }` →
  `{ response, workflow_id, session_id }`), `useGetNodeTypesQuery` →
  `{ node_types: Record<id, NodeTypeInfo>, categories }`
- Types: `Workflow` (`unique_id`, `name`, `definition`, `is_active`,
  `entry_mentor_id`, `published_at`, `has_unpublished_changes`,
  `node_count`, `edge_count`, `updated_at`, …), `WorkflowDefinition`,
  `WorkflowValidationIssue`, `NodeTypeInfo`, `NodeFieldSchema`,
  `ClassifierTestArgs`, `ClassifierTestResponse`.

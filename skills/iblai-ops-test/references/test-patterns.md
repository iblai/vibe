# Test Patterns

Extended recipes for the test buckets called out in
[`iblai-ops-test`](../SKILL.md). Use these when you need more than the
inline examples in the main skill.

## 1. Mocking RTK Query hooks

The SDK exposes RTK Query hooks (`useGetMentorsQuery`,
`useAddTrainingDocumentMutation`, etc.). Mock them at the import
boundary; never try to spin up a real store in unit tests.

### Query hook

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorsQuery: () => ({
    data: { results: [{ unique_id: 'm1', name: 'Alpha' }] },
    isLoading: false,
    isError: false,
  }),
}))

import { AgentList } from '@/components/agent-list'

describe('AgentList', () => {
  it('renders the mentor name', () => {
    render(<AgentList />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })
})
```

### Mutation hook

Mutations return a tuple `[trigger, { isLoading, ... }]`. `trigger`
should return an object with `.unwrap()`:

```typescript
const triggerMock = vi.fn().mockResolvedValue({ unique_id: 'm1' })
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useCreateMentorMutation: () => [
    (args: unknown) => ({ unwrap: () => triggerMock(args) }),
    { isLoading: false },
  ],
}))
```

To assert what the mutation was called with:

```typescript
expect(triggerMock).toHaveBeenCalledWith(
  expect.objectContaining({ org: 'gwu', formData: expect.any(Object) })
)
```

### Lazy queries

Lazy queries return `[trigger, queryResult]`. `trigger(args).unwrap()`
resolves to the data:

```typescript
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useLazyGetCredentialsQuery: () => [
    vi.fn().mockReturnValue({ unwrap: () => Promise.resolve([]) }),
    { data: undefined, isLoading: false },
  ],
}))
```

## 2. Mocking `next/navigation`

`useRouter`, `useParams`, `useSearchParams`, and `usePathname` aren't
available in jsdom. Stub them per test file.

### Static stub

```typescript
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))
```

### Mutable stub (for tests that change params mid-suite)

```typescript
const params = vi.hoisted(() => ({
  current: { tenantId: undefined, mentorId: undefined } as Record<string, string | undefined>,
}))

vi.mock('next/navigation', () => ({
  useParams: () => params.current,
}))

// In a test:
params.current = { tenantId: 'gwu', mentorId: 'agent-1' }
```

`vi.hoisted` is required because `vi.mock` calls hoist above imports —
the params object needs to exist at hoist time.

### Asserting router calls

```typescript
const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}))

await userEvent.click(screen.getByRole('button', { name: /go/i }))
expect(push).toHaveBeenCalledWith('/explore-agents')
```

## 3. Component rendering with providers

Many components need `<TenantProvider>` or `<AgentSettingsProvider>` in
their tree. Wrap with a thin helper:

```typescript
// __tests__/render-with-providers.tsx
import { render, type RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

interface Options extends RenderOptions {
  tenantKey?: string
  mentorId?: string
}

export function renderWithProviders(ui: ReactElement, opts: Options = {}) {
  // Cheap stub — the real providers do auth + token refresh which we don't
  // want in unit tests. Mock the *consumers* (useUrlContext, useAgentSettings)
  // and pass children through.
  return render(ui, opts)
}
```

Then mock the context-consumer hook in each test:

```typescript
vi.mock('@/lib/iblai/use-url-context', () => ({
  useUrlContext: () => ({
    tenantKey: 'gwu',
    mentorId: 'agent-1',
    username: 'tester',
    ready: true,
  }),
}))
```

## 4. User events

```typescript
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('opens the dialog on click', async () => {
  const user = userEvent.setup()
  render(<MyComponent />)
  await user.click(screen.getByRole('button', { name: /open/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
```

Avoid `fireEvent` — `userEvent` simulates real user interactions
(hover, focus, key sequences) so coverage of accessibility-related
code paths is much better.

## 5. Async assertions

For RTK Query results, debounced effects, or anything that updates
state after the first render, use `waitFor` and `findBy*`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'

const { result } = renderHook(() => useUrlContext())
await waitFor(() => expect(result.current.ready).toBe(true))
```

```typescript
expect(await screen.findByText('Saved')).toBeInTheDocument()
```

## 6. Forcing the unhappy path

To cover error branches:

### Mutation rejects

```typescript
const triggerMock = vi.fn().mockReturnValue({
  unwrap: () => Promise.reject({ data: { detail: 'boom' } }),
})
```

Then assert `toast.error` was called (after mocking `sonner`):

```typescript
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
import { toast } from 'sonner'

// ... trigger the action ...
await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'))
```

### Query errors out

```typescript
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorsQuery: () => ({ data: undefined, isError: true, error: { status: 500 } }),
}))
```

### Empty results

```typescript
vi.mock('@iblai/iblai-js/data-layer', () => ({
  useGetMentorsQuery: () => ({ data: { results: [] }, isLoading: false }),
}))

it('shows the empty state', () => {
  render(<AgentList />)
  expect(screen.getByText(/no agents yet/i)).toBeInTheDocument()
})
```

## 7. Module-scoped config tests

When testing functions that read `process.env` at module load, reset
modules between tests:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadConfig() {
  vi.resetModules()
  const mod = await import('../config')
  return mod.default
}

describe('config', () => {
  const original = { ...process.env }
  beforeEach(() => { process.env = { ...original } })
  afterEach(()  => { process.env = { ...original } })

  it('reads NEXT_PUBLIC_BASE_PATH', async () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/hq'
    const config = await loadConfig()
    expect(config.basePath()).toBe('/hq')
  })
})
```

## 8. Snapshot tests — when, and when not

- **Yes**: stable presentational components (icons, badges with frozen props).
- **No**: anything that pulls live data or has random IDs. Snapshots
  flake and become noise.

```typescript
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

it('matches snapshot', () => {
  const { container } = render(<Badge status="active" />)
  expect(container.firstChild).toMatchInlineSnapshot()
})
```

Run `vitest -u` to update on intentional changes.

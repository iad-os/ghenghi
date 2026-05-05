# Ghenghi

> "Yes… only if necessary, but… I will kill Ghii."

Ghenghi is a **reactive configuration watcher** built on top of [ghii-v2](https://github.com/iad-os/ghii#readme). While ghii-v2 handles loading and validating your configuration, Ghenghi adds a layer on top: it watches for changes and fires events only when the paths you actually care about are modified — the **bullet paths**.

---

## How it works

```
loaders → ghii-v2 (merge + validate) → ghenghi (diff + filter) → ghenghi:shot
```

1. **ghii-v2** polls your loaders on a configurable interval, deep-merges their results, and validates the output against your schema.
2. **Ghenghi** listens to each new snapshot, computes a JSON-Pointer diff against the previous one, and emits `ghenghi:shot` only when at least one of the declared `bulletPaths` has changed.

If nothing in a bullet path changed, the event is silent — no false positives.

---

## Installation

```bash
npm install @iad-os/ghenghi
```

Ghenghi is schema-agnostic. You need to bring your own ghii-v2 engine adapter. The examples below use [Zod](https://zod.dev).

```bash
npm install @ghii/ghii-v2 zod
```

---

## Quick start

### 1. Create a Zod engine adapter

```ts
import { z } from 'zod';
import type { GhiiEngine } from '@ghii/ghii-v2';

function zodEngine<T>(schema: z.ZodType<T>): GhiiEngine<T> {
  return {
    validate(input: unknown) {
      const result = schema.safeParse(input);
      if (result.success) return { success: true, value: result.data };
      return {
        success: false,
        errors: result.error.issues.map(issue => ({
          path: '/' + issue.path.join('/'),
          input,
          details: issue,
          message: issue.message,
          _raw: issue,
        })),
      };
    },
    toJsonSchema() {
      return JSON.stringify(schema);
    },
  };
}
```

### 2. Define your config schema and loaders

```ts
import { ghii } from '@ghii/ghii-v2';

const AppConfigSchema = z.object({
  server: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().default(3000),
  }),
  feature: z.object({
    darkMode: z.boolean().default(false),
  }),
});

const config = ghii(zodEngine(AppConfigSchema))
  .loader(() => ({ server: { host: 'localhost', port: 3000 } }))
  .loader(async () => fetchRemoteConfig()); // any async source
```

### 3. Create a Ghenghi watcher

```ts
import { Ghenghi } from '@iad-os/ghenghi';

const watcher = Ghenghi(config, {
  bulletPaths: ['/server/port', '/feature/darkMode'],
  refreshSnapshotInterval: 30, // seconds between polls, default 60
});
```

### 4. React to changes

```ts
watcher.on('ghenghi:shot', ({ value, diff }) => {
  // fired only when a bullet path changed
  diff.forEach(edit => {
    console.log(`${edit.bullet ? '[BULLET]' : '[change]'} ${edit.path} → ${edit.value}`);
  });
  applyNewConfig(value);
});

watcher.on('ghenghi:recoil', ({ err }) => {
  console.error('Snapshot failed:', err);
});
```

### 5. Start and stop

```ts
// take the first snapshot, then start the polling interval
await config.takeSnapshot();
watcher.run();

// stop polling (e.g. on graceful shutdown)
watcher.stop();
```

---

## API

### `Ghenghi(ghiiInstance, options?)`

| Parameter | Type | Description |
|---|---|---|
| `ghiiInstance` | `GhiiLike<Config>` | Any ghii-v2 instance (or compatible object). |
| `options.bulletPaths` | `string[]` | JSON Pointer paths to watch. No shot is fired if this list is empty. |
| `options.refreshSnapshotInterval` | `number` | Polling interval in **seconds**. Defaults to `60`. |

Returns a `GhenghiInstance<Config>`.

### `GhenghiInstance<Config>`

| Member | Description |
|---|---|
| `run()` | Start listening to ghii events and polling. |
| `stop()` | Stop polling (clears the interval). |
| `on(event, listener)` | Subscribe to Ghenghi events. |
| `once(event, listener)` | Subscribe once to a Ghenghi event. |

### Events

#### `ghenghi:shot`

Fired when at least one bullet path has changed between two consecutive valid snapshots.

```ts
{
  value: Config;       // the full current configuration
  diff: GhenghiEdit[]; // all changed paths in this snapshot
}
```

Each `GhenghiEdit`:

```ts
{
  type: 'U' | 'C' | 'D'; // Updated / Created / Deleted
  path: string;           // JSON Pointer (e.g. "/server/port")
  value?: unknown;        // new value (absent for deletions)
  bullet: boolean;        // true if this path matched a bulletPath
}
```

#### `ghenghi:recoil`

Fired when `takeSnapshot()` throws (e.g. a loader fails or validation errors).

```ts
{ err: unknown }
```

---

## Bullet paths

Bullet paths use JSON Pointer notation (`/foo/bar`). A path matches if it equals a bullet path **or starts with it**, so `/feature` watches the entire `feature` subtree:

```ts
bulletPaths: ['/feature']
// matches: /feature/darkMode, /feature/maxRetries, etc.
```

---

## License

MIT

import { EventEmitter } from 'node:events';
import type TypedEventEmitter from './TypedEventEmitter.js';

export interface GhenghiOptions {
  refreshSnapshotInterval?: number;
  bulletPaths?: string[];
}

export type EditType = 'U' | 'C' | 'D';

export interface Edit {
  type: EditType;
  path: string;
  value?: unknown;
}

export type GhenghiEdit = Edit & { bullet: boolean };

export interface EventTypes<Config = unknown> {
  'ghenghi:shot': { value: Config; diff: GhenghiEdit[] };
  'ghenghi:recoil': { err: unknown };
}

export interface GhenghiEmitter<Config> extends TypedEventEmitter<EventTypes<Config>> {}

/** Minimal structural interface satisfied by ghii-v2 instances. */
export interface GhiiLike<Config> {
  on(
    event: 'ghii:refresh',
    listener: (v: { version: number; config: Config | undefined; previousConfig: Config | undefined }) => void
  ): unknown;
  takeSnapshot(): Promise<Config>;
}

export interface GhenghiInstance<Config> {
  run: () => void;
  stop: () => void;
  on<K extends keyof EventTypes<Config>>(event: K, listener: (v: EventTypes<Config>[K]) => void): void;
  once<K extends keyof EventTypes<Config>>(event: K, listener: (v: EventTypes<Config>[K]) => void): void;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function deepDiff(prev: unknown, next: unknown, path = ''): Edit[] {
  if (prev === next) return [];
  if (isPlainObject(prev) && isPlainObject(next)) {
    const edits: Edit[] = [];
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const key of allKeys) {
      const childPath = `${path}/${key}`;
      if (!(key in prev)) {
        edits.push({ type: 'C', path: childPath, value: next[key] });
      } else if (!(key in next)) {
        edits.push({ type: 'D', path: childPath });
      } else {
        edits.push(...deepDiff(prev[key], next[key], childPath));
      }
    }
    return edits;
  }
  return [{ type: 'U', path, value: next }];
}

export const Ghenghi = <Config>(ghii: GhiiLike<Config>, options?: GhenghiOptions): GhenghiInstance<Config> => {
  const { refreshSnapshotInterval = 60, bulletPaths = [] } = options ?? {};

  let interval: ReturnType<typeof setInterval> | undefined;

  const events = new EventEmitter() as unknown as GhenghiEmitter<Config>;

  const ghiiRefreshListener = (active: {
    version: number;
    config: Config | undefined;
    previousConfig: Config | undefined;
  }) => {
    if (active.previousConfig === undefined || bulletPaths.length === 0) return;

    const diff = deepDiff(active.previousConfig, active.config);
    if (diff.length === 0) return;

    const changedPaths = diff.map(e => e.path);
    const bullets = changedPaths.filter(c => bulletPaths.some(b => c === b || c.startsWith(b)));

    if (bullets.length > 0) {
      events.emit('ghenghi:shot', {
        value: active.config as Config,
        diff: diff.map(e => ({ ...e, bullet: bullets.includes(e.path) })),
      });
    }
  };

  const run = () => {
    ghii.on('ghii:refresh', ghiiRefreshListener);

    interval = setInterval(() => {
      ghii.takeSnapshot().catch((err: unknown) => {
        events.emit('ghenghi:recoil', { err });
      });
    }, refreshSnapshotInterval * 1000);
  };

  const stop = () => {
    clearInterval(interval);
  };

  return {
    run,
    stop,
    on: events.on.bind(events),
    once: events.once.bind(events),
  };
};

export default Ghenghi;

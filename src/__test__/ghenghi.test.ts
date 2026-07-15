import { ghii } from '@ghii/ghii-v2';
import { z } from 'zod';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Ghenghi, type EventTypes } from '../ghenghi.js';
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

describe('Ghenghi Config', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('Ghenghi is instantiable', () => {
    expect(Ghenghi).toBeDefined();
  });

  it('Ghenghi start and stop', () => {
    const ghiiInstance = ghii(
      zodEngine(
        z.object({
          foo: z.object({ prop1: z.string().default('prop1') }),
          foo2: z.object({ prop1: z.string().default('prop1') }),
        })
      )
    ).loader(() => ({}));

    const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo/prop1'], refreshSnapshotInterval: 3 });
    target.run();
    target.stop();
  });

  it('load without config', () => {
    const ghiiInstance = ghii(
      zodEngine(
        z.object({
          foo: z.object({ prop1: z.string().default('prop1') }),
          foo2: z.object({ prop1: z.string().default('prop1') }),
        })
      )
    ).loader(() => ({}));

    const target = Ghenghi(ghiiInstance);
    target.run();
    target.stop();
  });

  it('load without refresh config', () => {
    const ghiiInstance = ghii(
      zodEngine(
        z.object({
          foo: z.object({ prop1: z.string() }).default({ prop1: 'prop1' }),
          foo2: z.object({ prop1: z.string() }).default({ prop1: 'prop1' }),
        })
      )
    ).loader(() => ({}));

    const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo/prop1'] });
    target.run();
    target.stop();
  });

  it('load without bullet path config', async () => {
    const ghiiInstance = ghii(
      zodEngine(
        z.object({
          foo: z.object({ prop1: z.string() }).default({ prop1: 'prop1' }),
          foo2: z.object({ prop1: z.string() }).default({ prop1: 'prop1' }),
        })
      )
    ).loader(() => ({}));

    const target = Ghenghi(ghiiInstance, { refreshSnapshotInterval: 3 });
    target.run();
    target.stop();
  });

  describe('base configs', () => {
    it('reload snapshot with bullet path', async () => {
      const ghiiInstance = ghii(
        zodEngine(
          z.object({
            foo: z.object({ prop1: z.string() }).default({ prop1: 'prop1' }),
            foo2: z.object({ prop1: z.string() }).default({ prop1: 'prop1' }),
          })
        )
      ).loader(() => ({}));

      const result = await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo/prop1'], refreshSnapshotInterval: 3 });

      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => resolve(ev));
        target.run();
        ghiiInstance.loader(async () => ({ foo: { prop1: 'prop10' } }));
        ghiiInstance.takeSnapshot();
      });

      expect(ev.diff).toMatchObject([{ path: '/foo/prop1', bullet: true }]);
      expect(result).toStrictEqual({ foo: { prop1: 'prop1' }, foo2: { prop1: 'prop1' } });
      target.stop();
    });

    it('reload snapshot without bullet path', async () => {
      const ghiiInstance = ghii(
        zodEngine(
          z.object({
            foo: z.object({ prop1: z.string() }).default({ prop1: 'prop1' }),
            foo2: z.object({ prop1: z.string() }).default({ prop1: 'prop1' }),
          })
        )
      ).loader(() => ({}));

      const result = await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { refreshSnapshotInterval: 3 });

      const ev = await new Promise<{ config: unknown; previousConfig: unknown }>(resolve => {
        ghiiInstance.once('ghii:refresh', (ev: { config: unknown; previousConfig: unknown }) => {
          if (ev.previousConfig !== undefined) resolve(ev);
        });
        target.run();
        ghiiInstance.loader(async () => ({ foo: { prop1: 'prop10' } }));
        ghiiInstance.takeSnapshot();
      });

      expect((ev.config as { foo: { prop1: string } }).foo.prop1).toBe('prop10');
      expect((ev.previousConfig as { foo: { prop1: string } }).foo.prop1).toBe('prop1');
      expect(result).toStrictEqual({ foo: { prop1: 'prop1' }, foo2: { prop1: 'prop1' } });
      target.stop();
    });

    it('reload snapshot (min max)', async () => {
      const ghiiInstance = ghii(
        zodEngine(
          z.object({
            foo: z.object({ prop: z.string().min(3).max(3).default('min') }).default({ prop: 'min' }),
          })
        )
      ).loader(() => ({}));

      await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo/prop'], refreshSnapshotInterval: 3 });

      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => resolve(ev));
        target.run();
        ghiiInstance.loader(async () => ({ foo: { prop: 'max' } }));
        ghiiInstance.takeSnapshot();
      });

      expect(ev.diff).toMatchObject([{ path: '/foo/prop', bullet: true }]);
      target.stop();
    });

    it('reload snapshot change by root', async () => {
      const ghiiInstance = ghii(
        zodEngine(
          z.object({
            foo: z.object({ prop: z.string().min(3).max(3) }).default({ prop: 'min' }),
          })
        )
      ).loader(() => ({}));

      await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo'], refreshSnapshotInterval: 3 });

      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => resolve(ev));
        target.run();
        ghiiInstance.loader(async () => ({ foo: { prop: 'max' } }));
        ghiiInstance.takeSnapshot();
      });

      expect(ev.diff).toMatchObject([{ path: '/foo/prop', bullet: true }]);
      target.stop();
    });

    it('reload snapshot when root bullet matches nested mongo database', async () => {
      const mongoConfigSchema = z.object({
        uris: z.string(),
        database: z.string(),
        collection: z.string(),
        timeoutMs: z.number(),
        options: z.record(z.unknown()),
      });
      const ghiiInstance = ghii(
        zodEngine(
          z.object({
            mongo: z.object({
              activity: mongoConfigSchema,
              actor: mongoConfigSchema,
              wellKnownUrl: z.string(),
            }),
          })
        )
      ).loader(() => ({
        mongo: {
          activity: {
            uris: 'mongodb+srv://audit_activity@cluster-mother.oglpdhe.mongodb.net/?appName=cluster-mother',
            database: 'audits-sink-activity',
            collection: 'audit_activity_events',
            timeoutMs: 600000,
            options: {},
          },
          actor: {
            uris: 'mongodb+srv://audit_actor@cluster-mother.oglpdhe.mongodb.net/?appName=cluster-mother',
            database: 'audits-sink-actor',
            collection: 'audit_actor_events',
            timeoutMs: 600000,
            options: {},
          },
          wellKnownUrl: 'http://host.docker.internal:40009/well-known/mother-audits-dashboard',
        },
      }));

      await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/mongo'], refreshSnapshotInterval: 3 });

      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => resolve(ev));
        target.run();
        ghiiInstance.loader(() => ({
          mongo: {
            activity: {
              uris: 'mongodb+srv://audit_activity@cluster-mother.oglpdhe.mongodb.net/?appName=cluster-mother',
              database: 'audits-sink-activity',
              collection: 'audit_activity_events',
              timeoutMs: 600000,
              options: {},
            },
            actor: {
              uris: 'mongodb+srv://audit_actor@cluster-mother.oglpdhe.mongodb.net/?appName=cluster-mother',
              database: 'audits-sink-actor-changed',
              collection: 'audit_actor_events',
              timeoutMs: 600000,
              options: {},
            },
            wellKnownUrl: 'http://host.docker.internal:40009/well-known/mother-audits-dashboard',
          },
        }));
        ghiiInstance.takeSnapshot();
      });

      expect(ev.diff).toMatchObject([
        { path: '/mongo/actor/database', value: 'audits-sink-actor-changed', bullet: true },
      ]);
      target.stop();
    });
  });

  describe('array configs', () => {
    // Regression: arrays used to fall through to `prev === next`, which is always false
    // after a reload (new references in memory), so identical arrays were marked 'U'.
    it('does not flag an array whose content is unchanged (new references)', async () => {
      const nodes = ['http://a:9200', 'http://b:9200'];
      const ghiiInstance = ghii(
        zodEngine(
          z.object({
            version: z.string(),
            elasticsearch: z.object({ nodes: z.array(z.string()) }),
          })
        )
      ).loader(() => ({ version: 'v1', elasticsearch: { nodes: [...nodes] } }));

      await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/version'], refreshSnapshotInterval: 3 });

      // Bump a scalar sibling to force a refresh; the array keeps identical content
      // but brand new references (as a real config reload would produce).
      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => resolve(ev));
        target.run();
        ghiiInstance.loader(() => ({ version: 'v2', elasticsearch: { nodes: [...nodes] } }));
        ghiiInstance.takeSnapshot();
      });

      // Only the scalar change is reported; the untouched array is absent from the diff.
      expect(ev.diff).toMatchObject([{ type: 'U', path: '/version', value: 'v2', bullet: true }]);
      expect(ev.diff.some(e => e.path.startsWith('/elasticsearch/nodes'))).toBe(false);
      target.stop();
    });

    it('shots with a granular indexed path when an array element changes', async () => {
      const ghiiInstance = ghii(
        zodEngine(
          z.object({
            elasticsearch: z.object({ nodes: z.array(z.string()) }),
          })
        )
      ).loader(() => ({ elasticsearch: { nodes: ['http://a:9200', 'http://b:9200'] } }));

      await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/elasticsearch/nodes'], refreshSnapshotInterval: 3 });

      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => resolve(ev));
        target.run();
        ghiiInstance.loader(() => ({ elasticsearch: { nodes: ['http://a:9200', 'http://c:9200'] } }));
        ghiiInstance.takeSnapshot();
      });

      expect(ev.diff).toMatchObject([
        { type: 'U', path: '/elasticsearch/nodes/1', value: 'http://c:9200', bullet: true },
      ]);
      target.stop();
    });

    it('reports a granular diff for arrays of objects without false positives on identical entries', async () => {
      const bucketConfigs = [
        { name: 'notifications', quota: 10 },
        { name: 'events', quota: 20 },
      ];
      const ghiiInstance = ghii(
        zodEngine(
          z.object({
            minio: z.object({ bucketConfigs: z.array(z.object({ name: z.string(), quota: z.number() })) }),
          })
        )
      ).loader(() => ({ minio: { bucketConfigs: bucketConfigs.map(b => ({ ...b })) } }));

      await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/minio/bucketConfigs'], refreshSnapshotInterval: 3 });

      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => resolve(ev));
        target.run();
        // Only the second entry's quota changes; first entry is identical (new refs).
        ghiiInstance.loader(() => ({
          minio: { bucketConfigs: [{ name: 'notifications', quota: 10 }, { name: 'events', quota: 99 }] },
        }));
        ghiiInstance.takeSnapshot();
      });

      expect(ev.diff).toMatchObject([
        { type: 'U', path: '/minio/bucketConfigs/1/quota', value: 99, bullet: true },
      ]);
      target.stop();
    });
  });
});

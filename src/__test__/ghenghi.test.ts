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
        ghiiInstance.once('ghii:refresh', ev => {
          if (ev.previousConfig !== undefined) resolve(ev as { config: unknown; previousConfig: unknown });
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
  });
});

import ghii from '@ghii/ghii-next';
import Ghenghi, { EventTypes, GhenghiEmitter } from '../ghenghi';
import { EventTypes as GhiiEventTypes } from '@ghii/ghii-next';

describe('Ghenghi Config', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  it('Ghenghi is instantiable', () => {
    expect(Ghenghi).toBeDefined();
  });
  it('Ghenghi start and stop', () => {
    const ghiiInstance = ghii(T =>
      T.Object({
        foo: T.Object({
          prop1: T.String({ default: 'prop1' }),
        }),
        foo2: T.Object({
          prop1: T.String({ default: 'prop1' }),
        }),
      })
    );

    const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo/prop1'], refreshSnapshotInterval: 3 });
    target.run();
    target.stop();
  });
  it('load without config', () => {
    const ghiiInstance = ghii(T =>
      T.Object({
        foo: T.Object({
          prop1: T.String({ default: 'prop1' }),
        }),
        foo2: T.Object({
          prop1: T.String({ default: 'prop1' }),
        }),
      })
    );

    const target = Ghenghi(ghiiInstance);
    target.run();
    target.stop();
  });
  it('load without refresh config', () => {
    const ghiiInstance = ghii(T =>
      T.Object({
        foo: T.Object(
          {
            prop1: T.String(),
          },
          { default: { prop1: 'prop1' } }
        ),
        foo2: T.Object(
          {
            prop1: T.String(),
          },
          { default: { prop1: 'prop1' } }
        ),
      })
    );

    const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo/prop1'] });
    target.run();
    target.stop();
  });
  it('load without bullet path config', async () => {
    const ghiiInstance = ghii(T =>
      T.Object({
        foo: T.Object(
          {
            prop1: T.String(),
          },
          { default: { prop1: 'prop1' } }
        ),
        foo2: T.Object(
          {
            prop1: T.String(),
          },
          { default: { prop1: 'prop1' } }
        ),
      })
    );

    const target = Ghenghi(ghiiInstance, { refreshSnapshotInterval: 3 });
    target.run();
    target.stop();
  });
  describe('base configs', () => {
    it('reload snapshot with bullet path', async () => {
      const ghiiInstance = ghii(T =>
        T.Object({
          foo: T.Object(
            {
              prop1: T.String(),
            },
            { default: { prop1: 'prop1' } }
          ),
          foo2: T.Object(
            {
              prop1: T.String(),
            },
            { default: { prop1: 'prop1' } }
          ),
        })
      );
      const result = await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo/prop1'], refreshSnapshotInterval: 3 });
      jest.advanceTimersToNextTimer();
      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => {
          resolve(ev);
        });
        target.run();
        ghiiInstance.loader(async () => ({ foo: { prop1: 'prop10' } }));
        ghiiInstance.takeSnapshot();
      });
      expect(ev.diff).toMatchObject([{ path: '/foo/prop1', bullet: true }]);
      expect(result).toStrictEqual({
        foo: { prop1: 'prop1' },
        foo2: { prop1: 'prop1' },
      });
      target.stop();
    });
    it('reload snapshot without bullet path', async () => {
      const ghiiInstance = ghii(T =>
        T.Object({
          foo: T.Object(
            {
              prop1: T.String(),
            },
            { default: { prop1: 'prop1' } }
          ),
          foo2: T.Object(
            {
              prop1: T.String(),
            },
            { default: { prop1: 'prop1' } }
          ),
        })
      );
      const result = await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { refreshSnapshotInterval: 3 });
      jest.advanceTimersToNextTimer();
      const ev = await new Promise<GhiiEventTypes<any>['ghii:version:new']>(resolve => {
        ghiiInstance.once('ghii:version:new', ev => {
          resolve(ev);
        });
        target.run();
        ghiiInstance.loader(async () => ({ foo: { prop1: 'prop10' } }));
        ghiiInstance.takeSnapshot();
      });
      expect(ev.diff).toMatchObject([{ path: '/foo/prop1' }]);
      expect(result).toStrictEqual({
        foo: { prop1: 'prop1' },
        foo2: { prop1: 'prop1' },
      });
      target.stop();
    });
    it('reload snapshot (min max)', async () => {
      const ghiiInstance = ghii(Type =>
        Type.Object({
          foo: Type.Object(
            {
              prop: Type.String({ maxLength: 3, minLength: 3, default: 'min' }),
            },
            { default: { prop: 'min' } }
          ),
        })
      );
      await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo/prop'], refreshSnapshotInterval: 3 });
      jest.advanceTimersToNextTimer();
      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => {
          resolve(ev);
        });
        target.run();
        ghiiInstance.loader(async () => ({ foo: { prop: 'max' } }));
        ghiiInstance.takeSnapshot();
      });
      expect(ev.diff).toMatchObject([{ path: '/foo/prop', bullet: true }]);
      target.stop();
    });
    it('reload snapshot change by root', async () => {
      const ghiiInstance = ghii(Type =>
        Type.Object({
          foo: Type.Object(
            {
              prop: Type.String({ maxLength: 3, minLength: 3 }),
            },
            { default: { prop: 'min' } }
          ),
        })
      );
      await ghiiInstance.takeSnapshot();
      const target = Ghenghi(ghiiInstance, { bulletPaths: ['/foo'], refreshSnapshotInterval: 3 });
      jest.advanceTimersToNextTimer();
      const ev = await new Promise<EventTypes['ghenghi:shot']>(resolve => {
        target.once('ghenghi:shot', ev => {
          resolve(ev);
        });
        target.run();
        ghiiInstance.loader(async () => ({ foo: { prop: 'max' } }));
        ghiiInstance.takeSnapshot();
      });
      expect(ev.diff).toMatchObject([{ path: '/foo/prop', bullet: true }]);
      target.stop();
    });
  });
});

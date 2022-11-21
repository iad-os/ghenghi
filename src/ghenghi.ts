import { EventTypes as GhiiEventTypes, GhiiInstance, SnapshotVersion } from '@ghii/ghii-next';
import { TSchema } from '@sinclair/typebox';
import { Edit } from '@sinclair/typebox/value';
import { EventEmitter } from 'events';
import { intersection, isEmpty } from 'lodash';
import { ValueOf } from 'type-fest';
import TypedEventEmitter from './TypedEventEmitter';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GhenghiOptions {
  refreshSnapshotInterval?: number;
  bulletPaths?: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface GhenghiInstance<O extends TSchema> {
  run: () => void;
  stop: () => void;
  on: ValueOf<Pick<GhenghiEmitter<O>, 'on'>>;
  once: ValueOf<Pick<GhenghiEmitter<O>, 'once'>>;
}

export type GhenghiEdit = Edit & { bullet: boolean };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface EventTypes<O extends TSchema = TSchema> {
  'ghenghi:shot': { value: SnapshotVersion<O>; diff: GhenghiEdit[] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'ghenghi:recoil': { err: any };
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GhenghiEmitter<O extends TSchema> extends TypedEventEmitter<EventTypes<O>> {}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Ghenghi = <O extends TSchema>(ghii: GhiiInstance<O>, options?: GhenghiOptions): GhenghiInstance<O> => {
  const { refreshSnapshotInterval = 60, bulletPaths = [] } = options || {};

  let interval: NodeJS.Timer | undefined = undefined;

  const events = new EventEmitter() as unknown as GhenghiEmitter<O>;

  const ghiiNewVersionListener: (event: GhiiEventTypes<O>['ghii:version:new']) => void = ({ value, diff }) => {
    if (!isEmpty(bulletPaths) && !isEmpty(diff)) {
      const changedPaths = diff.map(({ path }) => path);
      const bullets = intersection(changedPaths, bulletPaths);
      !isEmpty(bullets) &&
        events.emit('ghenghi:shot', {
          value,
          diff: diff.map<GhenghiEdit>(value => ({ ...value, bullet: !!bullets.find(path => path === value.path) })),
        });
    }
  };

  const run = () => {
    ghii.on('ghii:version:new', ghiiNewVersionListener);

    interval = setInterval(
      /* istanbul ignore next */ () => {
        ghii.takeSnapshot().catch(err => {
          events.emit('ghenghi:recoil', err);
        });
      },
      refreshSnapshotInterval * 1000
    );
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

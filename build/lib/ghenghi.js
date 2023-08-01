import { EventEmitter } from 'events';
import { intersectionWith, isEmpty } from 'lodash-es';
export const Ghenghi = (ghii, options) => {
    const { refreshSnapshotInterval = 60, bulletPaths = [] } = options || {};
    let interval = undefined;
    const events = new EventEmitter();
    const ghiiNewVersionListener = ({ value, diff }) => {
        if (!isEmpty(bulletPaths) && !isEmpty(diff)) {
            const changedPaths = diff.map(({ path }) => path);
            const bullets = intersectionWith(changedPaths, bulletPaths, (c, b) => c === b || c.startsWith(b));
            !isEmpty(bullets) &&
                events.emit('ghenghi:shot', {
                    value,
                    diff: diff.map(value => ({ ...value, bullet: !!bullets.find(path => path === value.path) })),
                });
        }
    };
    const run = () => {
        ghii.on('ghii:version:new', ghiiNewVersionListener);
        interval = setInterval(() => {
            ghii.takeSnapshot().catch(err => {
                events.emit('ghenghi:recoil', err);
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

import type { GhiiInstance, SnapshotVersion } from '@ghii/ghii-es';
import { TSchema } from '@sinclair/typebox';
import { Edit } from '@sinclair/typebox/value';
import { ValueOf } from 'type-fest';
import { TypedEventEmitter } from './TypedEventEmitter';
export interface GhenghiOptions {
    refreshSnapshotInterval?: number;
    bulletPaths?: string[];
}
export interface GhenghiInstance<O extends TSchema> {
    run: () => void;
    stop: () => void;
    on: ValueOf<Pick<GhenghiEmitter<O>, 'on'>>;
    once: ValueOf<Pick<GhenghiEmitter<O>, 'once'>>;
}
export type GhenghiEdit = Edit & {
    bullet: boolean;
};
export interface EventTypes<O extends TSchema = TSchema> {
    'ghenghi:shot': {
        value: SnapshotVersion<O>;
        diff: GhenghiEdit[];
    };
    'ghenghi:recoil': {
        err: unknown;
    };
}
export interface GhenghiEmitter<O extends TSchema> extends TypedEventEmitter<EventTypes<O>> {
}
export declare const Ghenghi: <O extends TSchema>(ghii: GhiiInstance<O>, options?: GhenghiOptions) => GhenghiInstance<O>;
//# sourceMappingURL=ghenghi.d.ts.map
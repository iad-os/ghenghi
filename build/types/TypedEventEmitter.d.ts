export interface TypedEventEmitter<T> {
    on<K extends keyof T>(name: K, listener: (v: T[K]) => void): this;
    addListener<K extends keyof T>(event: K, listener: (v: T[K]) => void): this;
    once<K extends keyof T>(event: K, listener: (v: T[K]) => void): this;
    prependListener<K extends keyof T>(event: K, listener: (v: T[K]) => void): this;
    prependOnceListener<K extends keyof T>(event: K, listener: (v: T[K]) => void): this;
    removeListener<K extends keyof T>(event: K, listener: (v: T[K]) => void): this;
    off<K extends keyof T>(event: K, listener: (v: T[K]) => void): this;
    removeAllListeners<K extends keyof T>(event?: K): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners<K extends keyof T>(event: K): (v: T[K]) => void[];
    rawListeners<K extends keyof T>(event: K): (v: T[K]) => void[];
    emit<K extends keyof T>(event: K, args: T[K]): boolean;
    eventNames<K extends keyof T>(): Array<K>;
}
//# sourceMappingURL=TypedEventEmitter.d.ts.map
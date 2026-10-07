/**
 * Emitter mínimo tipado — sem dependências, sem alocação por emit.
 */

export type Handler<T> = (payload: T) => void;

export class Emitter<Events extends { [K in keyof Events]: unknown }> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, cb: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(cb as Handler<never>);
    return () => this.off(event, cb);
  }

  off<K extends keyof Events>(event: K, cb: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(cb as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const cb of set) (cb as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

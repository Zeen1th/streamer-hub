export class SerialCounterSyncQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }

  drain(): Promise<void> {
    return this.tail;
  }
}

export const counterSyncQueue = new SerialCounterSyncQueue();

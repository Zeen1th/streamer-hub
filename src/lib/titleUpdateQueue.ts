export class SerialTitleUpdateQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task);
    this.tail = next.then(() => undefined, () => undefined);
    return next;
  }
}

export const titleUpdateQueue = new SerialTitleUpdateQueue();

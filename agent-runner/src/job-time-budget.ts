/** Count only execution time. Overlapping approvals pause the budget until the last wait settles. */
export class JobTimeBudget {
  #remaining: number;
  #started = performance.now();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #waiting = 0;
  #stopped = false;
  readonly #expire: () => void;

  constructor(minutes: number, expire: () => void) {
    this.#remaining = minutes * 60_000;
    this.#expire = expire;
    this.#resume();
  }

  #resume(): void {
    this.#started = performance.now();
    this.#timer = setTimeout(this.#expire, this.#remaining).unref();
  }

  async pauseFor<T>(wait: () => Promise<T>): Promise<T> {
    if (this.#stopped) return wait();
    if (this.#waiting++ === 0) {
      clearTimeout(this.#timer);
      this.#remaining -= performance.now() - this.#started;
      if (this.#remaining <= 0) this.#expire();
    }
    try {
      return await wait();
    } finally {
      if (--this.#waiting === 0 && !this.#stopped) this.#resume();
    }
  }

  stop(): void {
    this.#stopped = true;
    clearTimeout(this.#timer);
  }
}

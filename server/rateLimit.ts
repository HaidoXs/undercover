export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillEveryMs: number,
    now = Date.now(),
  ) {
    this.tokens = capacity;
    this.last = now;
  }

  private refill(now: number): void {
    const elapsed = now - this.last;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed / this.refillEveryMs);
    this.last = now;
  }

  take(now = Date.now(), cost = 1): boolean {
    this.refill(now);
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  isEmpty(now = Date.now()): boolean {
    this.refill(now);
    return this.tokens < 1;
  }

  isFull(now = Date.now()): boolean {
    this.refill(now);
    return this.tokens >= this.capacity;
  }
}

/** Un seau par clé (adresse IP) avec nettoyage périodique des seaux pleins. */
export class KeyedLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillEveryMs: number,
  ) {}

  private bucket(key: string, now: number): TokenBucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillEveryMs, now);
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  take(key: string, now = Date.now()): boolean {
    return this.bucket(key, now).take(now);
  }

  isBlocked(key: string, now = Date.now()): boolean {
    return this.buckets.get(key)?.isEmpty(now) ?? false;
  }

  prune(now = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.isFull(now)) this.buckets.delete(key);
    }
  }
}

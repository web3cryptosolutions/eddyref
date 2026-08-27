import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { config, type PlanId } from "../config.js";
import { logger } from "../utils/logger.js";

export type SubscriptionStatus = "active" | "expired";

export interface PaymentRecord {
  plan: PlanId;
  stars: number;
  telegramPaymentChargeId: string;
  paidAt: number;
}

export interface Subscription {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  plan: PlanId;
  status: SubscriptionStatus;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  payments: PaymentRecord[];
}

interface StoreFile {
  version: 1;
  subscriptions: Record<string, Subscription>;
}

const emptyStore = (): StoreFile => ({ version: 1, subscriptions: {} });

let cache: StoreFile | null = null;
let queue: Promise<void> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function ensureDir(): Promise<void> {
  await mkdir(path.dirname(config.dataPath), { recursive: true });
}

async function readStore(): Promise<StoreFile> {
  if (cache) {
    return cache;
  }

  try {
    const raw = await readFile(config.dataPath, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!parsed || parsed.version !== 1 || typeof parsed.subscriptions !== "object") {
      cache = emptyStore();
      return cache;
    }
    cache = parsed;
    return cache;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.warn("Failed to read subscription store, starting empty", error);
    }
    cache = emptyStore();
    return cache;
  }
}

async function persist(store: StoreFile): Promise<void> {
  await ensureDir();
  const tempPath = `${config.dataPath}.${process.pid}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(tempPath, config.dataPath);
  cache = store;
}

export function getSubscription(telegramId: string): Promise<Subscription | undefined> {
  return enqueue(async () => {
    const store = await readStore();
    return store.subscriptions[telegramId];
  });
}

export function upsertPayment(input: {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  plan: PlanId;
  days: number;
  stars: number;
  telegramPaymentChargeId: string;
}): Promise<Subscription> {
  return enqueue(async () => {
    const store = await readStore();
    const now = Date.now();
    const existing = store.subscriptions[input.telegramId];
    const base = existing?.status === "active" && existing.expiresAt > now ? existing.expiresAt : now;
    const subscription: Subscription = {
      telegramId: input.telegramId,
      username: input.username,
      firstName: input.firstName,
      plan: input.plan,
      status: "active",
      expiresAt: base + input.days * 24 * 60 * 60 * 1000,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      payments: [
        ...(existing?.payments ?? []),
        {
          plan: input.plan,
          stars: input.stars,
          telegramPaymentChargeId: input.telegramPaymentChargeId,
          paidAt: now,
        },
      ],
    };
    store.subscriptions[input.telegramId] = subscription;
    await persist(store);
    return subscription;
  });
}

export function expireDue(now = Date.now()): Promise<Subscription[]> {
  return enqueue(async () => {
    const store = await readStore();
    const expired: Subscription[] = [];
    for (const subscription of Object.values(store.subscriptions)) {
      if (subscription.status === "active" && subscription.expiresAt <= now) {
        subscription.status = "expired";
        subscription.updatedAt = now;
        expired.push(subscription);
      }
    }
    if (expired.length > 0) {
      await persist(store);
    }
    return expired;
  });
}

export function isActive(subscription: Subscription | undefined, now = Date.now()): boolean {
  return Boolean(subscription && subscription.status === "active" && subscription.expiresAt > now);
}

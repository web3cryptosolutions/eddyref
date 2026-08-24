import { config } from "../config.js";
import {
  asRecord,
  isValidTelegramId,
  readNumber,
  readString,
  unwrapData,
} from "../utils/formatting.js";
import { logger } from "../utils/logger.js";

const REQUEST_TIMEOUT_MS = config.httpTimeoutMs;

export class LovableApiError extends Error {
  readonly status: number;
  readonly code: "unavailable" | "timeout" | "http_error" | "invalid_request";

  constructor(
    message: string,
    status: number,
    code: "unavailable" | "timeout" | "http_error" | "invalid_request" = "http_error",
  ) {
    super(message);
    this.name = "LovableApiError";
    this.status = status;
    this.code = code;
  }
}

export interface TelegramProfilePayload {
  telegram_id: string;
  telegram_username: string | null;
  first_name: string | null;
}

export interface TelegramProfile {
  telegram_id: string;
  telegram_username: string | null;
  first_name: string | null;
  referral_code?: string | null;
}

export type ReferralStartStatus =
  | "created"
  | "already_attributed"
  | "self_referral"
  | "invalid_referral_code";

export interface ReferralStartResponse {
  status: ReferralStartStatus;
}

export interface ReferralVerifyResponse {
  ok: boolean;
}

export interface BotStats {
  referral_code: string;
  referral_url: string;
  valid_referrals: number;
  pending_referrals: number;
  invalid_referrals: number;
  rank: number | null;
  next_milestone: number | null;
}

export interface LeaderboardEntry {
  rank: number | null;
  username: string;
  valid_referrals: number;
}

export interface ContestInfo {
  firstPrize: number | null;
  secondPrize: number | null;
  thirdPrize: number | null;
  bonusWinners: number | null;
  bonusAmount: number | null;
  minReferrals: number | null;
  endsAt: string | null;
}

export interface ContestStats {
  communityMembers: number | null;
  activeReferrers: number | null;
  validInvites: number | null;
}

type HttpMethod = "GET" | "POST";

function assertTelegramId(telegramId: string): void {
  if (!isValidTelegramId(telegramId)) {
    throw new LovableApiError("Invalid Telegram ID", 400, "invalid_request");
  }
}

function joinUrl(path: string): string {
  return `${config.lovableApiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function requestJson(options: {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
}): Promise<{ status: number; data: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (options.auth !== false) {
    headers.set("Authorization", `Bearer ${config.botApiSecret}`);
  }

  try {
    const response = await fetch(joinUrl(options.path), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        logger.error(`Lovable API returned non-JSON for ${options.method ?? "GET"} ${options.path}`, {
          status: response.status,
        });
        throw new LovableApiError("Lovable API unavailable", response.status, "unavailable");
      }
    }

    return { status: response.status, data };
  } catch (error) {
    if (error instanceof LovableApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      logger.error(`Lovable API timeout for ${options.method ?? "GET"} ${options.path}`);
      throw new LovableApiError("Lovable API timeout", 408, "timeout");
    }
    logger.error(`Lovable API request failed for ${options.method ?? "GET"} ${options.path}`, error);
    throw new LovableApiError("Lovable API unavailable", 503, "unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

async function requestOk(options: {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
}): Promise<unknown> {
  const { status, data } = await requestJson(options);
  if (status < 200 || status >= 300) {
    logger.error(`Lovable API HTTP ${status} for ${options.method ?? "GET"} ${options.path}`);
    throw new LovableApiError("Lovable API unavailable", status, "http_error");
  }
  return unwrapData(data);
}

function pickRecord(...values: unknown[]): Record<string, unknown> {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length > 0) {
      return record;
    }
  }
  return {};
}

function nested(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(record[key]);
}

function collectStatusTokens(payload: unknown, httpStatus: number): string {
  const record = asRecord(unwrapData(payload));
  const errorRecord = asRecord(record.error);
  const parts = [
    record.status,
    record.state,
    record.result,
    record.code,
    record.reason,
    record.message,
    record.error,
    errorRecord.code,
    errorRecord.message,
    errorRecord.status,
    httpStatus,
  ];
  return parts
    .map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : ""))
    .join(" ")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeReferralStartStatus(payload: unknown, httpStatus: number): ReferralStartStatus {
  const token = collectStatusTokens(payload, httpStatus);

  if (
    token.includes("self_referral") ||
    token.includes("own_referral") ||
    token.includes("refer_yourself") ||
    token.includes("own_link")
  ) {
    return "self_referral";
  }
  if (
    token.includes("already_attributed") ||
    token.includes("already_referred") ||
    token.includes("already_assigned") ||
    token.includes("already_attributed_to")
  ) {
    return "already_attributed";
  }
  if (token.includes("invalid")) {
    return "invalid_referral_code";
  }
  if (
    token.includes("created") ||
    token.includes("pending") ||
    token.includes("success") ||
    httpStatus === 200 ||
    httpStatus === 201
  ) {
    return "created";
  }

  return "created";
}

function parseProfile(payload: unknown, fallback: TelegramProfilePayload): TelegramProfile {
  const record = pickRecord(unwrapData(payload), payload);
  return {
    telegram_id: readString(record.telegram_id, fallback.telegram_id) ?? fallback.telegram_id,
    telegram_username: readString(record.telegram_username, fallback.telegram_username),
    first_name: readString(record.first_name, fallback.first_name),
    referral_code: readString(record.referral_code),
  };
}

function parseStats(payload: unknown): BotStats {
  const root = pickRecord(unwrapData(payload), payload);
  const stats = pickRecord(nested(root, "stats"), nested(root, "profile"), root);
  const referralCode = readString(stats.referral_code, root.referral_code) ?? "";
  const referralUrl =
    readString(stats.referral_url, root.referral_url) ||
    (referralCode ? `https://t.me/${config.telegramBotUsername}?start=${referralCode}` : "");

  const nextMilestoneRaw = stats.next_milestone ?? root.next_milestone;
  const nextMilestone =
    typeof nextMilestoneRaw === "object"
      ? readNumber(asRecord(nextMilestoneRaw).referrals, asRecord(nextMilestoneRaw).value)
      : readNumber(nextMilestoneRaw);

  return {
    referral_code: referralCode,
    referral_url: referralUrl,
    valid_referrals: readNumber(stats.valid_referrals, root.valid_referrals, stats.referrals) ?? 0,
    pending_referrals: readNumber(stats.pending_referrals, root.pending_referrals) ?? 0,
    invalid_referrals: readNumber(stats.invalid_referrals, root.invalid_referrals) ?? 0,
    rank: readNumber(stats.rank, root.rank),
    next_milestone: nextMilestone,
  };
}

function parseLeaderboard(payload: unknown): LeaderboardEntry[] {
  const root = unwrapData(payload);
  const record = asRecord(root);
  const rowsUnknown = Array.isArray(root)
    ? root
    : record.leaderboard ?? record.rows ?? record.entries ?? record.results ?? record.items;

  if (!Array.isArray(rowsUnknown)) {
    return [];
  }

  return rowsUnknown.map((row, index) => {
    const item = asRecord(row);
    const username =
      readString(
        item.masked_username,
        item.username,
        item.telegram_username,
        item.display_name,
        item.handle,
        item.name,
      ) ?? "Anonymous";

    return {
      rank: readNumber(item.rank, item.position) ?? index + 1,
      username,
      valid_referrals:
        readNumber(item.valid_referrals, item.referrals, item.score, item.count, item.points) ?? 0,
    };
  });
}

function parseContest(payload: unknown): ContestInfo {
  const root = pickRecord(unwrapData(payload), payload);
  const prizes = pickRecord(nested(root, "prizes"), nested(root, "rewards"), root);
  const bonus = pickRecord(nested(prizes, "bonus"), nested(root, "bonus"), prizes);

  return {
    firstPrize: readNumber(prizes.first, prizes.first_prize, prizes.first_place, root.first_prize, root.first_place_sol),
    secondPrize: readNumber(
      prizes.second,
      prizes.second_prize,
      prizes.second_place,
      root.second_prize,
      root.second_place_sol,
    ),
    thirdPrize: readNumber(prizes.third, prizes.third_prize, prizes.third_place, root.third_prize, root.third_place_sol),
    bonusWinners: readNumber(
      bonus.winners,
      bonus.count,
      prizes.random_winner_count,
      prizes.randomWinnerCount,
      root.random_winner_count,
      root.bonus_winners,
    ),
    bonusAmount: readNumber(
      bonus.amount,
      bonus.prize,
      prizes.random_winner_amount,
      prizes.randomWinnerAmount,
      root.random_winner_amount,
      root.bonus_amount,
    ),
    minReferrals: readNumber(
      root.min_referrals,
      root.minimum_referrals,
      root.qualifying_referrals,
      prizes.min_referrals,
    ),
    endsAt: readString(root.ends_at, root.end_date, root.ends_on, root.endDate, root.contest_ends_at),
  };
}

function parseContestStats(payload: unknown): ContestStats {
  const root = pickRecord(unwrapData(payload), payload);
  return {
    communityMembers: readNumber(root.community_members, root.communityMembers, root.members),
    activeReferrers: readNumber(root.active_referrers, root.activeReferrers, root.referrers),
    validInvites: readNumber(root.valid_invites, root.validInvites, root.valid_referrals),
  };
}

export async function createOrGetProfile(payload: TelegramProfilePayload): Promise<TelegramProfile> {
  assertTelegramId(payload.telegram_id);
  const data = await requestOk({
    path: "/api/public/bot/profile",
    method: "POST",
    body: {
      telegram_id: payload.telegram_id,
      telegram_username: payload.telegram_username,
      first_name: payload.first_name,
    },
  });
  return parseProfile(data, payload);
}

export async function startReferral(
  telegramId: string,
  referralCode: string,
): Promise<ReferralStartResponse> {
  assertTelegramId(telegramId);
  const { status, data } = await requestJson({
    path: "/api/public/bot/referral/start",
    method: "POST",
    body: {
      telegram_id: telegramId,
      referral_code: referralCode,
    },
  });

  const normalized = normalizeReferralStartStatus(data, status);
  const isBusinessStatus =
    normalized === "already_attributed" ||
    normalized === "self_referral" ||
    normalized === "invalid_referral_code";

  if (status >= 200 && status < 300) {
    return { status: normalized };
  }

  if (isBusinessStatus && [400, 403, 404, 409, 422].includes(status)) {
    return { status: normalized };
  }

  logger.error(`Lovable referral start failed with HTTP ${status}`);
  throw new LovableApiError("Lovable API unavailable", status, "http_error");
}

export async function verifyReferral(telegramId: string, membershipValid: boolean): Promise<ReferralVerifyResponse> {
  assertTelegramId(telegramId);
  await requestOk({
    path: "/api/public/bot/referral/verify",
    method: "POST",
    body: {
      telegram_id: telegramId,
      membership_valid: membershipValid,
    },
  });
  return { ok: true };
}

export async function invalidateReferral(telegramId: string, reason?: string): Promise<void> {
  assertTelegramId(telegramId);
  await requestOk({
    path: "/api/public/bot/referral/invalidate",
    method: "POST",
    body: {
      telegram_id: telegramId,
      ...(reason ? { reason } : {}),
    },
  });
}

export async function getStats(telegramId: string): Promise<BotStats> {
  assertTelegramId(telegramId);
  const data = await requestOk({
    path: `/api/public/bot/stats/${encodeURIComponent(telegramId)}`,
    method: "GET",
  });
  return parseStats(data);
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const data = await requestOk({
    path: `/api/public/leaderboard?limit=${safeLimit}`,
    method: "GET",
    auth: false,
  });
  return parseLeaderboard(data);
}

export async function getContest(): Promise<ContestInfo> {
  const data = await requestOk({
    path: "/api/public/contest",
    method: "GET",
    auth: false,
  });
  return parseContest(data);
}

export async function getContestStats(): Promise<ContestStats> {
  const data = await requestOk({
    path: "/api/public/contest-stats",
    method: "GET",
    auth: false,
  });
  return parseContestStats(data);
}

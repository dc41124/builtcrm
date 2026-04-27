import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { withTenantUser } from "@/db/with-tenant";
import {
  authSession,
  authUser,
  userNotificationPreferences,
  users,
} from "@/db/schema";

import { AuthorizationError } from "../permissions";
import type { SessionLike } from "../context";
import {
  NOTIFICATION_GROUPS,
  defaultNotificationPrefs,
  type NotificationPrefState,
  type SettingsPortalType,
} from "@/lib/notification-catalog";
import { presignDownloadUrl } from "@/lib/storage";

export type UserProfile = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  phone: string | null;
  title: string | null;
  timezone: string;
  theme: "light" | "dark" | "system";
  density: "comfortable" | "compact";
  language: string;
  avatarUrl: string | null;
};

export type ActiveSession = {
  id: string;
  device: string;
  browser: string;
  location: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: Date;
  isCurrent: boolean;
};

export type UserSettingsView = {
  profile: UserProfile;
  avatarPreviewUrl: string | null;
  authUserId: string;
  twoFactorEnabled: boolean;
  sessions: ActiveSession[];
  notificationPrefs: NotificationPrefState;
  portalType: SettingsPortalType;
};

export async function getUserSettingsView(input: {
  session: SessionLike | null | undefined;
  sessionId?: string | null;
  portalType: SettingsPortalType;
}): Promise<UserSettingsView> {
  if (!input.session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  const appUserId = input.session.appUserId;

  const [profile] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      displayName: users.displayName,
      phone: users.phone,
      title: users.title,
      timezone: users.timezone,
      theme: users.theme,
      density: users.density,
      language: users.language,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1);
  if (!profile || !profile.isActive) {
    throw new AuthorizationError("User not found or inactive", "unauthenticated");
  }

  // Look up the Better Auth user row (keyed by email) to get 2FA status.
  const [authRow] = await db
    .select({
      id: authUser.id,
      twoFactorEnabled: authUser.twoFactorEnabled,
    })
    .from(authUser)
    .where(eq(authUser.email, profile.email))
    .limit(1);

  const authUserId = authRow?.id ?? "";
  const twoFactorEnabled = authRow?.twoFactorEnabled ?? false;

  // Active sessions for this Better Auth user.
  let sessions: ActiveSession[] = [];
  if (authUserId) {
    const rows = await db
      .select({
        id: authSession.id,
        ipAddress: authSession.ipAddress,
        userAgent: authSession.userAgent,
        updatedAt: authSession.updatedAt,
      })
      .from(authSession)
      .where(eq(authSession.userId, authUserId))
      .orderBy(desc(authSession.updatedAt));

    sessions = rows.map((r) => {
      const { device, browser } = parseUserAgent(r.userAgent);
      return {
        id: r.id,
        device,
        browser,
        location: "—",
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        lastActiveAt: r.updatedAt,
        isCurrent: input.sessionId ? r.id === input.sessionId : false,
      };
    });
  }

  // Load saved notification prefs for this user + portal, layer over defaults
  // so any new event gets its default state until explicitly toggled.
  // RLS: user_notification_preferences is user-scoped — withTenantUser sets
  // both org + user GUCs. orgId from session avoids a fallback dbAdmin path.
  const defaults = defaultNotificationPrefs(input.portalType);
  const sessionOrgId = input.session.organizationId;
  const savedRows = sessionOrgId
    ? await withTenantUser(sessionOrgId, appUserId, (tx) =>
        tx
          .select({
            eventId: userNotificationPreferences.eventId,
            email: userNotificationPreferences.email,
            inApp: userNotificationPreferences.inApp,
          })
          .from(userNotificationPreferences)
          .where(
            and(
              eq(userNotificationPreferences.userId, appUserId),
              eq(userNotificationPreferences.portalType, input.portalType),
            ),
          ),
      )
    : await dbAdmin
        .select({
          eventId: userNotificationPreferences.eventId,
          email: userNotificationPreferences.email,
          inApp: userNotificationPreferences.inApp,
        })
        .from(userNotificationPreferences)
        .where(
          and(
            eq(userNotificationPreferences.userId, appUserId),
            eq(userNotificationPreferences.portalType, input.portalType),
          ),
        );

  const notificationPrefs: NotificationPrefState = { ...defaults };
  for (const row of savedRows) {
    if (notificationPrefs[row.eventId]) {
      notificationPrefs[row.eventId] = {
        email: row.email,
        inApp: row.inApp,
      };
    }
  }

  // Generate a short-lived signed URL for the avatar so the UI can render it.
  let avatarPreviewUrl: string | null = null;
  if (profile.avatarUrl) {
    try {
      avatarPreviewUrl = await presignDownloadUrl({
        key: profile.avatarUrl,
        expiresInSeconds: 60 * 60,
      });
    } catch {
      avatarPreviewUrl = null;
    }
  }

  return {
    profile: {
      id: profile.id,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName,
      phone: profile.phone,
      title: profile.title,
      timezone: profile.timezone,
      theme: profile.theme,
      density: profile.density,
      language: profile.language,
      avatarUrl: profile.avatarUrl,
    },
    avatarPreviewUrl,
    authUserId,
    twoFactorEnabled,
    sessions,
    notificationPrefs,
    portalType: input.portalType,
  };
}

// Light-touch User-Agent parser. Good enough for the Active Sessions panel —
// we don't need perfect taxonomy, just something recognizable.
function parseUserAgent(ua: string | null): {
  device: string;
  browser: string;
} {
  if (!ua) return { device: "Unknown device", browser: "Unknown browser" };

  const lower = ua.toLowerCase();
  let device = "Desktop";
  if (/iphone/.test(lower)) device = "iPhone";
  else if (/ipad/.test(lower)) device = "iPad";
  else if (/android/.test(lower)) device = /mobile/.test(lower) ? "Android phone" : "Android tablet";
  else if (/macintosh|mac os x/.test(lower)) device = "Mac";
  else if (/windows/.test(lower)) device = "Windows PC";
  else if (/linux/.test(lower)) device = "Linux";

  let browser = "Browser";
  if (/edg\//.test(lower)) browser = "Edge";
  else if (/firefox/.test(lower)) browser = "Firefox";
  else if (/chrome\//.test(lower) && !/edg/.test(lower)) browser = "Chrome";
  else if (/safari/.test(lower) && !/chrome/.test(lower)) browser = "Safari";

  const versionMatch = lower.match(/(chrome|firefox|safari|edg)\/(\d+)/);
  if (versionMatch) browser = `${browser} ${versionMatch[2]}`;

  return { device, browser };
}

export { NOTIFICATION_GROUPS };

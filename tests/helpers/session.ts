import { IDS } from "../fixtures/seed";

// Better-auth's real session has many fields, but the app code only touches
// `.session.appUserId`. The `@/auth/config` mock in tests/setup.ts returns
// whatever we stash via __setMockSession.
type AppUserId = string;

type MockSession = { session: { appUserId: AppUserId | null } } | null;

const setMockSession = (s: MockSession): void => {
  (globalThis as unknown as { __setMockSession: (s: MockSession) => void })
    .__setMockSession(s);
};

export function asUser(userId: AppUserId): void {
  setMockSession({ session: { appUserId: userId } });
}

export function asAnon(): void {
  setMockSession(null);
}

// Shorthand helpers keyed by the fixture users — one per portal role.
export const ASSUME = {
  contractor: () => asUser(IDS.users.contractorAdmin),
  subcontractor: () => asUser(IDS.users.subcontractor),
  commercial: () => asUser(IDS.users.commercialClient),
  residential: () => asUser(IDS.users.residentialClient),
  none: () => asAnon(),
};

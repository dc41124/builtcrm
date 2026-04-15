import {
  getEffectiveContext,
  type EffectiveContext,
  type SessionLike,
} from "../context";
import { AuthorizationError } from "../permissions";

import {
  loadSelectionsForProject,
  type SelectionCategoryRow,
} from "./project-home";

export type SelectionItemStatus =
  | "draft"
  | "published"
  | "exploring"
  | "provisional"
  | "confirmed"
  | "revision_open"
  | "locked";

export type ContractorSelectionsView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  categories: SelectionCategoryRow[];
  totals: {
    totalItems: number;
    drafts: number;
    published: number;
    decided: number;
    revisionOpen: number;
    awaitingDecision: number;
    overdue: number;
    totalAllowanceCents: number;
    confirmedUpgradeCents: number;
  };
};

export type ResidentialSelectionsTotals = {
  totalItems: number;
  readyToChoose: number;
  timeSensitive: number;
  confirmed: number;
  revisionOpen: number;
  confirmedUpgradeCents: number;
};

export type ResidentialSelectionsView = {
  context: EffectiveContext;
  project: EffectiveContext["project"];
  categories: SelectionCategoryRow[];
  totals: ResidentialSelectionsTotals;
};

type LoaderInput = { session: SessionLike | null | undefined; projectId: string };

export async function getContractorSelections(
  input: LoaderInput,
): Promise<ContractorSelectionsView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (
    context.role !== "contractor_admin" &&
    context.role !== "contractor_pm"
  ) {
    throw new AuthorizationError(
      "Contractor selections view requires a contractor role",
      "forbidden",
    );
  }
  const categories = await loadSelectionsForProject(context.project.id);
  const now = Date.now();

  let drafts = 0;
  let published = 0;
  let decided = 0;
  let revisionOpen = 0;
  let awaitingDecision = 0;
  let overdue = 0;
  let totalAllowanceCents = 0;
  let confirmedUpgradeCents = 0;
  let totalItems = 0;

  for (const cat of categories) {
    for (const item of cat.items) {
      totalItems += 1;
      totalAllowanceCents += item.allowanceCents;
      if (!item.isPublished) {
        drafts += 1;
        continue;
      }
      if (item.selectionItemStatus === "revision_open") {
        revisionOpen += 1;
        awaitingDecision += 1;
      } else if (
        item.selectionItemStatus === "confirmed" ||
        item.selectionItemStatus === "locked"
      ) {
        decided += 1;
        if (item.currentDecision) {
          confirmedUpgradeCents += Math.max(
            0,
            item.currentDecision.priceDeltaCents,
          );
        }
      } else {
        published += 1;
        awaitingDecision += 1;
      }
      if (
        item.decisionDeadline &&
        item.decisionDeadline.getTime() < now &&
        item.selectionItemStatus !== "confirmed" &&
        item.selectionItemStatus !== "locked"
      ) {
        overdue += 1;
      }
    }
  }

  return {
    context,
    project: context.project,
    categories,
    totals: {
      totalItems,
      drafts,
      published,
      decided,
      revisionOpen,
      awaitingDecision,
      overdue,
      totalAllowanceCents,
      confirmedUpgradeCents,
    },
  };
}

export async function getResidentialSelections(
  input: LoaderInput,
): Promise<ResidentialSelectionsView> {
  const context = await getEffectiveContext(input.session, input.projectId);
  if (context.role !== "residential_client") {
    throw new AuthorizationError(
      "Residential selections view requires a residential client role",
      "forbidden",
    );
  }
  const categories = await loadSelectionsForProject(context.project.id, {
    publishedOnly: true,
  });

  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  let totalItems = 0;
  let readyToChoose = 0;
  let timeSensitive = 0;
  let confirmedCount = 0;
  let revisionOpen = 0;
  let confirmedUpgradeCents = 0;

  for (const cat of categories) {
    for (const item of cat.items) {
      totalItems += 1;
      const isDecided =
        item.selectionItemStatus === "confirmed" ||
        item.selectionItemStatus === "locked";
      if (item.selectionItemStatus === "revision_open") {
        revisionOpen += 1;
        readyToChoose += 1;
      } else if (isDecided) {
        confirmedCount += 1;
        if (item.currentDecision) {
          confirmedUpgradeCents += Math.max(
            0,
            item.currentDecision.priceDeltaCents,
          );
        }
      } else {
        readyToChoose += 1;
      }
      if (
        !isDecided &&
        item.decisionDeadline &&
        item.decisionDeadline.getTime() - now <= SEVEN_DAYS_MS
      ) {
        timeSensitive += 1;
      }
    }
  }

  return {
    context,
    project: context.project,
    categories,
    totals: {
      totalItems,
      readyToChoose,
      timeSensitive,
      confirmed: confirmedCount,
      revisionOpen,
      confirmedUpgradeCents,
    },
  };
}

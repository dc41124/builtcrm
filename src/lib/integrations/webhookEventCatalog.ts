// Step 57 (Phase 8-lite.1 #57) — Webhook Event Catalog.
//
// This is the canonical registry of every event BuiltCRM emits to
// outbound webhook endpoints. The catalog is the *intended* externally-
// observable subset of the audit-event surface; outbound emission code
// (when wired) drives off this list.
//
// Why a registry rather than just inferring from audit events: external
// webhook keys use dot-notation (e.g. `rfi.responded`) while internal
// audit rows store `actionName` as bare verbs (e.g. `responded`) keyed
// by `objectType`. The registry is the projection that pins the public
// contract — names, payload shapes, and delivery guarantees can evolve
// independently of internal logging.
//
// Versioning: events are tagged with `sinceVersion`. New optional
// fields can land in minor versions; renamed/removed fields bump the
// major and either ship under a new key or stay pinned via the
// endpoint's API-version setting.

export type WebhookEventCategory =
  | "projects"
  | "workflows"
  | "billing"
  | "compliance"
  | "documents";

export type WebhookEventDeliveryGuarantee = "at-least-once" | "best-effort";

export type WebhookEventDefinition = {
  key: string;
  category: WebhookEventCategory;
  description: string;
  deliveryGuarantee: WebhookEventDeliveryGuarantee;
  sinceVersion: string;
  examplePayload: Record<string, unknown>;
};

export type WebhookCategoryConfig = {
  label: string;
  color: string;
  soft: string;
  description: string;
};

export const WEBHOOK_CATEGORY_CONFIG: Record<
  WebhookEventCategory,
  WebhookCategoryConfig
> = {
  projects: {
    label: "Projects",
    color: "#5b4fc7",
    soft: "rgba(91,79,199,.1)",
    description:
      "Lifecycle of a project — creation, status changes, membership.",
  },
  workflows: {
    label: "Workflows",
    color: "#3878a8",
    soft: "rgba(56,120,168,.1)",
    description: "RFIs, change orders, approvals, and field communication.",
  },
  billing: {
    label: "Billing",
    color: "#2d8a5e",
    soft: "rgba(45,138,94,.1)",
    description: "Draws, invoices, and payment events from Stripe Connect.",
  },
  compliance: {
    label: "Compliance",
    color: "#c4700b",
    soft: "rgba(196,112,11,.1)",
    description:
      "Insurance, certifications, inspections, and expiring documents.",
  },
  documents: {
    label: "Documents",
    color: "#9c6240",
    soft: "rgba(156,98,64,.1)",
    description:
      "Uploads, supersession, sharing, transmittals, and punch items.",
  },
};

export const WEBHOOK_EVENT_CATALOG: readonly WebhookEventDefinition[] = [
  // ── PROJECTS ────────────────────────────────────────────────────────────
  {
    key: "project.created",
    category: "projects",
    description:
      "Fired when a new project is created in the system. Includes the full project record.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3K9TG7P4Z",
      type: "project.created",
      created: "2026-04-22T14:23:01.482Z",
      organizationId: "org_hammerline",
      data: {
        project: {
          id: "proj_riv_a4f2c",
          name: "Riverside Office Complex",
          status: "active",
          contractorOrgId: "org_hammerline",
          ownerOrgId: "org_riverpoint",
          startDate: "2026-04-15",
          targetCompletionDate: "2026-12-20",
          contractValueCents: 480_000_000,
          createdByUserId: "user_dc_marsh",
        },
      },
    },
  },
  {
    key: "project.status_changed",
    category: "projects",
    description:
      "Project status transitions (e.g., active → on_hold, active → completed). Includes both prior and new status.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3M1YN8QJW",
      type: "project.status_changed",
      created: "2026-04-22T14:24:11.200Z",
      organizationId: "org_hammerline",
      data: {
        projectId: "proj_riv_a4f2c",
        priorStatus: "active",
        newStatus: "on_hold",
        reason: "Owner pause — financing review",
        changedByUserId: "user_dc_marsh",
      },
    },
  },
  {
    key: "project.archived",
    category: "projects",
    description:
      "Fired when a completed project is archived. Read-only thereafter; no further events emit.",
    deliveryGuarantee: "best-effort",
    sinceVersion: "v1.1",
    examplePayload: {
      id: "evt_01HFE3N4PV0DRX",
      type: "project.archived",
      created: "2026-04-22T14:25:03.118Z",
      organizationId: "org_hammerline",
      data: {
        projectId: "proj_riv_a4f2c",
        finalContractValueCents: 498_520_000,
        completionDate: "2026-12-18",
        archivedByUserId: "user_dc_marsh",
      },
    },
  },
  {
    key: "project.member_added",
    category: "projects",
    description:
      "A new team member (internal user, sub user, or client user) is granted access to a project.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3PB2ZC5MH",
      type: "project.member_added",
      created: "2026-04-22T14:26:18.044Z",
      organizationId: "org_hammerline",
      data: {
        projectId: "proj_riv_a4f2c",
        userId: "user_jen_park",
        userOrgId: "org_steelframe",
        role: "subcontractor_field",
        addedByUserId: "user_dc_marsh",
      },
    },
  },

  // ── WORKFLOWS ───────────────────────────────────────────────────────────
  {
    key: "rfi.created",
    category: "workflows",
    description:
      "An RFI (Request for Information) is submitted by a sub or field user.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3QF4D7XGN",
      type: "rfi.created",
      created: "2026-04-22T14:27:55.991Z",
      organizationId: "org_hammerline",
      data: {
        rfi: {
          id: "rfi_019",
          number: "RFI-019",
          projectId: "proj_riv_a4f2c",
          subject: "Conduit routing conflict — east riser",
          submittedByUserId: "user_marcus_chen",
          submittedByOrgId: "org_steelframe",
          assignedToUserId: "user_dc_marsh",
          priority: "high",
          dueDate: "2026-04-25",
          attachmentIds: ["doc_abc_001", "doc_abc_002"],
        },
      },
    },
  },
  {
    key: "rfi.responded",
    category: "workflows",
    description:
      "A response is posted to an RFI. The RFI may have multiple responses; this fires per response, not on close.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3RH7N2KPZ",
      type: "rfi.responded",
      created: "2026-04-22T14:30:11.014Z",
      organizationId: "org_hammerline",
      data: {
        rfiId: "rfi_019",
        responseId: "resp_p7m4z",
        respondedByUserId: "user_dc_marsh",
        bodyMarkdown: "Routing approved per attached redline. Proceed.",
        attachmentIds: ["doc_redline_v3"],
      },
    },
  },
  {
    key: "rfi.closed",
    category: "workflows",
    description: "An RFI is marked closed. No further responses accepted.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3SJ1B5VWE",
      type: "rfi.closed",
      created: "2026-04-22T14:32:40.337Z",
      organizationId: "org_hammerline",
      data: {
        rfiId: "rfi_019",
        closedByUserId: "user_dc_marsh",
        resolution: "Resolved",
        durationHours: 4.7,
      },
    },
  },
  {
    key: "co.submitted",
    category: "workflows",
    description:
      "A change order is submitted by the contractor to the owner for approval.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3TN8KB9VF",
      type: "co.submitted",
      created: "2026-04-22T14:35:17.752Z",
      organizationId: "org_hammerline",
      data: {
        changeOrder: {
          id: "co_007",
          number: "CO-007",
          projectId: "proj_riv_a4f2c",
          title: "Additional fireproofing — east stair",
          amountCents: 1_845_000,
          scheduleImpactDays: 2,
          submittedToOrgId: "org_riverpoint",
          submittedByUserId: "user_dc_marsh",
        },
      },
    },
  },
  {
    key: "co.approved",
    category: "workflows",
    description:
      "Owner approves a change order. Triggers re-baselining of contract value and schedule.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3VR4M2X8K",
      type: "co.approved",
      created: "2026-04-22T14:38:02.011Z",
      organizationId: "org_hammerline",
      data: {
        changeOrderId: "co_007",
        approvedByUserId: "user_owner_rivp",
        approvedAt: "2026-04-22T14:38:01Z",
        newContractValueCents: 481_845_000,
        newCompletionDate: "2026-12-22",
      },
    },
  },
  {
    key: "co.rejected",
    category: "workflows",
    description:
      "Owner rejects a change order with a reason. Contractor may revise and resubmit.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE3WT9Q4HCD",
      type: "co.rejected",
      created: "2026-04-22T14:40:18.633Z",
      organizationId: "org_hammerline",
      data: {
        changeOrderId: "co_007",
        rejectedByUserId: "user_owner_rivp",
        reason:
          "Scope already covered under base contract Section 7.2. Please review.",
        canResubmit: true,
      },
    },
  },
  {
    key: "approval.requested",
    category: "workflows",
    description:
      "Generic approval requested — submittals, shop drawings, RFP responses. The 'kind' field disambiguates.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.1",
    examplePayload: {
      id: "evt_01HFE3XV2D5JNB",
      type: "approval.requested",
      created: "2026-04-22T14:42:09.218Z",
      organizationId: "org_hammerline",
      data: {
        approvalId: "apv_4mn7p",
        kind: "submittal",
        title: "Structural steel — shop drawings rev B",
        projectId: "proj_riv_a4f2c",
        requestedByUserId: "user_marcus_chen",
        approverUserIds: ["user_dc_marsh", "user_eng_lead"],
      },
    },
  },
  {
    key: "approval.approved",
    category: "workflows",
    description:
      "An approval is granted. For multi-approver flows, fires once when all required approvers have signed off.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.1",
    examplePayload: {
      id: "evt_01HFE3YX5G7KQR",
      type: "approval.approved",
      created: "2026-04-22T15:01:33.092Z",
      organizationId: "org_hammerline",
      data: {
        approvalId: "apv_4mn7p",
        approvedByUserIds: ["user_dc_marsh", "user_eng_lead"],
        finalApprovalAt: "2026-04-22T15:01:32Z",
      },
    },
  },

  // ── BILLING ─────────────────────────────────────────────────────────────
  {
    key: "draw.submitted",
    category: "billing",
    description:
      "A pay application (draw request) is submitted by the contractor for owner review. Includes line items and supporting docs.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE401D8M9SC",
      type: "draw.submitted",
      created: "2026-04-22T15:10:44.501Z",
      organizationId: "org_hammerline",
      data: {
        draw: {
          id: "draw_2026_04",
          number: "Draw #4",
          projectId: "proj_riv_a4f2c",
          periodStart: "2026-04-01",
          periodEnd: "2026-04-30",
          requestedAmountCents: 48_230_000,
          retainagePercent: 10,
          netRequestedCents: 43_407_000,
          lineItemCount: 14,
        },
      },
    },
  },
  {
    key: "draw.approved",
    category: "billing",
    description:
      "Draw approved by owner. Locked from edits. Awaits payment processing.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE423G2N5DT",
      type: "draw.approved",
      created: "2026-04-22T16:48:21.116Z",
      organizationId: "org_hammerline",
      data: {
        drawId: "draw_2026_04",
        approvedByUserId: "user_owner_rivp",
        approvedAmountCents: 48_230_000,
        adjustmentNotes: null,
      },
    },
  },
  {
    key: "draw.paid",
    category: "billing",
    description:
      "Stripe Connect transfer completes. Funds are en route to the contractor's connected account.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE434K9R7BX",
      type: "draw.paid",
      created: "2026-04-23T09:15:02.878Z",
      organizationId: "org_hammerline",
      data: {
        drawId: "draw_2026_04",
        amountPaidCents: 43_407_000,
        retainageHeldCents: 4_823_000,
        stripeTransferId: "tr_1OZKpQ2eZvKYlo2C",
        paymentMethod: "ach",
      },
    },
  },
  {
    key: "invoice.sent",
    category: "billing",
    description:
      "Standalone invoice (outside the draw flow) issued to a client. Used for retainers, deposits, and one-off charges.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE445N4T8WY",
      type: "invoice.sent",
      created: "2026-04-23T10:42:55.302Z",
      organizationId: "org_hammerline",
      data: {
        invoiceId: "inv_2026_018",
        invoiceNumber: "INV-2026-018",
        amountCents: 1_250_000,
        recipientOrgId: "org_riverpoint",
        dueDate: "2026-05-23",
      },
    },
  },
  {
    key: "payment.received",
    category: "billing",
    description:
      "Inbound payment received via Stripe — could be a draw, invoice, or deposit. Reconciled against the source.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE45QR1B6FH",
      type: "payment.received",
      created: "2026-04-23T11:18:20.008Z",
      organizationId: "org_hammerline",
      data: {
        paymentId: "pmt_05N2x",
        amountCents: 43_407_000,
        sourceType: "draw",
        sourceId: "draw_2026_04",
        stripePaymentIntentId: "pi_3OZL2K2eZvKYlo2C",
      },
    },
  },
  {
    key: "payment.failed",
    category: "billing",
    description:
      "Inbound payment failed. Includes Stripe failure code for triage. Owner is notified to update payment method.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE46TV5C3JM",
      type: "payment.failed",
      created: "2026-04-23T11:20:14.892Z",
      organizationId: "org_hammerline",
      data: {
        paymentId: "pmt_05N3x",
        amountCents: 1_250_000,
        sourceType: "invoice",
        sourceId: "inv_2026_018",
        stripeFailureCode: "insufficient_funds",
        stripeFailureMessage: "Your card has insufficient funds.",
        retryScheduledAt: "2026-04-26T11:20:00Z",
      },
    },
  },

  // ── COMPLIANCE ──────────────────────────────────────────────────────────
  {
    key: "compliance.uploaded",
    category: "compliance",
    description:
      "A subcontractor uploads or updates a compliance document (insurance certificate, license, safety plan).",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE47XB6D4KN",
      type: "compliance.uploaded",
      created: "2026-04-23T13:05:41.337Z",
      organizationId: "org_hammerline",
      data: {
        complianceDocId: "cd_84n2p",
        kind: "general_liability_certificate",
        subOrgId: "org_steelframe",
        expiresAt: "2027-04-15",
        uploadedByUserId: "user_marcus_chen",
        documentId: "doc_gl_2026",
      },
    },
  },
  {
    key: "compliance.expiring",
    category: "compliance",
    description:
      "Fires 30 / 14 / 7 / 1 days before a compliance document expires. The 'daysUntilExpiry' field disambiguates.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE48Z1G8R5PK",
      type: "compliance.expiring",
      created: "2026-04-23T08:00:00.000Z",
      organizationId: "org_hammerline",
      data: {
        complianceDocId: "cd_71q8m",
        kind: "workers_comp_certificate",
        subOrgId: "org_steelframe",
        expiresAt: "2026-05-07",
        daysUntilExpiry: 14,
        affectedProjectIds: ["proj_riv_a4f2c", "proj_we_med"],
      },
    },
  },
  {
    key: "compliance.expired",
    category: "compliance",
    description:
      "Compliance document has officially expired. Sub is auto-flagged as non-compliant; project access may be restricted.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE493D2H6QL",
      type: "compliance.expired",
      created: "2026-04-23T08:00:01.000Z",
      organizationId: "org_hammerline",
      data: {
        complianceDocId: "cd_22r5x",
        kind: "general_liability_certificate",
        subOrgId: "org_eastcoast_drywall",
        expiredAt: "2026-04-23",
        autoBlockEnabled: true,
      },
    },
  },
  {
    key: "inspection.completed",
    category: "compliance",
    description:
      "An inspection (internal QA, third-party, or AHJ) is logged with pass/fail and any deficiency items.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.1",
    examplePayload: {
      id: "evt_01HFE4A65KJ8R7",
      type: "inspection.completed",
      created: "2026-04-23T15:30:18.554Z",
      organizationId: "org_hammerline",
      data: {
        inspectionId: "ins_p4m9z",
        kind: "framing_inspection",
        projectId: "proj_riv_a4f2c",
        passed: true,
        deficiencyCount: 2,
        inspectorName: "City of St. John's — Building Dept.",
        inspectorOrgType: "ahj",
        completedByUserId: "user_dc_marsh",
      },
    },
  },

  // ── DOCUMENTS ───────────────────────────────────────────────────────────
  {
    key: "document.uploaded",
    category: "documents",
    description:
      "Any document upload — drawings, photos, specs, contracts. Includes the storage URL and SHA-256 hash for verification.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE4B85MQ4XS",
      type: "document.uploaded",
      created: "2026-04-23T16:01:22.910Z",
      organizationId: "org_hammerline",
      data: {
        documentId: "doc_a1b2c3d4",
        projectId: "proj_riv_a4f2c",
        category: "drawings",
        filename: "RIV-A201-Rev-C.pdf",
        sizeBytes: 4_281_904,
        sha256:
          "a1f3c8d2b9e54f7a8c3b9e54f7a8c3b9e54f7a8c3b9e54f7a8c3b9e54f7a8c3b",
        storageUrl:
          "https://files.builtcrm.app/proj_riv_a4f2c/drawings/doc_a1b2c3d4.pdf",
        uploadedByUserId: "user_dc_marsh",
      },
    },
  },
  {
    key: "document.superseded",
    category: "documents",
    description:
      "A new revision replaces an older document. Both IDs are included for traceability.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE4CC9R7TVY",
      type: "document.superseded",
      created: "2026-04-23T16:14:08.213Z",
      organizationId: "org_hammerline",
      data: {
        priorDocumentId: "doc_a1b2c3d4",
        priorRevision: "Rev B",
        newDocumentId: "doc_z9y8x7w6",
        newRevision: "Rev C",
        reason: "Updated per RFI-019",
      },
    },
  },
  {
    key: "document.shared",
    category: "documents",
    description:
      "Document explicitly shared with an external party (sub, client, or third-party reviewer) via a secure link.",
    deliveryGuarantee: "best-effort",
    sinceVersion: "v1.1",
    examplePayload: {
      id: "evt_01HFE4DF2T4WBC",
      type: "document.shared",
      created: "2026-04-23T16:22:55.107Z",
      organizationId: "org_hammerline",
      data: {
        documentId: "doc_z9y8x7w6",
        sharedWithEmail: "consultant@arch.example.com",
        accessExpiresAt: "2026-05-23T16:22:55Z",
        sharedByUserId: "user_dc_marsh",
      },
    },
  },
  {
    key: "transmittal.sent",
    category: "documents",
    description:
      "Formal transmittal letter dispatched to one or more recipients. Always coupled with one or more attached documents.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE4EH7V8XCD",
      type: "transmittal.sent",
      created: "2026-04-23T17:08:19.488Z",
      organizationId: "org_hammerline",
      data: {
        transmittalId: "txm_009",
        number: "TXM-009",
        projectId: "proj_riv_a4f2c",
        subject: "Issued for Construction — east stair drawings",
        recipientOrgIds: ["org_steelframe", "org_eastcoast_drywall"],
        documentIds: ["doc_z9y8x7w6", "doc_redline_v3"],
        sentByUserId: "user_dc_marsh",
      },
    },
  },
  {
    key: "selection.locked",
    category: "documents",
    description:
      "Residential client locks a finish selection (countertop, paint, etc.). Triggers procurement workflows downstream.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE4FK1Y0ZRF",
      type: "selection.locked",
      created: "2026-04-23T18:45:33.621Z",
      organizationId: "org_hammerline",
      data: {
        selectionId: "sel_kit_counter",
        projectId: "proj_kemp_res",
        category: "countertops",
        choice: "Calacatta Quartz, Caesarstone 5141",
        priceCents: 840_000,
        lockedByUserId: "user_kemp_owner",
        lockExpiresAt: null,
      },
    },
  },
  {
    key: "punch.item_created",
    category: "documents",
    description:
      "A punch list item is logged on a project, typically during walkthroughs at substantial completion.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.1",
    examplePayload: {
      id: "evt_01HFE4GM4B2DTH",
      type: "punch.item_created",
      created: "2026-04-23T19:02:11.054Z",
      organizationId: "org_hammerline",
      data: {
        punchItemId: "pun_044",
        projectId: "proj_riv_a4f2c",
        location: "Floor 3, Suite 304 — north wall",
        description: "Drywall scuff at outlet — repaint required",
        assignedToOrgId: "org_eastcoast_drywall",
        priority: "low",
        createdByUserId: "user_dc_marsh",
        photoIds: ["doc_punch_044_a", "doc_punch_044_b"],
      },
    },
  },
];

// Convenience aggregators — used by the catalog UI and (eventually) by
// the OpenAPI generator that drives "Download YAML" on the page.

export function listEventsByCategory(
  category: WebhookEventCategory,
): WebhookEventDefinition[] {
  return WEBHOOK_EVENT_CATALOG.filter((e) => e.category === category);
}

export function getEventDefinition(
  key: string,
): WebhookEventDefinition | undefined {
  return WEBHOOK_EVENT_CATALOG.find((e) => e.key === key);
}

export const WEBHOOK_EVENT_CATALOG_VERSION = "v1.1";

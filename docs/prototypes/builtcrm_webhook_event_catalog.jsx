// ═══════════════════════════════════════════════════════════════════════════
//  BuiltCRM — Step 57 (Phase 8-lite.1 #57): Webhook Event Catalog Page
//  ────────────────────────────────────────────────────────────────────────
//  Contractor-only docs page listing every outbound webhook event with
//  payload schemas, examples, copy-to-clipboard, and signature verification
//  guidance. Stripe-like developer documentation aesthetic.
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect } from "react";

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;540;560;600;620;640;660;680;700;720;740;760;780;800;820&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap";

// ─── DEMO CONTEXT ───────────────────────────────────────────────────────────
const orgName = "Hammerline Build";
const orgSlug = "hammerline";

// ─── CATEGORY DEFINITIONS ───────────────────────────────────────────────────
const categoryConfig = {
  projects:   { label: "Projects",   color: "#5b4fc7", soft: "rgba(91,79,199,.1)",  desc: "Lifecycle of a project — creation, status changes, membership."},
  workflows:  { label: "Workflows",  color: "#3878a8", soft: "rgba(56,120,168,.1)", desc: "RFIs, change orders, approvals, and field communication." },
  billing:    { label: "Billing",    color: "#2d8a5e", soft: "rgba(45,138,94,.1)",  desc: "Draws, invoices, and payment events from Stripe Connect." },
  compliance: { label: "Compliance", color: "#c4700b", soft: "rgba(196,112,11,.1)", desc: "Insurance, certifications, inspections, and expiring documents." },
  documents:  { label: "Documents",  color: "#9c6240", soft: "rgba(156,98,64,.1)",  desc: "Uploads, supersession, sharing, transmittals, and punch items." },
};

// ─── WEBHOOK EVENT CATALOG ──────────────────────────────────────────────────
// Each event ships with: key, category, description, examplePayload, deliveryGuarantee, sinceVersion
const eventCatalog = [
  // ── PROJECTS ────────────────────────────────────────────────────────────
  {
    key: "project.created",
    category: "projects",
    description: "Fired when a new project is created in the system. Includes the full project record.",
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
          contractValueCents: 4800000_00,
          createdByUserId: "user_dc_marsh"
        }
      }
    }
  },
  {
    key: "project.status_changed",
    category: "projects",
    description: "Project status transitions (e.g., active → on_hold, active → completed). Includes both prior and new status.",
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
        changedByUserId: "user_dc_marsh"
      }
    }
  },
  {
    key: "project.archived",
    category: "projects",
    description: "Fired when a completed project is archived. Read-only thereafter; no further events emit.",
    deliveryGuarantee: "best-effort",
    sinceVersion: "v1.1",
    examplePayload: {
      id: "evt_01HFE3N4PV0DRX",
      type: "project.archived",
      created: "2026-04-22T14:25:03.118Z",
      organizationId: "org_hammerline",
      data: {
        projectId: "proj_riv_a4f2c",
        finalContractValueCents: 4985200_00,
        completionDate: "2026-12-18",
        archivedByUserId: "user_dc_marsh"
      }
    }
  },
  {
    key: "project.member_added",
    category: "projects",
    description: "A new team member (internal user, sub user, or client user) is granted access to a project.",
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
        addedByUserId: "user_dc_marsh"
      }
    }
  },

  // ── WORKFLOWS ───────────────────────────────────────────────────────────
  {
    key: "rfi.created",
    category: "workflows",
    description: "An RFI (Request for Information) is submitted by a sub or field user.",
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
          attachmentIds: ["doc_abc_001", "doc_abc_002"]
        }
      }
    }
  },
  {
    key: "rfi.responded",
    category: "workflows",
    description: "A response is posted to an RFI. The RFI may have multiple responses; this fires per response, not on close.",
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
        attachmentIds: ["doc_redline_v3"]
      }
    }
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
        durationHours: 4.7
      }
    }
  },
  {
    key: "co.submitted",
    category: "workflows",
    description: "A change order is submitted by the contractor to the owner for approval.",
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
          amountCents: 18450_00,
          scheduleImpactDays: 2,
          submittedToOrgId: "org_riverpoint",
          submittedByUserId: "user_dc_marsh"
        }
      }
    }
  },
  {
    key: "co.approved",
    category: "workflows",
    description: "Owner approves a change order. Triggers re-baselining of contract value and schedule.",
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
        newContractValueCents: 4818450_00,
        newCompletionDate: "2026-12-22"
      }
    }
  },
  {
    key: "co.rejected",
    category: "workflows",
    description: "Owner rejects a change order with a reason. Contractor may revise and resubmit.",
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
        reason: "Scope already covered under base contract Section 7.2. Please review.",
        canResubmit: true
      }
    }
  },
  {
    key: "approval.requested",
    category: "workflows",
    description: "Generic approval requested — submittals, shop drawings, RFP responses. The 'kind' field disambiguates.",
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
        approverUserIds: ["user_dc_marsh", "user_eng_lead"]
      }
    }
  },
  {
    key: "approval.approved",
    category: "workflows",
    description: "An approval is granted. For multi-approver flows, fires once when all required approvers have signed off.",
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
        finalApprovalAt: "2026-04-22T15:01:32Z"
      }
    }
  },

  // ── BILLING ─────────────────────────────────────────────────────────────
  {
    key: "draw.submitted",
    category: "billing",
    description: "A pay application (draw request) is submitted by the contractor for owner review. Includes line items and supporting docs.",
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
          requestedAmountCents: 482300_00,
          retainagePercent: 10,
          netRequestedCents: 434070_00,
          lineItemCount: 14
        }
      }
    }
  },
  {
    key: "draw.approved",
    category: "billing",
    description: "Draw approved by owner. Locked from edits. Awaits payment processing.",
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
        approvedAmountCents: 482300_00,
        adjustmentNotes: null
      }
    }
  },
  {
    key: "draw.paid",
    category: "billing",
    description: "Stripe Connect transfer completes. Funds are en route to the contractor's connected account.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE434K9R7BX",
      type: "draw.paid",
      created: "2026-04-23T09:15:02.878Z",
      organizationId: "org_hammerline",
      data: {
        drawId: "draw_2026_04",
        amountPaidCents: 434070_00,
        retainageHeldCents: 48230_00,
        stripeTransferId: "tr_1OZKpQ2eZvKYlo2C",
        paymentMethod: "ach"
      }
    }
  },
  {
    key: "invoice.sent",
    category: "billing",
    description: "Standalone invoice (outside the draw flow) issued to a client. Used for retainers, deposits, and one-off charges.",
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
        amountCents: 12500_00,
        recipientOrgId: "org_riverpoint",
        dueDate: "2026-05-23"
      }
    }
  },
  {
    key: "payment.received",
    category: "billing",
    description: "Inbound payment received via Stripe — could be a draw, invoice, or deposit. Reconciled against the source.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE45QR1B6FH",
      type: "payment.received",
      created: "2026-04-23T11:18:20.008Z",
      organizationId: "org_hammerline",
      data: {
        paymentId: "pmt_05N2x",
        amountCents: 434070_00,
        sourceType: "draw",
        sourceId: "draw_2026_04",
        stripePaymentIntentId: "pi_3OZL2K2eZvKYlo2C"
      }
    }
  },
  {
    key: "payment.failed",
    category: "billing",
    description: "Inbound payment failed. Includes Stripe failure code for triage. Owner is notified to update payment method.",
    deliveryGuarantee: "at-least-once",
    sinceVersion: "v1.0",
    examplePayload: {
      id: "evt_01HFE46TV5C3JM",
      type: "payment.failed",
      created: "2026-04-23T11:20:14.892Z",
      organizationId: "org_hammerline",
      data: {
        paymentId: "pmt_05N3x",
        amountCents: 12500_00,
        sourceType: "invoice",
        sourceId: "inv_2026_018",
        stripeFailureCode: "insufficient_funds",
        stripeFailureMessage: "Your card has insufficient funds.",
        retryScheduledAt: "2026-04-26T11:20:00Z"
      }
    }
  },

  // ── COMPLIANCE ──────────────────────────────────────────────────────────
  {
    key: "compliance.uploaded",
    category: "compliance",
    description: "A subcontractor uploads or updates a compliance document (insurance certificate, license, safety plan).",
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
        documentId: "doc_gl_2026"
      }
    }
  },
  {
    key: "compliance.expiring",
    category: "compliance",
    description: "Fires 30 / 14 / 7 / 1 days before a compliance document expires. The 'daysUntilExpiry' field disambiguates.",
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
        affectedProjectIds: ["proj_riv_a4f2c", "proj_we_med"]
      }
    }
  },
  {
    key: "compliance.expired",
    category: "compliance",
    description: "Compliance document has officially expired. Sub is auto-flagged as non-compliant; project access may be restricted.",
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
        autoBlockEnabled: true
      }
    }
  },
  {
    key: "inspection.completed",
    category: "compliance",
    description: "An inspection (internal QA, third-party, or AHJ) is logged with pass/fail and any deficiency items.",
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
        completedByUserId: "user_dc_marsh"
      }
    }
  },

  // ── DOCUMENTS ───────────────────────────────────────────────────────────
  {
    key: "document.uploaded",
    category: "documents",
    description: "Any document upload — drawings, photos, specs, contracts. Includes the storage URL and SHA-256 hash for verification.",
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
        sha256: "a1f3c8d2b9e54f7a8c3b9e54f7a8c3b9e54f7a8c3b9e54f7a8c3b9e54f7a8c3b",
        storageUrl: "https://files.builtcrm.app/proj_riv_a4f2c/drawings/doc_a1b2c3d4.pdf",
        uploadedByUserId: "user_dc_marsh"
      }
    }
  },
  {
    key: "document.superseded",
    category: "documents",
    description: "A new revision replaces an older document. Both IDs are included for traceability.",
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
        reason: "Updated per RFI-019"
      }
    }
  },
  {
    key: "document.shared",
    category: "documents",
    description: "Document explicitly shared with an external party (sub, client, or third-party reviewer) via a secure link.",
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
        sharedByUserId: "user_dc_marsh"
      }
    }
  },
  {
    key: "transmittal.sent",
    category: "documents",
    description: "Formal transmittal letter dispatched to one or more recipients. Always coupled with one or more attached documents.",
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
        sentByUserId: "user_dc_marsh"
      }
    }
  },
  {
    key: "selection.locked",
    category: "documents",
    description: "Residential client locks a finish selection (countertop, paint, etc.). Triggers procurement workflows downstream.",
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
        priceCents: 8400_00,
        lockedByUserId: "user_kemp_owner",
        lockExpiresAt: null
      }
    }
  },
  {
    key: "punch.item_created",
    category: "documents",
    description: "A punch list item is logged on a project, typically during walkthroughs at substantial completion.",
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
        photoIds: ["doc_punch_044_a", "doc_punch_044_b"]
      }
    }
  },
];

// ─── ICONS ──────────────────────────────────────────────────────────────────
const I = {
  search:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  copy:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  check:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  chevD:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  chevR:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  download:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  send:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  webhook:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.43-2.22-.26-3.07A4 4 0 0 1 17 6c0 .67-.18 1.34-.49 1.93"/><path d="m12 17 5.99 0c1.1 0 1.95.94 2.48 1.9A4 4 0 1 1 22 17c-.01-.7-.2-1.4-.57-2"/></svg>,
  key:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>,
  shield:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  bell:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  settings:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  building:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/></svg>,
  workflow:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9"/><path d="M12 13v2"/></svg>,
  dollar:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  badge:     <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/><path d="M16 14v8l-4-3-4 3v-8"/></svg>,
  doc:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  sun:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>,
  moon:      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
  external:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  info:      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  terminal:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
  expand:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  collapse:  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
  filter:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
};

const categoryIconFor = (cat) => ({
  projects:   I.building,
  workflows:  I.workflow,
  billing:    I.dollar,
  compliance: I.badge,
  documents:  I.doc,
})[cat];

// ─── LOGO ───────────────────────────────────────────────────────────────────
function LogoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
      <rect x="2"  y="2"  width="13" height="13" rx="2.5" fill="#3d6b8e" />
      <rect x="17" y="2"  width="13" height="13" rx="2.5" fill="#5b4fc7" opacity=".88" />
      <rect x="2"  y="17" width="13" height="13" rx="2.5" fill="#9c6240" opacity=".82" />
      <rect x="17" y="17" width="13" height="13" rx="2.5" fill="#2d8a5e" opacity=".75" />
    </svg>
  );
}

// ─── JSON VIEWER (syntax-highlighted) ───────────────────────────────────────
// Recursively renders an object as colored, indented JSON (no innerHTML).
function JsonNode({ value, indent = 0, isLast = true, keyName = null }) {
  const pad = " ".repeat(indent * 2);
  const trail = isLast ? "" : ",";

  const renderKey = keyName !== null && (
    <>
      <span className="wec-json-key">"{keyName}"</span>
      <span className="wec-json-punct">: </span>
    </>
  );

  if (value === null) {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>{renderKey}<span className="wec-json-null">null</span><span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  if (typeof value === "boolean") {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>{renderKey}<span className="wec-json-bool">{String(value)}</span><span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  if (typeof value === "number") {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>{renderKey}<span className="wec-json-num">{value}</span><span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  if (typeof value === "string") {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>{renderKey}<span className="wec-json-str">"{value}"</span><span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="wec-json-line">
          <span className="wec-json-pad">{pad}</span>{renderKey}<span className="wec-json-punct">[]</span><span className="wec-json-punct">{trail}</span>
        </div>
      );
    }
    return (
      <>
        <div className="wec-json-line">
          <span className="wec-json-pad">{pad}</span>{renderKey}<span className="wec-json-punct">[</span>
        </div>
        {value.map((v, i) => (
          <JsonNode key={i} value={v} indent={indent + 1} isLast={i === value.length - 1} />
        ))}
        <div className="wec-json-line">
          <span className="wec-json-pad">{pad}</span><span className="wec-json-punct">]</span><span className="wec-json-punct">{trail}</span>
        </div>
      </>
    );
  }
  // object
  const keys = Object.keys(value);
  if (keys.length === 0) {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>{renderKey}<span className="wec-json-punct">{"{}"}</span><span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  return (
    <>
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>{renderKey}<span className="wec-json-punct">{"{"}</span>
      </div>
      {keys.map((k, i) => (
        <JsonNode key={k} value={value[k]} indent={indent + 1} isLast={i === keys.length - 1} keyName={k} />
      ))}
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span><span className="wec-json-punct">{"}"}</span><span className="wec-json-punct">{trail}</span>
      </div>
    </>
  );
}

function DeliveryBadge({ kind }) {
  const isAtLeast = kind === "at-least-once";
  return (
    <span className={`wec-delivery-badge${isAtLeast ? " atleast" : " besteffort"}`}>
      <span className="wec-delivery-dot" />
      {isAtLeast ? "at-least-once" : "best-effort"}
    </span>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function WebhookCatalogModule() {
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [expanded, setExpanded] = useState(new Set()); // event keys
  const [copiedKey, setCopiedKey] = useState(null);    // for showing toast/check
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState(null); // for sidebar TOC active state

  // Group events by category, applying filters
  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return eventCatalog.filter(e => {
      if (filterCategory !== "all" && e.category !== filterCategory) return false;
      if (q && !(e.key.includes(q) || e.description.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [search, filterCategory]);

  const grouped = useMemo(() => {
    const out = {};
    Object.keys(categoryConfig).forEach(c => { out[c] = []; });
    filteredEvents.forEach(e => out[e.category].push(e));
    return out;
  }, [filteredEvents]);

  const totalEvents = eventCatalog.length;
  const atLeastOnceCount = eventCatalog.filter(e => e.deliveryGuarantee === "at-least-once").length;
  const bestEffortCount  = eventCatalog.filter(e => e.deliveryGuarantee === "best-effort").length;
  const allCategories    = Object.keys(categoryConfig);

  // Actions
  const toggleExpand = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const expandAll = () => setExpanded(new Set(filteredEvents.map(e => e.key)));
  const collapseAll = () => setExpanded(new Set());

  // Mock copy — claudable artifact env doesn't reliably allow clipboard, but we visually confirm
  const copyText = async (key, text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (e) { /* no-op for sandbox */ }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1600);
  };

  const jumpToCategory = (cat) => {
    setActiveAnchor(cat);
    const el = document.getElementById(`wec-cat-${cat}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setActiveAnchor(null), 1500);
  };

  // ─── CSS ──────────────────────────────────────────────────────────────────
  const css = `
:root{
  --accent:#5b4fc7;
  --accent-deep:#4538a3;
  --accent-soft:rgba(91,79,199,.1);
  --ok:#2d8a5e; --ok-soft:rgba(45,138,94,.11);
  --wr:#c4700b; --wr-soft:rgba(196,112,11,.11);
  --er:#c93b3b; --er-soft:rgba(201,59,59,.11);
  --info:#3878a8; --info-soft:rgba(56,120,168,.1);
  --bg:#f9f8f5;
  --surface-1:#ffffff;
  --surface-2:#f4f2ed;
  --surface-3:#ece9e2;
  --surface-hover:#f7f5f0;
  --border:#e4e0d6;
  --border-strong:#d6d1c4;
  --text-primary:#1f1d1a;
  --text-secondary:#5a5852;
  --text-tertiary:#8a8884;
  --shadow-sm:0 1px 2px rgba(20,18,14,.04);
  --shadow-md:0 4px 12px rgba(20,18,14,.06);
  --shadow-lg:0 14px 38px rgba(20,18,14,.13);
  /* JSON syntax */
  --code-bg:#1a1814;
  --code-fg:#e8e5dd;
  --code-key:#a99cf5;        /* purple-ish */
  --code-str:#9bd1a3;        /* green */
  --code-num:#f0c987;        /* yellow */
  --code-bool:#e89a8c;       /* coral */
  --code-null:#8a8884;       /* gray */
  --code-punct:#aca9a1;
}
.wec-dark{
  --bg:#1a1814;
  --surface-1:#221f1a;
  --surface-2:#1f1c17;
  --surface-3:#2a2620;
  --surface-hover:#27241e;
  --border:#34302a;
  --border-strong:#403b33;
  --text-primary:#f0ede4;
  --text-secondary:#aca9a1;
  --text-tertiary:#7a766f;
  --accent-soft:rgba(124,114,212,.18);
  --code-bg:#0f0e0c;
}
.wec-root{font-family:'Instrument Sans',sans-serif;color:var(--text-primary);background:var(--bg);min-height:100vh;letter-spacing:-.005em}
.wec-root *{box-sizing:border-box}
.wec-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

/* ── TOPBAR ──────────────────────────────────────── */
.wec-topbar{height:56px;background:var(--surface-1);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 22px;gap:18px;position:sticky;top:0;z-index:30}
.wec-topbar-left{display:flex;align-items:center;gap:18px;flex:1;min-width:0}
.wec-brand{display:flex;align-items:center;gap:8px;font-family:'DM Sans',sans-serif;font-weight:760;font-size:15px;letter-spacing:-.01em}
.wec-crumbs{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-weight:540;flex-wrap:wrap}
.wec-crumbs strong{color:var(--text-primary);font-weight:700}
.wec-crumbs-sep{color:var(--text-tertiary);font-size:11px}
.wec-topbar-right{display:flex;align-items:center;gap:8px}
.wec-icon-btn{width:34px;height:34px;border-radius:8px;display:grid;place-items:center;color:var(--text-secondary);transition:all .15s}
.wec-icon-btn:hover{background:var(--surface-2);color:var(--text-primary)}
.wec-avatar{width:30px;height:30px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;font-family:'DM Sans',sans-serif;font-weight:680;font-size:11.5px}

/* ── SHELL ───────────────────────────────────────── */
.wec-shell{display:flex;min-height:calc(100vh - 56px)}
.wec-sidebar{width:248px;background:var(--surface-1);border-right:1px solid var(--border);padding:18px 14px;flex-shrink:0;position:sticky;top:56px;align-self:flex-start;height:calc(100vh - 56px);overflow-y:auto}
.wec-sb-section{font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:720;padding:12px 10px 6px}
.wec-sb-item{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:8px;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;font-weight:560;color:var(--text-secondary);transition:all .12s;letter-spacing:-.005em}
.wec-sb-item:hover{background:var(--surface-2);color:var(--text-primary)}
.wec-sb-item.active{background:var(--accent-soft);color:var(--accent);font-weight:660}
.wec-sb-item.active svg{color:var(--accent)}
.wec-sb-item svg{flex-shrink:0;color:var(--text-tertiary)}
.wec-sb-sub{padding-left:22px;display:flex;flex-direction:column;gap:1px;margin-bottom:4px}
.wec-sb-sub-item{display:flex;align-items:center;justify-content:space-between;padding:7px 11px;border-radius:6px;cursor:pointer;font-size:12.5px;font-family:'DM Sans',sans-serif;font-weight:540;color:var(--text-secondary);transition:all .12s}
.wec-sb-sub-item:hover{background:var(--surface-2);color:var(--text-primary)}
.wec-sb-sub-item.active{background:var(--accent-soft);color:var(--accent);font-weight:660}
.wec-sb-sub-item .wec-cnt{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);font-weight:540}
.wec-sb-sub-item.active .wec-cnt{color:var(--accent)}

/* ── MAIN ─────────────────────────────────────────── */
.wec-main{flex:1;min-width:0;padding:24px 32px 60px;max-width:1200px}

/* Hero */
.wec-hero{background:linear-gradient(135deg,var(--surface-1),var(--surface-2));border:1px solid var(--border);border-radius:14px;padding:26px 28px;margin-bottom:18px;position:relative;overflow:hidden}
.wec-hero::before{content:"";position:absolute;top:-30px;right:-30px;width:200px;height:200px;background:radial-gradient(circle,var(--accent-soft) 0%,transparent 70%);pointer-events:none}
.wec-hero-eyebrow{display:inline-flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;font-weight:680;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--accent);background:var(--accent-soft);padding:4px 10px;border-radius:5px;margin-bottom:11px}
.wec-hero-title{font-family:'DM Sans',sans-serif;font-weight:800;font-size:28px;letter-spacing:-.025em;color:var(--text-primary);line-height:1.1;margin-bottom:8px}
.wec-hero-sub{font-size:14px;color:var(--text-secondary);line-height:1.55;max-width:640px;margin-bottom:18px}
.wec-hero-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.wec-hero-stat{background:var(--surface-1);border:1px solid var(--border);border-radius:10px;padding:11px 14px}
.wec-hero-stat-key{font-size:10.5px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:.06em;font-family:'DM Sans',sans-serif;font-weight:680;margin-bottom:5px}
.wec-hero-stat-val{font-family:'DM Sans',sans-serif;font-weight:780;font-size:22px;letter-spacing:-.025em;color:var(--text-primary);font-variant-numeric:tabular-nums;line-height:1}
.wec-hero-stat-foot{font-size:11px;color:var(--text-secondary);margin-top:5px}
.wec-hero-actions{display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:2}
.wec-btn{height:34px;padding:0 14px;border-radius:8px;background:var(--surface-1);border:1px solid var(--border);font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;color:var(--text-primary);display:inline-flex;align-items:center;gap:7px;letter-spacing:-.005em;transition:all .14s;white-space:nowrap}
.wec-btn:hover{background:var(--surface-2);border-color:var(--border-strong)}
.wec-btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.wec-btn.primary:hover{background:var(--accent-deep)}
.wec-btn.ghost{background:transparent;border-color:transparent;color:var(--text-secondary)}
.wec-btn.ghost:hover{background:var(--surface-2);color:var(--text-primary)}

/* Test webhook callout */
.wec-test-panel{border:1px solid var(--border);border-radius:11px;background:var(--surface-1);overflow:hidden;margin-bottom:18px}
.wec-test-panel-hdr{display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer;background:var(--info-soft);border-bottom:1px solid transparent;transition:all .15s}
.wec-test-panel-hdr.open{border-bottom-color:var(--border)}
.wec-test-panel-hdr:hover{filter:brightness(.97)}
.wec-test-panel-icon{width:30px;height:30px;border-radius:8px;background:var(--info);color:#fff;display:grid;place-items:center;flex-shrink:0}
.wec-test-panel-title{font-family:'DM Sans',sans-serif;font-weight:720;font-size:14px;letter-spacing:-.01em;color:var(--info)}
.wec-test-panel-sub{font-size:12px;color:var(--text-secondary);margin-top:1px}
.wec-test-panel-body{padding:18px 18px 16px;display:flex;flex-direction:column;gap:14px;background:var(--surface-2)}
.wec-test-panel-body p{margin:0;font-size:13px;line-height:1.55;color:var(--text-secondary)}
.wec-test-panel-body code{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--accent);background:var(--accent-soft);padding:1px 6px;border-radius:4px}

/* Quick reference (TOC) */
.wec-toc{background:var(--surface-1);border:1px solid var(--border);border-radius:12px;padding:18px 20px;margin-bottom:18px}
.wec-toc-hdr{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.wec-toc-title{font-family:'DM Sans',sans-serif;font-weight:740;font-size:14.5px;letter-spacing:-.012em;color:var(--text-primary)}
.wec-toc-sub{font-size:12px;color:var(--text-secondary);margin-top:2px}
.wec-search{position:relative;min-width:240px;flex:1;max-width:360px}
.wec-search input{width:100%;height:36px;padding:0 12px 0 36px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);color:var(--text-primary);font-family:inherit;font-size:13px;outline:none}
.wec-search input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);background:var(--surface-1)}
.wec-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)}

.wec-toc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:9px}
.wec-toc-card{display:flex;align-items:center;gap:11px;padding:11px 13px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all .15s;border-left:3px solid;text-align:left;width:100%}
.wec-toc-card:hover{background:var(--surface-hover);transform:translateY(-1px);box-shadow:var(--shadow-sm)}
.wec-toc-card-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;color:#fff}
.wec-toc-card-body{flex:1;min-width:0}
.wec-toc-card-name{font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;letter-spacing:-.008em;color:var(--text-primary);line-height:1.2}
.wec-toc-card-cnt{font-size:11px;color:var(--text-tertiary);margin-top:2px;font-family:'JetBrains Mono',monospace}
.wec-toc-card-arrow{color:var(--text-tertiary);flex-shrink:0}

/* Filter bar (sticky under TOC) */
.wec-filters{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;position:sticky;top:64px;background:var(--bg);padding:6px 0;z-index:5}
.wec-filter-pills{display:flex;gap:4px;background:var(--surface-1);border:1px solid var(--border);border-radius:9px;padding:3px;flex-wrap:wrap}
.wec-filter-pill{height:28px;padding:0 11px;border-radius:6px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px;color:var(--text-secondary);display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .12s;letter-spacing:-.005em;white-space:nowrap}
.wec-filter-pill:hover{color:var(--text-primary)}
.wec-filter-pill.active{background:var(--accent-soft);color:var(--accent)}
.wec-filter-pill-cnt{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--text-tertiary);font-weight:540}
.wec-filter-pill.active .wec-filter-pill-cnt{color:var(--accent)}
.wec-filter-spacer{flex:1}

/* Category section */
.wec-cat{margin-bottom:24px;scroll-margin-top:120px}
.wec-cat.hilite .wec-cat-hdr{box-shadow:0 0 0 3px var(--accent-soft);border-color:var(--accent)}
.wec-cat-hdr{display:flex;align-items:center;gap:13px;padding:14px 18px;background:var(--surface-1);border:1px solid var(--border);border-radius:11px 11px 0 0;border-bottom:none;transition:all .25s}
.wec-cat-hdr-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;color:#fff;flex-shrink:0}
.wec-cat-hdr-text{flex:1;min-width:0}
.wec-cat-hdr-name{font-family:'DM Sans',sans-serif;font-weight:760;font-size:16px;letter-spacing:-.015em;color:var(--text-primary);line-height:1.2}
.wec-cat-hdr-desc{font-size:12.5px;color:var(--text-secondary);margin-top:3px;line-height:1.4}
.wec-cat-hdr-cnt{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--text-tertiary);background:var(--surface-2);border:1px solid var(--border);padding:4px 9px;border-radius:6px;font-weight:540;flex-shrink:0}
.wec-cat-events{background:var(--surface-1);border:1px solid var(--border);border-top:none;border-radius:0 0 11px 11px;display:flex;flex-direction:column}

/* Event card (collapsible) */
.wec-event{border-bottom:1px solid var(--border);transition:all .15s}
.wec-event:last-child{border-bottom:none}
.wec-event-hdr{padding:14px 18px;display:flex;align-items:flex-start;gap:14px;cursor:pointer;transition:all .12s;background:var(--surface-1)}
.wec-event-hdr:hover{background:var(--surface-hover)}
.wec-event.expanded .wec-event-hdr{background:var(--surface-2)}
.wec-event-chev{flex-shrink:0;color:var(--text-tertiary);transition:transform .2s;margin-top:3px}
.wec-event.expanded .wec-event-chev{transform:rotate(90deg);color:var(--accent)}
.wec-event-body{flex:1;min-width:0}
.wec-event-row1{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:5px}
.wec-event-key{font-family:'JetBrains Mono',monospace;font-weight:680;font-size:14px;color:var(--text-primary);letter-spacing:-.01em}
.wec-event-key-copy{width:24px;height:24px;border-radius:5px;display:grid;place-items:center;color:var(--text-tertiary);background:transparent;border:none;cursor:pointer;opacity:0;transition:all .12s}
.wec-event-hdr:hover .wec-event-key-copy{opacity:1}
.wec-event-key-copy:hover{background:var(--accent-soft);color:var(--accent)}
.wec-event-key-copy.copied{opacity:1;color:var(--ok)}
.wec-event-version{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--text-tertiary);background:var(--surface-2);border:1px solid var(--border);padding:2px 6px;border-radius:4px}
.wec-event-desc{font-size:13px;color:var(--text-secondary);line-height:1.55}

.wec-delivery-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:5px;font-family:'DM Sans',sans-serif;font-weight:660;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;line-height:1.4;white-space:nowrap}
.wec-delivery-badge.atleast{color:var(--ok);background:var(--ok-soft)}
.wec-delivery-badge.besteffort{color:var(--wr);background:var(--wr-soft)}
.wec-delivery-dot{width:6px;height:6px;border-radius:50%;background:currentColor}

/* Payload viewer */
.wec-event-payload{padding:0 18px 18px;background:var(--surface-2);border-top:1px solid var(--border);animation:wecExpand .25s cubic-bezier(.2,.7,.3,1)}
@keyframes wecExpand{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.wec-payload-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0 8px;flex-wrap:wrap}
.wec-payload-tabs{display:flex;gap:4px;background:transparent}
.wec-payload-tab{height:28px;padding:0 11px;border-radius:6px;font-family:'DM Sans',sans-serif;font-weight:660;font-size:11.5px;color:var(--text-secondary);display:inline-flex;align-items:center;gap:5px;cursor:pointer;transition:all .12s;background:var(--surface-3);border:1px solid var(--border)}
.wec-payload-tab.active{background:var(--surface-1);color:var(--text-primary);border-color:var(--border-strong)}
.wec-payload-meta{font-size:11.5px;color:var(--text-tertiary);font-family:'DM Sans',sans-serif;font-weight:540;display:flex;align-items:center;gap:14px}
.wec-payload-meta strong{color:var(--text-secondary);font-weight:660}
.wec-code-card{background:var(--code-bg);border-radius:9px;padding:14px 0;position:relative;overflow:hidden}
.wec-code-card-hdr{display:flex;align-items:center;justify-content:space-between;padding:0 14px 12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:10px}
.wec-code-card-label{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#7a766f;letter-spacing:.05em;text-transform:uppercase}
.wec-code-copy{height:26px;padding:0 10px;border-radius:5px;background:rgba(255,255,255,.08);color:#aca9a1;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;transition:all .12s;border:none}
.wec-code-copy:hover{background:rgba(255,255,255,.14);color:#fff}
.wec-code-copy.copied{background:rgba(45,138,94,.3);color:#9bd1a3}
.wec-json{font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.6;color:var(--code-fg);padding:0 16px;overflow-x:auto;white-space:pre}
.wec-json-line{display:block;white-space:pre}
.wec-json-pad{white-space:pre;color:transparent}
.wec-json-key{color:var(--code-key)}
.wec-json-str{color:var(--code-str)}
.wec-json-num{color:var(--code-num)}
.wec-json-bool{color:var(--code-bool)}
.wec-json-null{color:var(--code-null);font-style:italic}
.wec-json-punct{color:var(--code-punct)}

/* Empty state */
.wec-empty{padding:50px 20px;text-align:center;color:var(--text-tertiary);font-size:13px;background:var(--surface-1);border:1px solid var(--border);border-radius:12px}
.wec-empty-icon{width:48px;height:48px;border-radius:11px;background:var(--surface-2);color:var(--text-tertiary);display:grid;place-items:center;margin:0 auto 12px}
.wec-empty-title{font-family:'DM Sans',sans-serif;font-weight:680;font-size:14px;color:var(--text-secondary);margin-bottom:4px}

/* Toast */
.wec-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--text-primary);color:var(--surface-1);padding:11px 18px;border-radius:9px;display:flex;align-items:center;gap:9px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:13px;z-index:60;box-shadow:var(--shadow-lg);animation:wecToastIn .25s cubic-bezier(.2,.7,.3,1)}
@keyframes wecToastIn{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}

/* Footer note */
.wec-footer-note{margin-top:30px;padding:18px 20px;background:var(--surface-1);border:1px solid var(--border);border-radius:11px;display:flex;align-items:flex-start;gap:13px}
.wec-footer-note-icon{width:32px;height:32px;border-radius:9px;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;flex-shrink:0}
.wec-footer-note-body{flex:1;font-size:13px;line-height:1.6;color:var(--text-secondary)}
.wec-footer-note-body strong{color:var(--text-primary);font-family:'DM Sans',sans-serif;font-weight:680}

/* Responsive */
@media (max-width:980px){
  .wec-hero-stats{grid-template-columns:repeat(2,1fr)}
  .wec-toc-grid{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:720px){
  .wec-sidebar{display:none}
  .wec-main{padding:16px 14px 40px}
  .wec-hero-stats{grid-template-columns:1fr 1fr}
  .wec-hero{padding:18px 18px}
  .wec-hero-title{font-size:22px}
  .wec-toc-grid{grid-template-columns:1fr}
  .wec-event-hdr{padding:12px 14px;gap:10px}
  .wec-event-payload{padding:0 14px 14px}
}
`;

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className={`wec-root${dark ? " wec-dark" : ""}`}>
      <link rel="stylesheet" href={FONTS_URL} />
      <style>{css}</style>

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <header className="wec-topbar">
        <div className="wec-topbar-left">
          <div className="wec-brand"><LogoMark /> BuiltCRM</div>
          <div className="wec-crumbs">
            <span>{orgName}</span>
            <span className="wec-crumbs-sep">›</span>
            <span>Settings</span>
            <span className="wec-crumbs-sep">›</span>
            <span>Webhooks</span>
            <span className="wec-crumbs-sep">›</span>
            <strong>Event Catalog</strong>
          </div>
        </div>
        <div className="wec-topbar-right">
          <button className="wec-icon-btn" onClick={() => setDark(!dark)} title="Toggle theme">
            {dark ? I.sun : I.moon}
          </button>
          <button className="wec-icon-btn">{I.bell}</button>
          <div className="wec-avatar">DC</div>
        </div>
      </header>

      <div className="wec-shell">
        {/* ── SETTINGS SIDEBAR ─────────────────────────── */}
        <aside className="wec-sidebar">
          <div className="wec-sb-section">Workspace</div>
          <div className="wec-sb-item">{I.settings} General</div>
          <div className="wec-sb-item">{I.shield} Branding</div>
          <div className="wec-sb-item">{I.bell} Notifications</div>

          <div className="wec-sb-section">Developers</div>
          <div className="wec-sb-item active">
            {I.webhook} Webhooks
            <span style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "var(--accent)" }} />
          </div>
          <div className="wec-sb-sub">
            <div className="wec-sb-sub-item">
              Endpoints
              <span className="wec-cnt">3</span>
            </div>
            <div className="wec-sb-sub-item active">
              Event catalog
              <span className="wec-cnt">{totalEvents}</span>
            </div>
            <div className="wec-sb-sub-item">
              Delivery log
              <span className="wec-cnt">2.4k</span>
            </div>
            <div className="wec-sb-sub-item">
              Signing secrets
            </div>
          </div>
          <div className="wec-sb-item">{I.key} API keys <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--text-tertiary)" }}>4</span></div>
          <div className="wec-sb-item">{I.terminal} API docs <span style={{ marginLeft: "auto", color: "var(--text-tertiary)" }}>{I.external}</span></div>

          <div className="wec-sb-section">Compliance</div>
          <div className="wec-sb-item">{I.shield} Audit log</div>
          <div className="wec-sb-item">{I.doc} Data export</div>
        </aside>

        {/* ── MAIN ─────────────────────────────────────── */}
        <main className="wec-main">
          {/* Hero */}
          <div className="wec-hero">
            <div className="wec-hero-eyebrow">{I.webhook} Outbound webhooks · v1.1</div>
            <div className="wec-hero-title">Webhook Event Catalog</div>
            <div className="wec-hero-sub">
              Every event BuiltCRM emits to your webhook endpoints, with payload schemas and copy-ready examples.
              All payloads are JSON. Signatures are SHA-256 HMAC, sent in the <code style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 6px", borderRadius: 4 }}>X-BuiltCRM-Signature</code> header.
            </div>

            <div className="wec-hero-stats">
              <div className="wec-hero-stat">
                <div className="wec-hero-stat-key">Total events</div>
                <div className="wec-hero-stat-val">{totalEvents}</div>
                <div className="wec-hero-stat-foot">across {allCategories.length} categories</div>
              </div>
              <div className="wec-hero-stat">
                <div className="wec-hero-stat-key">At-least-once</div>
                <div className="wec-hero-stat-val">{atLeastOnceCount}</div>
                <div className="wec-hero-stat-foot" style={{ color: "var(--ok)" }}>retried up to 5×</div>
              </div>
              <div className="wec-hero-stat">
                <div className="wec-hero-stat-key">Best-effort</div>
                <div className="wec-hero-stat-val">{bestEffortCount}</div>
                <div className="wec-hero-stat-foot" style={{ color: "var(--wr)" }}>fired once, no retry</div>
              </div>
              <div className="wec-hero-stat">
                <div className="wec-hero-stat-key">API version</div>
                <div className="wec-hero-stat-val" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 18 }}>v1.1</div>
                <div className="wec-hero-stat-foot">stable since Mar 2026</div>
              </div>
            </div>

            <div className="wec-hero-actions">
              <button
                className="wec-btn primary"
                onClick={() => copyText("openapi", "# BuiltCRM Webhook OpenAPI 3.1 spec\n# (would download .yaml)")}
              >
                {copiedKey === "openapi" ? <>{I.check} Copied</> : <>{I.download} OpenAPI YAML</>}
              </button>
              <button
                className="wec-btn"
                onClick={() => copyText("alljson", JSON.stringify(eventCatalog, null, 2))}
              >
                {copiedKey === "alljson" ? <>{I.check} Copied {totalEvents} events</> : <>{I.copy} Copy all as JSON</>}
              </button>
              <button className="wec-btn" onClick={() => setShowTestPanel(!showTestPanel)}>
                {I.terminal} {showTestPanel ? "Hide" : "Show"} test instructions
              </button>
            </div>
          </div>

          {/* Test panel (collapsible) */}
          {showTestPanel && (
            <div className="wec-test-panel">
              <div className="wec-test-panel-hdr open" onClick={() => setShowTestPanel(false)}>
                <div className="wec-test-panel-icon">{I.terminal}</div>
                <div style={{ flex: 1 }}>
                  <div className="wec-test-panel-title">Verify webhook signatures</div>
                  <div className="wec-test-panel-sub">Every request includes an HMAC-SHA256 signature. Verify it before trusting the payload.</div>
                </div>
                {I.chevD}
              </div>
              <div className="wec-test-panel-body">
                <p>
                  Each outbound request is signed with your endpoint's signing secret. The signature is computed as <code>HMAC_SHA256(secret, timestamp + "." + payload)</code> and sent in the <code>X-BuiltCRM-Signature</code> header along with a <code>X-BuiltCRM-Timestamp</code> header.
                </p>
                <p>
                  <strong style={{ color: "var(--text-primary)" }}>Reject any request</strong> where the signature doesn't match, or where the timestamp is more than 5 minutes old (replay protection). Test signing secrets live under <code>Settings › Webhooks › Signing secrets</code>.
                </p>
                <div className="wec-code-card" style={{ background: "#1a1814" }}>
                  <div className="wec-code-card-hdr">
                    <span className="wec-code-card-label">curl example</span>
                    <button
                      className={`wec-code-copy${copiedKey === "curl" ? " copied" : ""}`}
                      onClick={() => copyText("curl", `curl -X POST https://your-endpoint.com/webhook \\
  -H "Content-Type: application/json" \\
  -H "X-BuiltCRM-Signature: t=1714056181,v1=a3f4..." \\
  -d @payload.json`)}
                    >
                      {copiedKey === "curl" ? I.check : I.copy}
                      {copiedKey === "curl" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="wec-json">
                    <span className="wec-json-line"><span className="wec-json-key">curl</span><span className="wec-json-punct"> -X POST </span><span className="wec-json-str">https://your-endpoint.com/webhook</span><span className="wec-json-punct"> \</span></span>
                    <span className="wec-json-line"><span className="wec-json-pad">  </span><span className="wec-json-punct">-H </span><span className="wec-json-str">"Content-Type: application/json"</span><span className="wec-json-punct"> \</span></span>
                    <span className="wec-json-line"><span className="wec-json-pad">  </span><span className="wec-json-punct">-H </span><span className="wec-json-str">"X-BuiltCRM-Signature: t=1714056181,v1=a3f4..."</span><span className="wec-json-punct"> \</span></span>
                    <span className="wec-json-line"><span className="wec-json-pad">  </span><span className="wec-json-punct">-d </span><span className="wec-json-str">@payload.json</span></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick reference / TOC */}
          <div className="wec-toc">
            <div className="wec-toc-hdr">
              <div>
                <div className="wec-toc-title">Quick reference</div>
                <div className="wec-toc-sub">Jump to a category or search by event key.</div>
              </div>
              <div className="wec-search">
                {I.search}
                <input
                  type="text"
                  placeholder="Search events (e.g., rfi, draw, project)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="wec-toc-grid">
              {allCategories.map(c => {
                const cfg = categoryConfig[c];
                const cnt = eventCatalog.filter(e => e.category === c).length;
                return (
                  <button
                    key={c}
                    className="wec-toc-card"
                    onClick={() => jumpToCategory(c)}
                    style={{ borderLeftColor: cfg.color }}
                  >
                    <div className="wec-toc-card-icon" style={{ background: cfg.color }}>
                      {categoryIconFor(c)}
                    </div>
                    <div className="wec-toc-card-body">
                      <div className="wec-toc-card-name">{cfg.label}</div>
                      <div className="wec-toc-card-cnt">{cnt} event{cnt === 1 ? "" : "s"}</div>
                    </div>
                    <span className="wec-toc-card-arrow">{I.chevR}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category filter pills + expand/collapse */}
          <div className="wec-filters">
            <div className="wec-filter-pills">
              <button
                className={`wec-filter-pill${filterCategory === "all" ? " active" : ""}`}
                onClick={() => setFilterCategory("all")}
              >
                All <span className="wec-filter-pill-cnt">{eventCatalog.length}</span>
              </button>
              {allCategories.map(c => {
                const cnt = eventCatalog.filter(e => e.category === c).length;
                return (
                  <button
                    key={c}
                    className={`wec-filter-pill${filterCategory === c ? " active" : ""}`}
                    onClick={() => setFilterCategory(c)}
                  >
                    {categoryIconFor(c)}
                    {categoryConfig[c].label}
                    <span className="wec-filter-pill-cnt">{cnt}</span>
                  </button>
                );
              })}
            </div>
            <div className="wec-filter-spacer" />
            <button className="wec-btn ghost" onClick={expandAll} disabled={filteredEvents.length === 0}>
              {I.expand} Expand all
            </button>
            <button className="wec-btn ghost" onClick={collapseAll} disabled={expanded.size === 0}>
              {I.collapse} Collapse all
            </button>
          </div>

          {/* Categories + events */}
          {filteredEvents.length === 0 ? (
            <div className="wec-empty">
              <div className="wec-empty-icon">{I.search}</div>
              <div className="wec-empty-title">No events match "{search}"</div>
              <div>Try a broader term, or clear the filter to see all {totalEvents} events.</div>
            </div>
          ) : (
            allCategories.map(cat => {
              const events = grouped[cat];
              if (events.length === 0) return null;
              const cfg = categoryConfig[cat];
              return (
                <section
                  key={cat}
                  id={`wec-cat-${cat}`}
                  className={`wec-cat${activeAnchor === cat ? " hilite" : ""}`}
                >
                  <div className="wec-cat-hdr">
                    <div className="wec-cat-hdr-icon" style={{ background: cfg.color }}>
                      {categoryIconFor(cat)}
                    </div>
                    <div className="wec-cat-hdr-text">
                      <div className="wec-cat-hdr-name">{cfg.label}</div>
                      <div className="wec-cat-hdr-desc">{cfg.desc}</div>
                    </div>
                    <span className="wec-cat-hdr-cnt">{events.length} event{events.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="wec-cat-events">
                    {events.map(ev => {
                      const isOpen = expanded.has(ev.key);
                      return (
                        <div key={ev.key} className={`wec-event${isOpen ? " expanded" : ""}`}>
                          <div className="wec-event-hdr" onClick={() => toggleExpand(ev.key)}>
                            <span className="wec-event-chev">{I.chevR}</span>
                            <div className="wec-event-body">
                              <div className="wec-event-row1">
                                <span className="wec-event-key">{ev.key}</span>
                                <button
                                  className={`wec-event-key-copy${copiedKey === `key-${ev.key}` ? " copied" : ""}`}
                                  onClick={(e) => { e.stopPropagation(); copyText(`key-${ev.key}`, ev.key); }}
                                  title="Copy event key"
                                >
                                  {copiedKey === `key-${ev.key}` ? I.check : I.copy}
                                </button>
                                <DeliveryBadge kind={ev.deliveryGuarantee} />
                                <span className="wec-event-version">since {ev.sinceVersion}</span>
                              </div>
                              <div className="wec-event-desc">{ev.description}</div>
                            </div>
                          </div>

                          {isOpen && (
                            <div className="wec-event-payload">
                              <div className="wec-payload-hdr">
                                <div className="wec-payload-tabs">
                                  <button className="wec-payload-tab active">Example payload</button>
                                  <button className="wec-payload-tab">Schema</button>
                                </div>
                                <div className="wec-payload-meta">
                                  <span>Content-Type: <strong>application/json</strong></span>
                                  <span>Method: <strong>POST</strong></span>
                                </div>
                              </div>
                              <div className="wec-code-card">
                                <div className="wec-code-card-hdr">
                                  <span className="wec-code-card-label">{ev.key} · example payload</span>
                                  <button
                                    className={`wec-code-copy${copiedKey === `payload-${ev.key}` ? " copied" : ""}`}
                                    onClick={() => copyText(`payload-${ev.key}`, JSON.stringify(ev.examplePayload, null, 2))}
                                  >
                                    {copiedKey === `payload-${ev.key}` ? I.check : I.copy}
                                    {copiedKey === `payload-${ev.key}` ? "Copied" : "Copy JSON"}
                                  </button>
                                </div>
                                <div className="wec-json">
                                  <JsonNode value={ev.examplePayload} indent={0} isLast={true} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}

          {/* Footer note */}
          <div className="wec-footer-note">
            <div className="wec-footer-note-icon">{I.info}</div>
            <div className="wec-footer-note-body">
              <strong>Versioning policy.</strong> Events follow semver-like versioning (<code style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 5px", borderRadius: 3 }}>v1.0</code>, <code style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 5px", borderRadius: 3 }}>v1.1</code>, etc). New optional fields are added in minor versions; breaking changes (renamed or removed fields) bump the major. Pin your endpoint to a specific version under <strong>Endpoints › Edit › API version</strong>. The <code style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: "var(--accent)", background: "var(--accent-soft)", padding: "1px 5px", borderRadius: 3 }}>since</code> badge on each event indicates when it was first introduced.
            </div>
          </div>
        </main>
      </div>

      {/* Toast */}
      {copiedKey && (copiedKey.startsWith("key-") || copiedKey === "alljson" || copiedKey === "openapi") && (
        <div className="wec-toast">
          {I.check}
          {copiedKey === "alljson" && `Copied ${totalEvents} events as JSON`}
          {copiedKey === "openapi" && "OpenAPI YAML copied to clipboard"}
          {copiedKey.startsWith("key-") && `Copied ${copiedKey.slice(4)}`}
        </div>
      )}
    </div>
  );
}

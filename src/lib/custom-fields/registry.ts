// Step 61 — Custom-field entity-type registry.
//
// Adding a new entity type to the custom-field system is a one-line
// schema change (add to `customFieldEntityTypeEnum`) plus one entry
// here. The admin UI iterates this list to render its tabs; the
// drop-in <CustomFieldsBlock> uses it to look up display names.

import type { customFieldEntityTypeEnum } from "@/db/schema/customFields";

export type CustomFieldEntityType =
  (typeof customFieldEntityTypeEnum.enumValues)[number];

export type EntityTypeDescriptor = {
  type: CustomFieldEntityType;
  /** Plural display name for tabs / headings ("Projects"). */
  pluralLabel: string;
  /** Singular display name in inline copy ("Add a custom field to a project"). */
  singularLabel: string;
  /** Short blurb shown under the tab heading in the admin UI. */
  description: string;
};

export const CUSTOM_FIELD_ENTITY_REGISTRY: EntityTypeDescriptor[] = [
  {
    type: "project",
    pluralLabel: "Projects",
    singularLabel: "project",
    description:
      "Custom fields rendered on project create/edit forms and visible on project detail and list views.",
  },
  {
    type: "subcontractor",
    pluralLabel: "Subcontractors",
    singularLabel: "subcontractor org",
    description:
      "Custom fields rendered on subcontractor org profiles. Visible to the sub when editing their own org.",
  },
  {
    type: "document",
    pluralLabel: "Documents",
    singularLabel: "document",
    description:
      "Custom fields shown on document upload + edit. Useful for typed metadata (CSI division, drawing revision, etc.).",
  },
  {
    type: "rfi",
    pluralLabel: "RFIs",
    singularLabel: "RFI",
    description:
      "Custom fields shown on RFI create/edit forms. Useful for cost-impact estimates, internal tags, and trade-specific routing.",
  },
];

export function getEntityTypeDescriptor(
  type: CustomFieldEntityType,
): EntityTypeDescriptor {
  const found = CUSTOM_FIELD_ENTITY_REGISTRY.find((d) => d.type === type);
  if (!found) {
    // Should be impossible — type is constrained by the enum. Throw rather
    // than silently returning a default to surface registry drift early.
    throw new Error(`No registry entry for custom-field entity type: ${type}`);
  }
  return found;
}

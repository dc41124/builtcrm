import type { MetadataRoute } from "next";

// PWA manifest — Step 50.
// theme_color matches the contractor portal accent (#5b4fc7) since contractors
// are the paying user. start_url lands signed-in users on their portal picker
// and signed-out users on /login (select-portal redirects accordingly).
//
// Icons are SVG-only for v1. Modern browsers (Chrome 88+, Safari 16+, Firefox
// latest) support SVG manifest icons natively. Older browsers fall back to the
// favicon. PNG fallback at 192/512/180 (apple-touch-icon) can be added later
// if metrics show it matters.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BuiltCRM",
    short_name: "BuiltCRM",
    description: "Construction project management — RFIs, draws, daily logs, drawings, closeout.",
    start_url: "/select-portal",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#5b4fc7",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

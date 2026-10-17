/**
 * AFTERBUY design tokens.
 *
 * One place for colour, type and spacing so the canvas world, the in-game
 * panels and the HTML shell stay in step. Values are deliberately warm and
 * low-contrast except where text needs to be read: forest/ink carry meaning,
 * cream is the light surface, and terracotta/mustard/blue are reserved accents.
 */

export const COLOR = {
  // Surfaces
  paper: "#F6F0E4",
  paperLight: "#FFF9F0",
  paperDeep: "#EFE3CC",
  paperShade: "#E4D5B8",

  // Anchors
  forest: "#254D3A",
  forestDeep: "#1B3A2B",
  forestNight: "#14281D",
  ink: "#40372E",
  inkSoft: "#766E62",
  inkFaint: "rgba(64, 55, 46, 0.45)",

  // Accents
  leaf: "#6E9670",
  leafDeep: "#4F7554",
  sage: "#AFC2A2",
  terracotta: "#C97F61",
  terracottaDeep: "#A9614A",
  mustard: "#E5BB62",
  mustardDeep: "#C99B41",
  blue: "#829EB0",
  blueDeep: "#5F7C8E",

  // Effects
  shadow: "rgba(27, 45, 33, 0.22)",
  shadowSoft: "rgba(27, 45, 33, 0.12)",
  glow: "rgba(229, 187, 98, 0.20)",
  paperEdge: "rgba(64, 55, 46, 0.14)",
};

export const FONT = {
  display: 'Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif',
  body: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  hand: '"Segoe Script", "Bradley Hand", "Chalkboard SE", cursive',
};

export const TYPE = {
  display: 24,
  title: 19,
  heading: 15,
  body: 12,
  small: 11,
  label: 10,
  micro: 9,
};

export const RADIUS = { xs: 3, sm: 5, md: 9, lg: 14 };

export const SPACE = { xs: 4, sm: 8, md: 14, lg: 20, xl: 28 };

/** Text colours with enough contrast on the paper surfaces. */
export const TEXT = {
  strong: COLOR.ink,
  body: "#4A4038",
  muted: COLOR.inkSoft,
  onDark: COLOR.paper,
  accent: COLOR.terracottaDeep,
  success: COLOR.leafDeep,
  warning: "#9A6B2E",
};

/** Motion is disabled when the player asks for reduced motion. */
export function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Frame-rate independent easing toward a target (1/second-ish). */
export function approach(current, target, dt, speed = 14) {
  const t = 1 - Math.exp(-speed * Math.max(0, dt));
  return current + (target - current) * t;
}

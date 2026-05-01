/*
 * Tailwind v4 config.
 * The CSS tokens live in src/styles/tokens.css. This config maps them
 * onto Tailwind theme keys so classes like `bg-surface`, `text-t1`,
 * `font-display`, `rounded-l`, `shadow-md` resolve to the right vars.
 *
 * Uses .mjs (explicit ESM) instead of .ts to silence Node's
 * MODULE_TYPELESS_PACKAGE_JSON warning when tailwind loads this
 * standalone. Intellisense for Tailwind's Config type is still
 * available via the @type JSDoc comment below — same guarantee as
 * the TS version.
 */

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--s0)',
        surface: 'var(--s1)',
        'surface-2': 'var(--s2)',
        'surface-3': 'var(--s3)',
        'surface-4': 'var(--s4)',
        'surface-hover': 'var(--sh)',
        'surface-active': 'var(--sa)',

        'sb-bg': 'var(--sb-bg)',
        'sb-hover': 'var(--sb-h)',
        'sb-active': 'var(--sb-a)',
        'sb-border': 'var(--sb-bdr)',
        'sb-module-bg': 'var(--sb-mbg)',
        'sb-module-border': 'var(--sb-mbdr)',

        t1: 'var(--t1)',
        t2: 'var(--t2)',
        t3: 'var(--t3)',
        'text-inverse': 'var(--ti)',

        accent: 'var(--ac)',
        'accent-hover': 'var(--ac-h)',
        'accent-soft': 'var(--ac-s)',
        'accent-strong': 'var(--ac-t)',

        ok: 'var(--ok)',
        'ok-soft': 'var(--ok-s)',
        'ok-strong': 'var(--ok-t)',
        warn: 'var(--wr)',
        'warn-soft': 'var(--wr-s)',
        'warn-strong': 'var(--wr-t)',
        danger: 'var(--dg)',
        'danger-soft': 'var(--dg-s)',
        'danger-strong': 'var(--dg-t)',
        info: 'var(--in)',
        'info-soft': 'var(--in-s)',
        'info-strong': 'var(--in-t)',

        'portal-contractor': 'var(--portal-contractor)',
        'portal-subcontractor': 'var(--portal-subcontractor)',
        'portal-commercial': 'var(--portal-commercial)',
        'portal-residential': 'var(--portal-residential)',

        'tree-line': 'var(--tl)',
      },
      fontFamily: {
        display: 'var(--fd)',
        body: 'var(--fb)',
        mono: 'var(--fm)',
      },
      borderRadius: {
        s: 'var(--r-s)',
        m: 'var(--r-m)',
        l: 'var(--r-l)',
        xl: 'var(--r-xl)',
      },
      boxShadow: {
        sm: 'var(--shsm)',
        md: 'var(--shmd)',
        lg: 'var(--shlg)',
        ring: 'var(--shri)',
      },
      transitionTimingFunction: {
        e: 'var(--e)',
      },
      transitionDuration: {
        fast: 'var(--df)',
        normal: 'var(--dn)',
        slow: 'var(--ds)',
      },
      spacing: {
        sidebar: 'var(--sw)',
        topbar: 'var(--th)',
      },
    },
  },
  plugins: [],
};

export default config;

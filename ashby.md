# Claude Code Prompt — Build with the Ashby Design System

You are implementing a UI using the **Ashby design system**, reverse-engineered from the live
ashbyhq.com site (Next.js + a Stitches theme using Radix-style 1→13 color scales). **This document
is the single source of truth for all visual decisions.** Do not invent colors, sizes, spacing,
shadows, or radii outside what is defined here. When a token exists, reference it — never hardcode a
raw hex or px value that duplicates a token.

---

## How to use this document
- If the repo already uses a framework (React, Vue, Svelte, Next, etc.), adapt to it and match
  existing conventions. If the repo is empty, default to **React + TypeScript + Vite** with **plain
  CSS custom properties** (no Tailwind, no component kit) — this mirrors Ashby's own CSS-variable
  approach and reproduces the look most faithfully.
- Save the token block in section 1 verbatim as `src/styles/tokens.css` and import it once at the
  app root so the variables are globally available.
- Build the components in section 4 to spec, wire them into the task in section 5, and verify
  against the checklist in section 7.

## The design language, in one paragraph
Ashby feels like a premium, trustworthy B2B SaaS product: calm, precise, and quietly editorial.
Near-white canvases (`--colors-primary1`, a faint cool off-white), a confident indigo-purple brand,
generous whitespace, and soft, neutral-cool shadows rather than heavy drop shadows. Controls use a
tight 6px radius; surfaces step up to 12–16px. Typography is a clean geometric sans for everything,
with a high-contrast serif reserved for the occasional accent word. Motion is small and crisp — a
1px lift on hover, never bouncy. Nothing is flashy; the polish is in the restraint and consistency.

---

## 1) Design tokens — save this verbatim as `src/styles/tokens.css`

```css
/* Ashby Design System tokens — extracted from ashbyhq.com.
   Variable names match Ashby's Stitches theme for drop-in fidelity. */
:root {
  /* ---- Fonts ---- */
  --fonts-primary: 'TTNormsPro', 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --fonts-serif:   'Signifier', 'Fraunces', Georgia, 'Times New Roman', serif;

  /* ---- Font sizes ---- */
  --fontSizes-1: 0.75rem;   /* 12 */   --fontSizes-2: 0.875rem;  /* 14 */
  --fontSizes-3: 1rem;      /* 16 */   --fontSizes-35: 1.125rem; /* 18 */
  --fontSizes-4: 1.25rem;   /* 20 */   --fontSizes-5: 1.5rem;    /* 24 */
  --fontSizes-6: 1.875rem;  /* 30 */   --fontSizes-7: 2.25rem;   /* 36 */
  --fontSizes-8: 2.75rem;   /* 44 */   --fontSizes-9: 3.25rem;   /* 52 */
  --fontSizes-10: 4.5rem;   /* 72 */

  /* ---- Font weights (variable font — note the fractional 545/575) ---- */
  --fontWeights-body: 400;  --fontWeights-medium: 500;
  --fontWeights-demibold: 545;  --fontWeights-heading: 575;

  /* ---- Line height / letter spacing ---- */
  --lineHeights-title: 1.1;  --lineHeights-heading: 1.25;  --lineHeights-body: 1.5;
  --letterSpacings-title: -0.04em;  --letterSpacings-heading: -0.025em;
  --letterSpacings-body: -0.008em;  --letterSpacings-caps: 0.06em;

  /* ---- Color: Gray (UI neutrals & text) ---- */
  --colors-gray1:#FCFCFD; --colors-gray2:#F7F7F8; --colors-gray3:#F3F2F4; --colors-gray4:#EEEDEF;
  --colors-gray5:#E8E8EA; --colors-gray6:#E5E5E6; --colors-gray7:#DBDBDC; --colors-gray8:#CBCBCD;
  --colors-gray9:#9C9CA0; --colors-gray10:#908F94; --colors-gray11:#717075; --colors-gray12:#373739;
  --colors-gray13:#141415;

  /* ---- Color: Primary (purple) — brand = primary10 ---- */
  --colors-primary1:#FCFCFE; --colors-primary2:#FAFAFF; --colors-primary3:#F3F2FF; --colors-primary4:#EBE9FE;
  --colors-primary5:#E1DEFC; --colors-primary6:#D3CFF9; --colors-primary7:#BDB8F3; --colors-primary8:#A099EC;
  --colors-primary9:#5246D8; --colors-primary10:#473BCE; --colors-primary11:#3F34BC; --colors-primary12:#252060;
  --colors-primary13:#0C092A;

  /* ---- Color: Pink (accent) ---- */
  --colors-pink1:hsla(311,59%,99%,1);  --colors-pink2:hsla(311,89%,99%,1);  --colors-pink3:hsla(312,79%,98%,1);
  --colors-pink4:hsla(312,79%,95%,1);  --colors-pink5:hsla(312,82%,92%,1);  --colors-pink6:hsla(312,86%,88%,1);
  --colors-pink7:hsla(312,87%,82%,1);  --colors-pink8:hsla(312,92%,76%,1);  --colors-pink9:hsla(315,95%,68%,1);
  --colors-pink10:hsla(315,80%,60%,1); --colors-pink11:hsla(315,70%,50%,1); --colors-pink12:hsla(315,65%,14%,1);

  /* ---- Color: Orange (accent2) ---- */
  --colors-orange1:hsla(27,70%,99%,1);  --colors-orange2:hsla(27,100%,98%,1); --colors-orange3:hsla(26,100%,95%,1);
  --colors-orange4:hsla(26,100%,92%,1); --colors-orange5:hsla(25,100%,89%,1); --colors-orange6:hsla(24,100%,85%,1);
  --colors-orange7:hsla(25,97%,76%,1);  --colors-orange8:hsla(24,95%,67%,1);  --colors-orange9:hsla(24,95%,60%,1);
  --colors-orange10:hsla(24,95%,52%,1); --colors-orange11:hsla(24,92%,47%,1); --colors-orange12:hsla(24,65%,14%,1);

  /* ---- Color: Red (negative) ---- */
  --colors-red1:hsl(359 100% 99.4%); --colors-red2:hsl(359 100% 98.6%); --colors-red3:hsl(360 100% 96.8%);
  --colors-red4:hsl(360 97.9% 94.8%); --colors-red5:hsl(360 90.2% 91.9%); --colors-red6:hsl(360 81.7% 87.8%);
  --colors-red7:hsl(359 74.2% 81.7%); --colors-red8:hsl(359 69.5% 74.3%); --colors-red9:hsl(358 75.0% 59.0%);
  --colors-red10:hsl(358 69.4% 55.2%); --colors-red11:hsl(358 65.0% 48.7%); --colors-red12:hsl(354 57.5% 31.65%);
  --colors-red13:hsl(354 50.0% 14.6%);

  /* ---- Color: Green (positive) ---- */
  --colors-green9:#05bd8c;

  /* ---- Color: Semantic aliases ---- */
  --colors-primary: var(--colors-primary10);
  --colors-primaryGradient: linear-gradient(to bottom, hsl(248deg 65% 60%), var(--colors-primary10));
  --colors-accent: var(--colors-pink9);   --colors-accent2: var(--colors-orange9);
  --colors-white:#fff; --colors-black:#000;
  --colors-bgTint1: var(--colors-primary1); --colors-bgTint2: var(--colors-primary2);
  --colors-textHeading: var(--colors-gray13); --colors-textDark: var(--colors-gray12);
  --colors-textDefault: var(--colors-gray11); --colors-textMuted: var(--colors-gray9);
  --colors-textLight: var(--colors-gray8);
  --colors-borderDefault: var(--colors-gray5); --colors-borderDark: var(--colors-gray6);
  --colors-borderMuted: var(--colors-gray4);

  /* ---- Space (rem, with half-steps 25/55/75) ---- */
  --space-1:0.125rem; --space-2:0.25rem; --space-25:0.375rem; --space-3:0.5rem; --space-4:0.75rem;
  --space-5:1rem; --space-55:1.25rem; --space-6:1.5rem; --space-7:2rem; --space-75:2.5rem;
  --space-8:3rem; --space-87:56px; --space-9:4rem; --space-10:6rem; --space-11:8rem;
  --space-12:12rem; --space-13:16rem; --space-gutter:1.5rem;

  /* ---- Radii ---- */
  --radii-1:6px; --radii-2:8px; --radii-3:12px; --radii-4:16px; --radii-5:20px; --radii-round:9999px;

  /* ---- Sizes ---- */
  --sizes-controlHeight1:28px; --sizes-controlHeight2:32px; --sizes-controlHeight3:36px;
  --sizes-controlHeight35:40px; --sizes-controlHeight4:44px; --sizes-headerHeight:60px;
  --sizes-containerSmall:760px; --sizes-containerNormal:980px; --sizes-containerWide:1200px;
  --sizes-proseContainer:650px;

  /* ---- Border widths ---- */
  --borderWidths-default:1px; --borderWidths-medium:2px;

  /* ---- Shadows (layered, low-opacity, neutral-cool) ---- */
  --shadows-border:0 0 0 1px rgba(20,20,21,0.08);
  --shadows-card0:0 0 0 1px #0e3f7e15;
  --shadows-card1:0 0 0 1px #0e3f7e15,0 1px 1px -.5px #2a33450a,0 2px 2px -1.5px #2a33460a,0 4px 4px -2.5px #2a33460a;
  --shadows-card2:0 0 0 1px #0e3f7e15,0 1px 1px -.5px #2a33450a,0 3px 3px -1.5px #2a33460a,0 6px 6px -3px #2a33460a,0 12px 12px -6px #0e3f7e0a,0 24px 24px -12px #0e3f7e0a;
  --shadows-elevation1:0px 0px 1px rgba(20,20,21,0.18),0px 2px 3px -2px rgba(20,20,21,0.3);
  --shadows-elevation2:0px 0px 1px rgba(20,20,21,0.14),0px 4px 8px -4px rgba(20,20,21,0.35);
  --shadows-elevation3:0px 0px 1px rgba(20,20,21,0.14),0px 6px 16px -6px rgba(20,20,21,0.4);
  --shadows-elevation4:0px 48px 68px 0px rgba(0,0,0,0.30);
  --shadows-focus:0 0 0 3px var(--colors-primary5);
  --shadows-inputInset:inset 0 1px 2px rgba(20,20,21,0.1);
  --shadows-inset:inset 0 0 0 1px rgba(20,20,21,0.16),inset 0 1px 2px hsl(0,0%,100%,0.2);
  --shadows-image:0px 0px 1px rgba(20,20,21,0.18),0px 3px 8px rgba(20,20,21,.11),0px 13px 20px rgba(20,20,21,.09);

  /* ---- Motion ---- */
  --transitions-short:180ms; --transitions-default:250ms; --transitions-long:400ms;
  --transitions-microTransform:150ms transform cubic-bezier(0.16,1,0.3,1);
  --transitions-longTransform:400ms transform cubic-bezier(0.16,1,0.3,1);
}
```

---

## 2) Typography rules
- **Body / UI:** `--fonts-primary` at `--fontSizes-3` (16px), `--fontWeights-body` (400),
  `--lineHeights-body` (1.5), `--letterSpacings-body` (-0.008em), color `--colors-textDefault`.
- **Headings:** `--fonts-primary` at `--fontWeights-heading` (575), color `--colors-textHeading`,
  `--lineHeights-heading` (1.25) and `--letterSpacings-heading` (-0.025em). For large display
  headings use `--fontSizes-9/10` with `--lineHeights-title` (1.1) and `--letterSpacings-title`
  (-0.04em).
- **Eyebrow / section label (signature pattern):** `font-variant: all-small-caps; letter-spacing:
  var(--letterSpacings-caps); font-size: var(--fontSizes-2); font-weight: var(--fontWeights-medium);
  color: var(--colors-primary);`
- **Serif accent:** use `--fonts-serif` sparingly — e.g. one italic word inside a hero headline.
- **Fonts are licensed.** TT Norms Pro and Signifier are self-hosted by Ashby and not freely
  redistributable. Load **Manrope** (sans) and **Fraunces** (serif) from Google Fonts as close
  stand-ins — they are already first in the fallback stacks above. If the project owns a TT Norms
  Pro / Signifier license, add `@font-face` rules and they'll take precedence automatically.

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;1,9..144,400&display=swap" rel="stylesheet">
```

---

## 3) Color system & usage rules
Scales are **perceptual Radix-style ramps (1→13)**. Apply by role, not by eye:
- **1–2** → app background / faint tints  •  **3–5** → subtle component fills, hovers
- **6–8** → borders & dividers  •  **9** → solid brand/accent fill  •  **10** → hover of step 9
- **11–13** → text (13 = highest contrast headings)

Rules:
- App canvas is `--colors-primary1` (near-white) or `--colors-white`. Avoid pure gray backgrounds.
- Brand actions use `--colors-primary` (#473BCE). The **primary gradient** is reserved for primary
  buttons and the logo mark, not large fills.
- Text: headings `--colors-textHeading`, body `--colors-textDefault`, secondary `--colors-textMuted`.
- Borders default to `--colors-borderDefault` (gray5); inputs use the slightly darker gray7.
- Status: green9 = positive, red9 = negative/destructive, orange9 = warning/accent2, pink9 = accent.
- Maintain WCAG AA: body text ≥ 4.5:1, large text/icons ≥ 3:1.

---

## 4) Components to build (exact specs)
Build these as reusable components in the repo's idiom. CSS shown is authoritative.

**Button — primary**
```css
display:inline-flex; align-items:center; justify-content:center;
height:var(--sizes-controlHeight3); padding:0 var(--space-5);
border:1px solid transparent; border-radius:var(--radii-1);
font:var(--fontWeights-medium) var(--fontSizes-3)/1 var(--fonts-primary);
letter-spacing:var(--letterSpacings-body); color:var(--colors-white);
background:var(--colors-primaryGradient); box-shadow:var(--shadows-inset);
cursor:pointer; transition:var(--transitions-microTransform); will-change:transform;
/* hover: transform:translateY(-1px); filter:brightness(1.05) */
```
- **Sizes:** sm = height `--sizes-controlHeight2` (32) + `--fontSizes-2` + padding `--space-4`;
  md = as above (36); lg = height `--sizes-controlHeight4` (44) + `--fontSizes-4` + padding `--space-6`.

**Button — secondary**
```css
background:transparent; box-shadow:inset 0 0 0 2px var(--colors-primary);
color:var(--colors-primary); /* hover: background:var(--colors-primary3) */
```

**Button — disabled (any variant)**
```css
background:var(--colors-gray5); color:var(--colors-gray9);
box-shadow:none; cursor:not-allowed; pointer-events:none;
```

**Text input**
```css
width:100%; height:var(--sizes-controlHeight3); padding:0 var(--space-4);
border:1px solid var(--colors-gray7); border-radius:var(--radii-1);
font:var(--fontWeights-body) var(--fontSizes-3)/1 var(--fonts-primary);
letter-spacing:var(--letterSpacings-body); color:var(--colors-textDark);
box-shadow:var(--shadows-inputInset); transition:var(--transitions-short);
/* ::placeholder color:var(--colors-textMuted) */
/* :focus { outline:none; border-color:var(--colors-primary); box-shadow:var(--shadows-focus); } */
```

**Card**
```css
background:var(--colors-white); border-radius:var(--radii-1);
padding:var(--space-6); box-shadow:var(--shadows-card1);
/* hover-elevated variant: box-shadow:var(--shadows-card2) */
```

**Header / top navigation**
```css
position:fixed; top:0; left:0; right:0; z-index:10;
height:var(--sizes-headerHeight); /* 60px */
display:flex; align-items:center; justify-content:space-between;
padding:0 var(--space-6); background:var(--colors-primary1);
border-bottom:1px solid var(--colors-borderDefault);
/* optional: backdrop-filter:saturate(180%) blur(12px) on a translucent bg */
```
Nav links: `--fontSizes-2`, `--fontWeights-medium`, `--colors-textDefault`; hover → `--colors-primary`.

**Logo mark** (placeholder): a rounded square `--radii-2`, `background:var(--colors-primaryGradient)`,
`box-shadow:var(--shadows-inset)`, white bold glyph.

**Headings & eyebrow:** per section 2.

---

## 5) YOUR TASK  ✏️ (edit this section)
> Replace the bracketed text with what you actually want built. If you leave it as-is, do the default.

**Build:** [DESCRIBE THE SCREEN/FEATURE/APP HERE — e.g. "a recruiting dashboard with a candidate
pipeline table, filter bar, and a right-hand candidate detail drawer."]

**Default if left unspecified:** Scaffold the project (Vite + React + TS), wire up `tokens.css`, load
the fonts, and build a **component kitchen-sink page** at `/` that renders every component in
section 4 in all states (button variants × sizes × hover/disabled, input default/focus, cards,
header, headings, eyebrow, and the full color ramps as swatches). This proves the system end-to-end.

Always:
1. Create `src/styles/tokens.css` from section 1 and import it globally.
2. Build components as small, reusable, typed units (one file each).
3. Make it responsive (mobile-first) and keyboard-accessible.
4. Run the dev server and confirm it renders without console errors before reporting done.

---

## 6) Engineering conventions
- **Never hardcode** a hex/px that duplicates a token — always `var(--…)`. New values are allowed
  only for one-off layout (e.g. a specific grid gap) and should still prefer the space scale.
- No Tailwind, Bootstrap, MUI, or other design kits unless the repo already uses one.
- Keep components presentational and prop-driven; no business logic inside them.
- Accessibility: semantic HTML, visible `:focus-visible` rings (use `--shadows-focus`), `alt` text,
  and honor `@media (prefers-reduced-motion: reduce)` by disabling transforms/transitions.
- TypeScript strict mode; no `any`. Prettier-formatted.
- Don't add dependencies without need; explain any you add.

## 7) Definition of done
- [ ] `tokens.css` present, imported once, used everywhere (no stray hardcoded values).
- [ ] Manrope + Fraunces loading; primary font stack applied to `body`.
- [ ] All section-4 components built to spec, including hover/focus/disabled states.
- [ ] The task in section 5 is implemented and visually matches the Ashby language (near-white
      canvas, purple brand, 6px control radius, soft card shadows, 575-weight headings).
- [ ] Responsive down to 360px; fully keyboard-navigable; no console errors.
- [ ] `npm run build` (or repo equivalent) passes. Briefly summarize what you built and how to run it.

---
*Tokens and specs reverse-engineered from ashbyhq.com for reference/implementation. TT Norms Pro and
Signifier are licensed typefaces; substitutes are used unless you hold a license. Not affiliated with Ashby.*
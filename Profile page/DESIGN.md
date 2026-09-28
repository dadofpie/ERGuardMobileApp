---
name: Vital Insurtech
colors:
  surface: '#fbf8ff'
  surface-dim: '#dbd9e1'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2fb'
  surface-container: '#efecf5'
  surface-container-high: '#eae7ef'
  surface-container-highest: '#e4e1ea'
  on-surface: '#1b1b21'
  on-surface-variant: '#5d3f3c'
  inverse-surface: '#303036'
  inverse-on-surface: '#f2eff8'
  outline: '#916f6b'
  outline-variant: '#e6bdb8'
  surface-tint: '#c00017'
  primary: '#a80013'
  on-primary: '#ffffff'
  primary-container: '#d31320'
  on-primary-container: '#ffe6e3'
  inverse-primary: '#ffb3ac'
  secondary: '#ac3400'
  on-secondary: '#ffffff'
  secondary-container: '#fe642d'
  on-secondary-container: '#5a1700'
  tertiary: '#6f4c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#8e6200'
  on-tertiary-container: '#ffe9ca'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad6'
  primary-fixed-dim: '#ffb3ac'
  on-primary-fixed: '#410003'
  on-primary-fixed-variant: '#93000f'
  secondary-fixed: '#ffdbd0'
  secondary-fixed-dim: '#ffb59d'
  on-secondary-fixed: '#390b00'
  on-secondary-fixed-variant: '#832600'
  tertiary-fixed: '#ffdead'
  tertiary-fixed-dim: '#fabc4d'
  on-tertiary-fixed: '#281900'
  on-tertiary-fixed-variant: '#604100'
  background: '#fbf8ff'
  on-background: '#1b1b21'
  surface-variant: '#e4e1ea'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an assertive, premium healthcare-fintech identity for Philippine emergency coverage. Moving away from generic clinical blues, the visual language draws vitality and responsiveness from deep medical crimson, dynamic emergency orange, and warm golden accents. 

The aesthetic marries high-end insurtech polish with approachable Philippine healthcare accessibility. Interfaces present immaculate white space, pristine glass overlays, and organic flowing contours derived from physical membership cards. Typography conveys rock-solid financial credibility while remaining clear and legible during urgent emergency admissions. The atmosphere must inspire total confidence, rapid action, and uncompromised care.

## Colors

The palette breaks traditional medical conventions with high-energy urgency and institutional warmth:

- **Primary Red (`#D31320`)**: The anchor of authority, acute care coverage, and institutional brand heritage. Used for primary CTAs, critical status chips, card headers, and high-priority alerts.
- **Secondary Orange (`#F35D26`)**: Communicates rapid emergency response, vitality, and proactive assistance. Powers interactive gradients, secondary actions, and digital card accents.
- **Tertiary Amber Gold (`#E5A93C`)**: Reserved for tier badges (e.g., Plus tiering, accredited VIP hospital privileges, policy caps) and highlight accents.
- **Surface & Backgrounds (`#FFFFFF`, `#FAFAFA`, `#F4F5F7`)**: Pristine clinical surfaces that guarantee high contrast without sterile harshness.
- **Neutral Dark (`#1E1E24`)**: Deep carbon slate for typography and structural line work, avoiding pure black for softer eye-strain tolerance.

## Typography

**Plus Jakarta Sans** serves as the sole typographic engine across all device contexts. Its clean geometric infrastructure, generous x-height, and subtly sculpted terminals offer both financial institutional rigor and warm human readability.

- **Display & Headlines**: Bold, tightly tracked weights (-0.02em to -0.03em) anchor primary membership plans and coverage limits.
- **Card Numbers & Numeric Data**: Formatted in tabular-friendly tracking with high visibility weights (600/700) for instant triage verification at emergency admission desks.
- **Labels**: Slightly expanded letter-spacing to enhance legibility on mobile viewports under stressful, fast-paced hospital conditions.

## Layout & Spacing

The layout is built on a responsive 12-column grid system for desktop (collapsing to 8 columns on tablet and 4 columns on mobile). 

- **Outer Margins**: Tight 16px margins on mobile ensure maximum screen utility for digital member ID display, expanding to 48px on wide screens for generous whitespace.
- **Rhythm**: Built on a strict 8px/4px underlying grid. Component stacks use `space-md` (16px) for standard grouping and `space-xl` (40px) to distinguish coverage sections.
- **Emergency Priority**: Key verification elements (member card, emergency hotline, hospital QR code) are kept within the top 60% viewport anchor on mobile devices.

## Elevation & Depth

Visual hierarchy balances pristine white planes with warm-tinted atmospheric depth, echoing the layered waves of the physical membership cards:

- **Flat Foundation**: Background sits at pure `#FAFAFA` with surfaces elevating on crisp `#FFFFFF` cards.
- **Tinted Emergency Ambient Shadows**: Interactive surfaces avoid muddy gray shadows. Instead, elevated cards and actionable containers cast soft, ultra-diffused red-orange drop shadows (`box-shadow: 0 12px 32px -8px rgba(211, 19, 32, 0.08)`).
- **Physical Card Replication**: Active digital insurance cards employ a subtle dual-layer shadow: a soft downward spread paired with a delicate 1px inner border (`rgba(255, 255, 255, 0.6)`) to produce a tangible credit-card aesthetic.
- **Glassmorphic Overlays**: Modals and floating emergency hospital action bars utilize backdrop frosted blurs (`backdrop-filter: blur(12px)`) at 85% opacity with an ultra-thin 1px border (`rgba(243, 93, 38, 0.12)`).

## Shapes

The design system employs a rounded radius scale (`level 2`, base 0.5rem / 8px). 

- **Cards & Insurance Containers**: Bound by `rounded-xl` (1.5rem / 24px), mimicking the physical rounded corners of ISO standard financial and medical membership cards.
- **Organic Wave Masks**: Card graphics and header containers utilize smooth bezier curve masks reflecting the proprietary fluid wave from the identity mark.
- **Buttons & Pills**: Action buttons and status indicators embrace full pill shapes (9999px) to convey softness, safety, and rapid touch target confirmation.

## Components

### Buttons
- **Primary Emergency CTA**: High-visibility gradient background (Linear: `#D31320` 0% to `#F35D26` 100%), pure white text, bold tracking, pill-shaped radius. Features a glowing warm drop shadow on hover.
- **Secondary / Action**: Clean white surface with a 1.5px solid border in `#F35D26`, text in primary red-orange.
- **Ghost / Tertiary**: Transparent surface with dark neutral text (`#1E1E24`), turning warm orange on hover.

### Digital Membership Cards
- Proportions match the standard 85.60 × 53.98 mm ratio with `rounded-xl` borders.
- Top-right corner features an organic white cutout holding the brand emblem.
- Foreground displays member name, card number in high-contrast monospaced or high-legibility sans numbers, tier designation (e.g., standard red gradient or ER Guard Plus wave), and instant-scan hospital admission QR code.

### Chips & Badges
- **Status Tags**: Pill-shaped containers (`space-xs` vertical, `space-sm` horizontal padding) with 10% tinted backgrounds matching the text color (e.g., `#D31320` text over `rgba(211, 19, 32, 0.08)`).
- **Tier Indicators**: Golden highlight pill (`#E5A93C` text on warm amber tint) with subtle metallic sheen.

### Input Fields & Search
- Generous 48px height with 12px rounded borders (`rounded-md`).
- Default border in low-contrast slate (`#E5E7EB`), transitioning to a crisp 1.5px `#D31320` ring on focus.
- Hospital and doctor search components feature quick-clear pills and embedded geolocation badges.

### Lists & Triage Cards
- Accredited hospital directories and emergency contact listings use surface cards separated by 8px gaps rather than dividing lines.
- Each list item provides direct tap-to-call emergency buttons and distance metrics.
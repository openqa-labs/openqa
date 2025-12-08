# OpenQA Brand & Website Asset Prompts

> Prompts for generating brand assets using Google Nano Banana Pro (or similar AI image generators)

---

## Brand Identity

**OpenQA** is an open-source initiative building **world-class AI agents and tools for QA and test automation**. Our first product is the **OpenQA Test Automation Agent** — natural language browser testing that eliminates selectors, reduces flakiness, and lets QA engineers write tests in plain English.

**Brand Personality:**
- **Bold & Innovative** — Y Combinator startup energy
- **Developer-First** — Clean, technical, approachable
- **Open Source Spirit** — Community-driven, transparent
- **Premium Quality** — Best-in-industry, not another hobby project

**Tagline:** *No selectors. No flake. Just plain English.*

---

## Logo Prompts

### Primary Logo (Square)
```
Modern minimal tech logo for "OpenQA" - an open source AI test automation company.

Design direction: Clean geometric mark that combines concepts of "open" (like an open door, bracket, or aperture) with "QA/testing" (checkmark, verification, automation loop).

Style: Flat vector, single color works on any background. Think Linear, Vercel, Supabase level polish.

Colors: Vibrant violet (#8b5cf6) or bright purple (#a855f7) - NOT dark navy. Should feel energetic and modern, not corporate/heavy.

Avoid: Generic robot icons, magnifying glasses, bugs, gears. No gradients or 3D effects. NO dark navy or near-black purples.
```

### Logo Variations Needed
| Asset | Size | Notes |
|-------|------|-------|
| Primary Mark | 512×512 | Square, icon only |
| Full Logo | 800×200 | Mark + "OpenQA" wordmark |
| Favicon | 32×32, 16×16 | Simplified mark |
| GitHub Avatar | 400×400 | Square, visible at small sizes |

---

## Social Media Profile Pictures

### GitHub Profile
```
Square profile picture for open source project "OpenQA" - AI test automation.

Design: The OpenQA logo mark centered on a solid vibrant violet background (#8b5cf6).

Style: Sharp, high contrast, recognizable at 48×48px thumbnail size.

Format: Square, no rounded corners (GitHub applies them).
```

### LinkedIn Company Page
```
Professional company logo for "OpenQA" - open source AI test automation startup.

Design: Full logo (mark + wordmark) centered on clean white or very light violet background (#f5f3ff).

Style: Premium tech startup aesthetic. Think Anthropic, OpenAI, or Linear's LinkedIn presence.

Dimensions: 300×300 square, but logo content should work in circular crop.
```

### Twitter/X Profile
```
Bold, recognizable profile picture for tech startup "OpenQA" - AI-powered testing.

Design: Logo mark only, vibrant violet (#8b5cf6) on white background OR white on violet background.

Style: High contrast, memorable at small sizes. Slightly more playful than LinkedIn.

Format: Square, will be displayed as circle.
```

### Reddit Community Avatar
```
Community avatar for r/openqa - open source AI test automation.

Design: Logo mark with subtle "community" feel - slightly softer edges, inviting.

Style: Works on Reddit's various light/dark themes.

Format: 256×256 PNG with transparency.
```

---

## Social Media Post Templates

### Launch Announcement (LinkedIn/Twitter)
```
Announcement graphic for open source project launch.

Text overlay: "OpenQA is now open source" with tagline "No selectors. No flake. Just plain English."

Design: Clean, modern layout. White or light gray background with vibrant violet (#8b5cf6) accents and abstract geometric shapes.

Style: Y Combinator launch post energy. Premium, not scrappy.

Dimensions: 1200×628 (LinkedIn) or 1600×900 (Twitter)
```

### Feature Highlight Card
```
Feature card template for social media.

Layout: Left side has feature icon (abstract geometric), right side has short text.

Style: Modern clean aesthetic, sans-serif fonts.

Elements: Subtle dot grid background, violet accent borders.

Dimensions: 1200×1200 square
```

---

## Website Design Prompts

### Landing Page Hero Section
```
Hero section for OpenQA.dev - open source AI test automation platform.

Headline: "AI Test Automation" in large display font
Subhead: "No selectors. No flake. Just plain English."

Design direction: 
- Light theme (white/off-white background)
- Subtle animated mesh gradient in soft violets
- Floating code snippet showing YAML test syntax with syntax highlighting (light or dark mode code block)
- Prominent "Get Started" CTA button in vibrant violet
- Trust badges: "Open Source" / "MIT License" / npm install count

Aesthetic: Premium developer tool. Think Linear meets Vercel meets Anthropic.
Avoid: Stock photos, generic illustrations, purple-on-white AI clichés.
```

### Features Section
```
Features grid for test automation SaaS landing page.

3-column layout with feature cards:
1. "Write in Plain English" - natural language icon
2. "Any LLM Provider" - Claude/OpenAI/Gemini logos abstract
3. "Zero Config BDD" - Cucumber/Playwright icons

Style: Clean cards with subtle shadow and violet hover glow.

Background: White with very subtle noise texture.

Typography: Display font for headings, mono for code snippets.
```

### Code Demo Section
```
Interactive code demo section showing OpenQA in action.

Split layout:
- Left: YAML test file with syntax highlighting
- Right: Browser animation showing test execution

Design: Modern IDE aesthetic.

Animation: Typing effect for code, browser interactions playing in sync.

CTA: "Try in 2 minutes" button below.
```

### Pricing/Open Source Section
```
Open source announcement section for developer tool.

Large text: "100% Open Source. MIT Licensed."

Design: Centered layout, generous whitespace.

Elements: GitHub stars counter, npm weekly downloads, contributor avatars.

Background: Soft violet radial gradient from center.

Style: Celebration feel without being cheesy. Developer-focused.
```

---

## Design System Guidelines

### Colors
```css
/* Primary Brand - Vibrant Violet */
--color-primary: #8b5cf6;         /* Violet 500 - main brand */
--color-primary-light: #a78bfa;   /* Violet 400 - hover states */
--color-primary-dark: #7c3aed;    /* Violet 600 - active states */

/* Backgrounds - Light & Airy, NOT dark */
--color-bg-primary: #fafafa;      /* Near white */
--color-bg-secondary: #f4f4f5;    /* Zinc 100 */
--color-bg-accent: #ede9fe;       /* Violet 100 - subtle accent bg */

/* Text */
--color-text-primary: #18181b;    /* Zinc 900 */
--color-text-muted: #71717a;      /* Zinc 500 */

/* Accents */
--color-accent: #a855f7;          /* Purple 500 */
--color-success: #22c55e;         /* Green 500 */
--color-border: #e4e4e7;          /* Zinc 200 */

/* Dark Mode Alternative (optional) */
--color-dark-bg: #1e1b4b;         /* Indigo 950 - if dark needed */
--color-dark-surface: #312e81;    /* Indigo 900 */
```

### Typography
- **Display Font:** Space Grotesk, Geist, or Satoshi (bold, geometric)
- **Body Font:** Inter or Geist Sans (clean, readable)
- **Mono Font:** JetBrains Mono or Geist Mono (code snippets)

### Visual Elements
- Subtle noise/grain texture overlays
- Glowing borders and accents
- Grid and dot patterns for backgrounds
- Geometric shapes (not circular blobs)
- Terminal/code aesthetic touches

---

## Frontend Design Guidelines

```markdown
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality.
```

### Design Philosophy

Before coding, commit to a **BOLD aesthetic direction**:
- **Purpose**: Developer tool landing page for AI test automation
- **Tone**: Premium tech startup — refined minimalism with strategic maximalist moments
- **Differentiation**: The one thing to remember: "Tests written in plain English, actually work"

### Critical Rules

1. **Typography**: Use distinctive fonts (Space Grotesk, Geist, Satoshi). NEVER use Inter alone, Arial, or system defaults.

2. **Color**: Light theme primary. Clean white/off-white backgrounds with vibrant violet accents. No dark-mode-only designs.

3. **Motion**: One well-orchestrated page load animation > scattered micro-interactions. Staggered reveals, scroll-triggered effects.

4. **Layout**: Asymmetric compositions. Generous negative space. Grid-breaking hero elements.

5. **Backgrounds**: Subtle mesh gradients, noise textures, geometric patterns. NEVER plain solid colors.

6. **Details**: Glowing borders, subtle shadows, grain overlays. Custom cursor optional.

### What to AVOID

❌ Generic AI aesthetics (purple gradients, robot illustrations)
❌ Stock photos of people "using computers"
❌ Overused font stacks (Inter/Roboto/system-ui)
❌ Cookie-cutter SaaS layouts
❌ "AI slop" — anything that looks auto-generated

### Inspiration

- Linear.app (motion, polish)
- Vercel.com (clean, developer aesthetic)
- Anthropic.com (premium AI company feel)
- Supabase.com (open source energy)
- Raycast.com (product-focused design)
- Val.town (minimal, social coding aesthetic)

---

## Deliverables Checklist

### Logos
- [ ] Primary logo mark (SVG + PNG)
- [ ] Full logo with wordmark (SVG + PNG)
- [ ] Favicon (ICO, 32×32, 16×16)
- [ ] Apple touch icon (180×180)
- [ ] OpenGraph image (1200×630)

### Social Profiles
- [ ] GitHub avatar (400×400)
- [ ] LinkedIn company logo (300×300)
- [ ] Twitter/X profile (400×400)
- [ ] Reddit community avatar (256×256)

### Social Posts
- [ ] Launch announcement (1200×628)
- [ ] Feature highlight template (1200×1200)
- [ ] GitHub social preview (1280×640)

### Website
- [ ] Landing page design (Figma/code)
- [ ] Component library
- [ ] Animation specifications

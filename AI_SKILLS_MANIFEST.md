# UNIVERSAL AI AGENT SKILL ROUTER & AUTO-ACTIVATION MANIFEST

> [!IMPORTANT]
> **MANDATORY INSTRUCTION FOR ANY AI ASSISTANT / AGENT (Gemini, Claude, GPT, Windsurf, Cursor, Codex):**
> You have been provided this skills manifest. **Even if the user does NOT explicitly name a skill or slash command**, you are **STRICTLY REQUIRED** to automatically identify which domain or skill applies to the user's task, inspect its `SKILL.md` rules, and execute your response adhering to that skill.
>
> **Rule of Proactive Invocation:** Agar user sirf itna bole: *"UI achha banao"*, *"Animation add karo"*, *"Bug fix karo"*, *"Mobile pe test karo"*, *"Deploy karo"* — to tumhe bina puche directly niche diye gaye matching skill ka file kholna hai aur uske standard ke mutabiq kaam karna hai!

## Quick Auto-Routing Decision Matrix

Scan this table first on every user prompt. Match the user's intent to the skill and immediately open its file:

| User Intent / Problem (What User Says) | Relevant Domain | Primary Skill to Load | SKILL.md Path |
| :--- | :--- | :--- | :--- |
| *"Naya page banao"*, *"UI modern/sundar karo"*, *"Looks generic"* | UI/UX Design | `design-taste-frontend` | `.agents/skills/design-taste-frontend/SKILL.md` |
| *"Awwwards-level website banao"*, *"Site of the Day quality chahiye"* | Awwwards SOTD | `awwwards` | `.agents/skills/awwwards/SKILL.md` |
| *"Awwwards jury score / rate / roast karo"*, *"Site QA score out of 10"* | Jury Scoring | `jury` | `.agents/skills/jury/SKILL.md` |
| *"Premium/Luxury agency look chahiye"*, *"Boutique styling"* | High-End Design | `high-end-visual-design` | `.agents/skills/high-end-visual-design/SKILL.md` |
| *"Clean monochrome/minimal look do"*, *"Bento grid"* | Minimalist Design | `minimalist-ui` | `.agents/skills/minimalist-ui/SKILL.md` |
| *"Industrial, military, blueprint, cyberpunk style"* | Brutalist UI | `industrial-brutalist-ui` | `.agents/skills/industrial-brutalist-ui/SKILL.md` |
| *"Existing page hai, bina todhe UI redesign karo"* | Safe Redesign | `redesign-existing-projects` | `.agents/skills/redesign-existing-projects/SKILL.md` |
| *"Animation add karo"*, *"Smooth transitions chahiye"* | Motion Design | `animate` | `.agents/skills/animate/SKILL.md` |
| *"Animation lag ho raha hai"*, *"FPS drop ho raha hai"*, *"60fps smooth karo"* | Frame Budget | `animation-performance` | `.agents/skills/animation-performance/SKILL.md` |
| *"Apple jaisa fluid feel, spring bounce, sheet gesture"* | Physical Motion | `apple-design` | `.agents/skills/apple-design/SKILL.md` |
| *"Mobile pe layout kharab dikh raha hai"*, *"Input zoom fix karo"* | Mobile Native | `mobile-native` | `.agents/skills/mobile-native/SKILL.md` |
| *"Expo / React Native animation & gestures"* | Expo Motion | `animate-expo` | `.agents/skills/animate-expo/SKILL.md` |
| *"Brand kit, logo deck, visual guidelines banao"* | Brand Visuals | `brandkit` | `.agents/skills/brandkit/SKILL.md` |
| *"Screenshot / image se exact code banao"* | Image to Code | `image-to-code` | `.agents/skills/image-to-code/SKILL.md` |
| *"Toast / notification add karo"* | Toast Systems | `ask-sonner` | `.agents/skills/ask-sonner/SKILL.md` |
| *"Edge case test karo"*, *"UI break karne ki koshish karo"* | Stress Testing | `break-ui` | `.agents/skills/break-ui/SKILL.md` |
| *"Neon Postgres, connection pooling, SQL, migrations"* | Database | `neon-postgres` | `.agents/skills/neon-postgres/SKILL.md` |
| *"Feature ka architectural plan banao"*, *"Spec likho"* | Spec / Plan | `spec` / `office-hours` | `.agents/skills/spec/SKILL.md` |
| *"Plan review karo: CEO / Eng / Design perspective se"* | Multi-Review | `autoplan` | `.agents/skills/autoplan/SKILL.md` |
| *"Bug aa raha hai"*, *"Why is this error happening?"* | Root Cause Debug | `investigate` | `.agents/skills/investigate/SKILL.md` |
| *"Security audit karo"*, *"OWASP / Leaks check karo"* | Security CSO | `cso` | `.agents/skills/cso/SKILL.md` |
| *"App test karo end-to-end"*, *"Find bugs in flow"* | Surface QA | `qa` | `.agents/skills/qa/SKILL.md` |
| *"PR diff review karo before merge"* | Diff Review | `review` | `.agents/skills/review/SKILL.md` |
| *"Release karo"*, *"Deploy to production"*, *"Ship feature"* | Ship Pipeline | `ship` / `land-and-deploy` | `.agents/skills/ship/SKILL.md` |
| *"Browser open karo"*, *"Website live browse karo"* | Browser Automation | `browse` | `.agents/skills/browse/SKILL.md` |
| *"Web page scrape karo"*, *"Authenticated data extract karo"* | Web Scraping | `scrape` | `.agents/skills/scrape/SKILL.md` |
| *"Overcomplication roko"*, *"Surgical minimal code likho"* | Karpathy Standard | `karpathy-guidelines` | `.agents/skills/karpathy-guidelines/SKILL.md` |
| *"Placeholder mat dalo"*, *"Pura complete code likho"* | Full Output | `full-output-enforcement` | `.agents/skills/full-output-enforcement/SKILL.md` |
| *"Only edit files in this folder, baaki mat chhuo"* | Directory Scope | `freeze` | `.agents/skills/freeze/SKILL.md` |
| *"Context save karo"*, *"Agli chat me yaad rakhna"* | Session Memory | `context-save` | `.agents/skills/context-save/SKILL.md` |
| *"Architecture diagram ya visual flow chart banao"* | Diagrams | `diagram` | `.agents/skills/diagram/SKILL.md` |
| *"Antigravity IDE / CLI / Cron automation kaise use karein"* | Antigravity Platform | `antigravity-guide` / `automation` | Builtin Skills |
| *"Naya feature soch rahe hain, pehle brainstorm/clarify karo"* | Superpowers | `brainstorming` | `.agents/skills/brainstorming/SKILL.md` |
| *"Bite-sized step-by-step implementation plan banao"* | Superpowers | `writing-plans` | `.agents/skills/writing-plans/SKILL.md` |
| *"Autonomous subagents se plan execute karwao"* | Superpowers | `subagent-driven-development` | `.agents/skills/subagent-driven-development/SKILL.md` |
| *"Test-Driven Development (TDD): Red-Green-Refactor se code likho"* | Superpowers | `test-driven-development` | `.agents/skills/test-driven-development/SKILL.md` |
| *"Ziddi bug aa gaya, 4-phase root cause se debug karo"* | Superpowers | `systematic-debugging` | `.agents/skills/systematic-debugging/SKILL.md` |
| *"Kaam khatam claim karne se pehle tangible verification proof do"* | Superpowers | `verification-before-completion` | `.agents/skills/verification-before-completion/SKILL.md` |
| *"Code review request prepare karo"* | Superpowers | `requesting-code-review` | `.agents/skills/requesting-code-review/SKILL.md` |
| *"Review feedback implement karo bina defensive huye"* | Superpowers | `receiving-code-review` | `.agents/skills/receiving-code-review/SKILL.md` |
| *"Parallel independent tasks subagents ko dispatch karo"* | Superpowers | `dispatching-parallel-agents` | `.agents/skills/dispatching-parallel-agents/SKILL.md` |
| *"Isolated git branch / worktree me kaam karo"* | Superpowers | `using-git-worktrees` | `.agents/skills/using-git-worktrees/SKILL.md` |
| *"Feature branch complete ho gayi, merge ke liye clean karo"* | Superpowers | `finishing-a-development-branch` | `.agents/skills/finishing-a-development-branch/SKILL.md` |

---

## Detailed Skill Catalog by Category

### 1. High-End UI/UX Design, Aesthetics & Anti-Generic Frontend

**Category Purpose:** Crucial for avoiding generic AI templates, cheap SaaS looks, boring hero sections, or bad color palettes. Applies boutique agency aesthetics, strict typography, and deliberate layouts.

**Common User Intent Triggers:**
- User asks to design a new page, feature, or landing page
- User says 'UI sundar banao', 'modern look do', 'redesign karo', 'anti-slop'
- User asks for dark mode, brutalist, minimal, luxury, or high-tech aesthetics
- User complains the UI looks like generic Tailwind / AI-generated placeholder

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`design-taste-frontend`** | Default anti-slop frontend design for web pages, landing pages, and components. Replaces generic templates with distinctive agency-grade craft. | `design website`, `landing page`, `make UI beautiful`, `redesign`, `anti-slop`, `modern UI` | [SKILL.md](.agents/skills/design-taste-frontend/SKILL.md) |
| **`awwwards`** | Creative director, designer, and creative developer in one. Builds Site of the Day award-caliber websites with concept, art direction, poster-like typography, continuous motion, and browser visual QA. | `awwwards`, `site of the day`, `sotd`, `insane website`, `award caliber`, `creative developer` | [SKILL.md](.agents/skills/awwwards/SKILL.md) |
| **`high-end-visual-design`** | Agency-level visual design tokens, high-contrast typography, premium spacing, and expensive-feeling layouts. | `luxury design`, `expensive look`, `agency design`, `premium feel`, `high end` | [SKILL.md](.agents/skills/high-end-visual-design/SKILL.md) |
| **`minimalist-ui`** | Warm monochrome palettes, editorial typographic contrast, flat bento grids, and zero gaudy gradients or heavy drop shadows. | `minimalist`, `clean editorial`, `subtle UI`, `black and white`, `monochrome` | [SKILL.md](.agents/skills/minimalist-ui/SKILL.md) |
| **`industrial-brutalist-ui`** | Raw mechanical interfaces, Swiss print typography, military terminal aesthetics, and declassified technical blueprints. | `brutalist`, `cyberpunk`, `terminal style`, `industrial UI`, `hacker aesthetic` | [SKILL.md](.agents/skills/industrial-brutalist-ui/SKILL.md) |
| **`gpt-taste`** | Elite UX/UI with GSAP motion engineering, gapless bento grids, wide editorial typography, and structured AIDA layout flow. | `gsap scroll`, `bento grid`, `editorial typography`, `conversion layout`, `elite ux` | [SKILL.md](.agents/skills/gpt-taste/SKILL.md) |
| **`stitch-design-taste`** | Design system tokens and DESIGN.md creation with strict color hierarchy, asymmetric layouts, and micro-motion. | `design system`, `stitch`, `design tokens`, `create DESIGN.md` | [SKILL.md](.agents/skills/stitch-design-taste/SKILL.md) |
| **`redesign-existing-projects`** | Upgrades existing working websites/apps to premium quality without breaking existing functionality or business logic. | `redesign existing`, `upgrade look`, `keep functionality redesign ui`, `polish current page` | [SKILL.md](.agents/skills/redesign-existing-projects/SKILL.md) |
| **`emil-design-eng`** | Emil Kowalski's UI polish philosophy: micro-details, cursor physics, button tactile feedback, and invisible craftsmanship. | `emil kowalski`, `ui polish`, `micro interactions`, `tactile feel`, `subtle details` | [SKILL.md](.agents/skills/emil-design-eng/SKILL.md) |
| **`impeccable`** | All-in-one frontend design review, cognitive load reduction, accessibility, typography sizing, and hierarchy auditing. | `audit ui`, `polish layout`, `hierarchy issue`, `cluttered screen`, `improve ux` | [SKILL.md](.agents/skills/impeccable/SKILL.md) |
| **`design-consultation`** | Proposes a full design system (aesthetic, typography, color, spacing, motion) with previews before coding. | `choose design direction`, `consult design`, `pick color palette`, `propose aesthetic` | [SKILL.md](.agents/skills/design-consultation/SKILL.md) |
| **`design-html`** | Generates production-quality Pretext-native HTML/CSS blueprints with exact specifications. | `pure html css design`, `pretext html`, `clean markup` | [SKILL.md](.agents/skills/design-html/SKILL.md) |
| **`design-shotgun`** | Generates multiple distinct AI design variants for the user to compare, vote on, and iterate. | `give me design options`, `generate variants`, `show 3 design styles`, `shotgun` | [SKILL.md](.agents/skills/design-shotgun/SKILL.md) |
| **`design-review`** | Designer-eye QA finding spacing bugs, hierarchy mismatch, AI-slop patterns, and sluggish interactions. | `review my design`, `design qa`, `check visual consistency`, `critique ui` | [SKILL.md](.agents/skills/design-review/SKILL.md) |
| **`pick-ui-library`** | Evaluates and chooses the right UI component library (shadcn/ui, Radix, Tailwind, etc.) for the project's exact needs. | `which ui library`, `pick component library`, `shadcn vs radix` | [SKILL.md](.agents/skills/pick-ui-library/SKILL.md) |

---

### 2. Animation, Motion Engineering & Fluid Transitions

**Category Purpose:** Use whenever animating UI elements, fixing frame drops, tuning spring physics, eliminating layout shift, or auditing animations.

**Common User Intent Triggers:**
- User asks to add animations, motion, hover effects, or entrance transitions
- User says 'smooth karo', 'animation daalo', 'ye pop-up jhatke se aa raha hai', 'lag ho raha hai'
- User complains about 60fps drops, CPU spikes, or janky re-renders during motion
- User wants Apple-like fluid spring physics or gesture dismissals

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`animate`** | Builds animations from scratch in the correct order: should it animate, purpose, tool (CSS/Framer/WAAPI), curves, interruption, and exit. | `add animation`, `animate this`, `smooth transition`, `component motion`, `hover animation` | [SKILL.md](.agents/skills/animate/SKILL.md) |
| **`animation-performance`** | Keeps animations inside the 16ms frame budget (60/120fps). Restricts to composite-only properties (transform/opacity) and avoids layout thrashing. | `animation lagging`, `frame drops`, `janky animation`, `optimize fps`, `will-change`, `gpu layers` | [SKILL.md](.agents/skills/animation-performance/SKILL.md) |
| **`apple-design`** | Translates Apple's fluid physical motion, spring physics, momentum gestures, translucent materials, and depth into web UI. | `apple style`, `ios feel`, `fluid spring`, `rubber band`, `sheet drag`, `glassmorphism` | [SKILL.md](.agents/skills/apple-design/SKILL.md) |
| **`design-motion`** | Animates an approved graphic or web mockup into seamless video/GIF loops and interactive showcases. | `motion loop`, `animate graphic`, `mp4 preview`, `banner motion` | [SKILL.md](.agents/skills/design-motion/SKILL.md) |
| **`find-animation-opportunities`** | Audits a codebase to locate static areas that feel lifeless and proposes tasteful motion with exact parameters. | `where can we animate`, `make it feel alive`, `what needs motion`, `animation ideas` | [SKILL.md](.agents/skills/find-animation-opportunities/SKILL.md) |
| **`improve-animations`** | Produces an actionable audit roadmap to level up existing choppy or mediocre animations across an entire project. | `improve animations`, `audit motion`, `make app feel better`, `fix bad motion` | [SKILL.md](.agents/skills/improve-animations/SKILL.md) |
| **`review-animations`** | Strict craft review of animation code against Emil Kowalski's guidelines. Flags non-composite properties and poor easings. | `review animation code`, `critique motion`, `is this animation good` | [SKILL.md](.agents/skills/review-animations/SKILL.md) |
| **`remove-animations`** | Removes unnecessary, sluggish, or annoying animations that slow down user productivity and clean up bloat. | `too much animation`, `tone down motion`, `app feels slow`, `remove animations` | [SKILL.md](.agents/skills/remove-animations/SKILL.md) |
| **`animation-vocabulary`** | Reverse-lookup glossary mapping vague descriptions (e.g. 'bouncy pop up', 'rubber band scroll') into industry-standard terms. | `what is this animation called`, `animation name`, `motion terminology` | [SKILL.md](.agents/skills/animation-vocabulary/SKILL.md) |

---

### 3. Mobile, Touch & Native Optimization (iOS / Expo / PWA / Swift)

**Category Purpose:** Ensures responsive designs feel like real installed mobile apps rather than clunky websites wrapped in a phone viewport.

**Common User Intent Triggers:**
- User asks to optimize for mobile, phone viewport, touch gestures, or bottom sheets
- User says 'phone me sahi nahi chal raha', 'zoom ho raha hai input pe', 'laggy tap'
- User works with Expo, React Native, or native Swift code

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`mobile-native`** | Crucial CSS & meta fixes: prevents input auto-zoom, fixes 100vh bug, removes tap-highlight delay, handles notch/safe-areas, and blocks sticky hovers on touch. | `mobile responsive`, `phone feel`, `safe area notch`, `mobile touch fix`, `prevent zoom input`, `pwa` | [SKILL.md](.agents/skills/mobile-native/SKILL.md) |
| **`animate-expo`** | Builds high-performance native animations and gestures in Expo & React Native using Reanimated, Gesture Handler, and expo-haptics. | `expo animation`, `react native gesture`, `reanimated`, `bottom sheet gesture`, `expo-haptics` | [SKILL.md](.agents/skills/animate-expo/SKILL.md) |
| **`ios-design-review`** | Visual design audit specifically tailored for iOS apps running on physical iPhone hardware. | `ios design audit`, `swiftui visual review`, `ios screen check` | [SKILL.md](.agents/skills/ios-design-review/SKILL.md) |
| **`ios-qa`** | Live-device QA testing and debugging for SwiftUI / iOS mobile flows. | `test ios`, `swiftui qa`, `ios bug report` | [SKILL.md](.agents/skills/ios-qa/SKILL.md) |
| **`ios-fix`** | Autonomous bug fixing for iOS / SwiftUI compile errors, layout glitches, and state management issues. | `fix ios bug`, `swiftui error`, `xcode issue` | [SKILL.md](.agents/skills/ios-fix/SKILL.md) |
| **`ios-clean`** | Safely cleans up debug bridges and test wiring from production iOS builds. | `clean ios build`, `strip debug code ios` | [SKILL.md](.agents/skills/ios-clean/SKILL.md) |
| **`ios-sync`** | Regenerates and synchronizes iOS debug bridges with upstream templates. | `sync ios bridge`, `update ios template` | [SKILL.md](.agents/skills/ios-sync/SKILL.md) |
| **`write-swift`** | Best practices for modern Swift 6: concurrency (@concurrent, actors, Task groups), memory ARC, protocols, and Swift Testing. | `swift code`, `swift concurrency`, `swiftui refactor`, `actor data race` | [SKILL.md](.agents/skills/write-swift/SKILL.md) |

---

### 4. Visual Branding, Mockup Generation & Image-to-Code

**Category Purpose:** Creating visual identity guidelines, generating section layout concepts, and turning UI design images into exact pixel-perfect code.

**Common User Intent Triggers:**
- User asks to design a brand kit, logo identity, or presentation deck
- User wants to generate image references for web or mobile UI sections
- User provides an image / mockup and asks to code it exactly

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`image-to-code`** | Converts UI images and mockups into clean, accessible, and responsive production code matching the visual structure precisely. | `convert image to code`, `build this screenshot`, `match this mockup`, `image to html` | [SKILL.md](.agents/skills/image-to-code/SKILL.md) |
| **`brandkit`** | Generates high-end brand guidelines boards, logo identity systems, color palettes, and editorial visual world decks. | `brand kit`, `logo system`, `brand identity`, `guidelines deck`, `visual branding` | [SKILL.md](.agents/skills/brandkit/SKILL.md) |
| **`imagegen-frontend-web`** | Generates separate horizontal section-by-section design reference images for web landing pages before coding. | `web mockup image`, `generate landing page reference`, `section concept image` | [SKILL.md](.agents/skills/imagegen-frontend-web/SKILL.md) |
| **`imagegen-frontend-mobile`** | Generates mobile app screen concepts framed cleanly in modern phone mockups with readable typography. | `mobile app mockup`, `ios screen concept image`, `generate mobile mockup` | [SKILL.md](.agents/skills/imagegen-frontend-mobile/SKILL.md) |

---

### 5. UI Components, Notifications & Stress Testing

**Category Purpose:** Specialized UI tools for alerts/toasts, interactive chat widgets, and stress-testing edge cases with extreme data.

**Common User Intent Triggers:**
- User asks to add toast messages, notifications, or alert banners
- User wants to render interactive rich widgets inline in chat
- User wants to test UI with edge cases like 10,000 items, ultra-long strings, or emoji spam

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`ask-sonner`** | Complete guide to Sonner toasts: promise loading toasts, dismissing, Tailwind dark mode styling, and z-index modal layering. | `sonner`, `toast notification`, `toast not showing`, `toast styling`, `popup message` | [SKILL.md](.agents/skills/ask-sonner/SKILL.md) |
| **`break-ui`** | Stress-tests UI by injecting worst-case data: unbreakable emails, ultra-long German words, zero items, huge counts, and non-Latin text. | `stress test ui`, `break this component`, `edge case testing`, `worst case data` | [SKILL.md](.agents/skills/break-ui/SKILL.md) |
| **`generative_ui`** | Renders rich interactive HTML widgets, diagrams, data visualizations, and educational walkthroughs directly inline. | `interactive widget`, `inline visual tool`, `generative ui component` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/generative_ui/SKILL.md) |

---

### 6. Database, SQL & Cloud Infrastructure (Neon Postgres & Prisma)

**Category Purpose:** Database operations, relational schema design, connection pooling, migrations, and Prisma ORM optimization.

**Common User Intent Triggers:**
- User asks to inspect database, write SQL queries, or fix database errors
- User works with Neon Postgres (scale to zero, branches, connection pooling)
- User works with Prisma schemas, migrations, or @prisma/composer

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`neon-postgres`** | Lakebase Postgres on Neon: pooled vs direct connections, schema migrations, branching, scale-to-zero, and full-text/vector search. | `neon postgres`, `database connection`, `sql query`, `postgres migration`, `connection pool` | [SKILL.md](.agents/skills/neon-postgres/SKILL.md) |
| **`neon`** | High-level Neon cloud backend primitives: Auth, Object Storage, serverless Functions, AI Gateway, and branch-first workflows. | `neon cloud`, `neon auth`, `neon storage`, `neon functions` | [SKILL.md](.agents/skills/neon/SKILL.md) |
| **`prisma-platform-core-concepts`** | Hosting and operating Prisma apps: preview environments, Prisma Postgres, buckets, environment variables, and custom domains. | `prisma platform`, `prisma postgres`, `prisma deploy`, `preview database` | [SKILL.md](.agents/skills/prisma-platform-core-concepts/SKILL.md) |
| **`prisma-composer-core-concepts`** | Architecting modular Prisma Composer services, composition contracts, local testing, and service booting. | `prisma composer`, `@prisma/composer`, `modular prisma` | [SKILL.md](.agents/skills/prisma-composer-core-concepts/SKILL.md) |

---

### 7. Architecture Planning, Specs & Executive Reviews (gstack)

**Category Purpose:** Strategic multi-tier plan reviews (CEO, Design, DevEx, Eng) and converting vague user ideas into airtight engineering specifications.

**Common User Intent Triggers:**
- User has a raw idea and needs a clear spec or technical plan before writing code
- User asks to review or critique a plan from founder / engineering perspective
- User says 'office hours', 'how should we build this feature', 'plan review'

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`office-hours`** | YC partner-level product diagnostic. Clarifies user problem, checks market reality, cuts unnecessary bloat, and aligns goals. | `product idea`, `office hours`, `evaluate idea`, `yc style review`, `feature validation` | [SKILL.md](.agents/skills/office-hours/SKILL.md) |
| **`spec`** | Transforms vague intent into an airtight 5-phase execution specification with verified data flows and zero ambiguities. | `write spec`, `spec this feature`, `plan requirements`, `technical specification` | [SKILL.md](.agents/skills/spec/SKILL.md) |
| **`autoplan`** | Sequential automated 4-tier plan review (CEO → Design → DevEx → Eng) applying 6 core decision principles. | `autoplan`, `complete plan review`, `multi tier review` | [SKILL.md](.agents/skills/autoplan/SKILL.md) |
| **`plan-ceo-review`** | Founder-mode plan review: identifies the 10-star product version, removes friction, and sharpens value proposition. | `ceo review`, `founder review`, `product vision check` | [SKILL.md](.agents/skills/plan-ceo-review/SKILL.md) |
| **`plan-eng-review`** | Engineering Manager review: locks architecture, data schema, error handling, edge cases, and test strategy. | `eng review`, `architecture review`, `lock tech stack`, `system plan review` | [SKILL.md](.agents/skills/plan-eng-review/SKILL.md) |
| **`plan-design-review`** | Designer's eye review of plans: flags poor component ergonomics, missing loading states, and UX traps. | `design plan review`, `ux plan check`, `interface architecture` | [SKILL.md](.agents/skills/plan-design-review/SKILL.md) |
| **`plan-devex-review`** | Developer experience review: examines build tooling, developer ergonomics, and setup friction. | `devex plan review`, `dx plan check` | [SKILL.md](.agents/skills/plan-devex-review/SKILL.md) |
| **`devex-review`** | Live developer experience audit of current repository build times, test ergonomics, and scripts. | `audit developer experience`, `audit dx`, `repo developer review` | [SKILL.md](.agents/skills/devex-review/SKILL.md) |
| **`plan-tune`** | Tunes agent question sensitivity and user developer preferences based on observed habits. | `tune plan sensitivity`, `plan preferences` | [SKILL.md](.agents/skills/plan-tune/SKILL.md) |
| **`eval-plan`** | Preregisters paid evaluations and dry-runs testing suites with zero-cost validation gates. | `evaluate plan cost`, `eval dry run`, `model benchmark plan` | [SKILL.md](.agents/skills/eval-plan/SKILL.md) |

---

### 8. Security Audit, Bug Root-Cause Investigation & QA Testing

**Category Purpose:** Deep technical debugging, security audits (OWASP Top 10), automated QA runs, PR diff reviews, and performance regression checks.

**Common User Intent Triggers:**
- User reports an error, crash, or unexpected behavior in their app
- User asks for security audit or vulnerability check
- User asks to test their application, review a git diff, or clean up shared library duplication

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`cso`** | Chief Security Officer audit: static security findings, OWASP Top 10, STRIDE threat modeling, and exploit reproduction. | `security audit`, `check vulnerability`, `owasp`, `cso`, `auth security check`, `leak audit` | [SKILL.md](.agents/skills/cso/SKILL.md) |
| **`investigate`** | Rigorous root-cause debugging: forms hypotheses, isolates the exact failure point, and fixes the root cause instead of symptoms. | `why is this failing`, `debug error`, `investigate bug`, `crash fix`, `fix broken code` | [SKILL.md](.agents/skills/investigate/SKILL.md) |
| **`qa`** | Full surface-aware QA across browser, API, worker jobs, and webhooks with automated fixes for discovered bugs. | `qa test`, `test whole app`, `find bugs in flow`, `verify feature end to end` | [SKILL.md](.agents/skills/qa/SKILL.md) |
| **`jury`** | Scores any website (live URL or local production build) blind using authentic Awwwards criteria (Design 40%, Usability 30%, Creativity 20%, Content 10%) with Playwright screenshots, core web vitals, accessibility audit, and ranked fixes. | `jury score`, `awwwards score`, `roast my website`, `score out of 10`, `rate design`, `design qa score` | [SKILL.md](.agents/skills/jury/SKILL.md) |
| **`qa-only`** | Report-only QA testing that logs reproducible bug reports without touching source code. | `qa report only`, `list all bugs`, `test without editing` | [SKILL.md](.agents/skills/qa-only/SKILL.md) |
| **`review`** | Pre-landing PR code review: identifies subtle production edge cases, security holes, and code smells in diffs. | `review pr`, `review git diff`, `code review`, `pre merge check` | [SKILL.md](.agents/skills/review/SKILL.md) |
| **`verify`** | Runs checks, linters, TypeScript compiler, and tests repeatedly until 100% green. | `verify build`, `run typecheck and tests`, `make sure tests pass`, `verify fix` | [SKILL.md](.agents/skills/verify/SKILL.md) |
| **`test-audit`** | Finds low-value, brittle, or duplicate tests and eliminates dead test-only helper code. | `audit tests`, `clean test suite`, `remove duplicate tests` | [SKILL.md](.agents/skills/test-audit/SKILL.md) |
| **`health`** | Displays comprehensive repository health dashboard: test coverage, lint status, dependencies, and code hygiene. | `repo health`, `codebase health check`, `dashboard health` | [SKILL.md](.agents/skills/health/SKILL.md) |
| **`benchmark`** | Detects web performance and rendering regressions against established latency baselines. | `benchmark app`, `performance regression`, `speed test app` | [SKILL.md](.agents/skills/benchmark/SKILL.md) |
| **`benchmark-models`** | Cross-model benchmark comparing outputs and skill executions across AI models. | `benchmark models`, `compare model outputs` | [SKILL.md](.agents/skills/benchmark-models/SKILL.md) |
| **`deslop-shared-libs`** | Finds copy-pasted code across the project and extracts it cleanly into reusable shared modules. | `extract shared code`, `deduplicate utilities`, `dry up codebase`, `deslop` | [SKILL.md](.agents/skills/deslop-shared-libs/SKILL.md) |
| **`modernize`** | Modernizes legacy patterns, outdated syntax, deprecated APIs, and old dependency calls. | `modernize code`, `upgrade old syntax`, `migrate deprecated api` | [SKILL.md](.agents/skills/modernize/SKILL.md) |
| **`prototype`** | Rapidly builds a barebones, working proof-of-concept to validate tricky technical mechanics. | `quick prototype`, `poc build`, `spike solution` | [SKILL.md](.agents/skills/prototype/SKILL.md) |

---

### 9. Shipping, Deployment & Release Operations

**Category Purpose:** Handles version bumping, changelogs, staging/production deployments, and post-deploy canary monitoring.

**Common User Intent Triggers:**
- User asks to release, ship, or deploy their application to production
- User asks to prepare release notes, changelog, or create a release PR

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`ship`** | Complete shipping pipeline: runs tests, reviews diff, bumps VERSION & CHANGELOG, commits, and creates pull request. | `ship it`, `prepare release`, `create release pr`, `ship feature` | [SKILL.md](.agents/skills/ship/SKILL.md) |
| **`land-and-deploy`** | Merges the approved branch and triggers automated production deployment workflows. | `land and deploy`, `deploy to prod`, `merge and deploy` | [SKILL.md](.agents/skills/land-and-deploy/SKILL.md) |
| **`setup-deploy`** | Configures deployment target environments, build hooks, and credentials for deployments. | `setup deployment`, `configure deploy`, `deploy config` | [SKILL.md](.agents/skills/setup-deploy/SKILL.md) |
| **`canary`** | Post-deployment canary health monitoring: detects latency spikes, 5xx server errors, and automated rollback signals. | `canary monitor`, `check post deploy health`, `monitor release` | [SKILL.md](.agents/skills/canary/SKILL.md) |
| **`landing-report`** | Read-only release queue dashboard visualizing pending merges and deploy train status. | `landing report`, `release queue status` | [SKILL.md](.agents/skills/landing-report/SKILL.md) |
| **`document-release`** | Generates user-facing release notes, customer changelogs, and internal documentation for releases. | `release notes`, `document release`, `write changelog` | [SKILL.md](.agents/skills/document-release/SKILL.md) |

---

### 10. Live Browser Automation, Authenticated Scraping & Cookies

**Category Purpose:** Controlling real browsers, scraping data from JavaScript-heavy sites, taking full-page screenshots, and session cookies.

**Common User Intent Triggers:**
- User asks to visit a website, scrape tables or data, or test a live URL in a browser
- User asks to capture cookies from their local Chrome profile for scraping

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`browse`** | Drives real Chromium browser: navigates, clicks flows, fills forms, captures screenshots, and checks console logs. | `open browser`, `visit url`, `click around website`, `browse site`, `take screenshot` | [SKILL.md](.agents/skills/browse/SKILL.md) |
| **`scrape`** | Extracts structured data from web pages using authenticated user sessions without bot-blocks. | `scrape page`, `extract web data`, `pull data from url` | [SKILL.md](.agents/skills/scrape/SKILL.md) |
| **`open-gstack-browser`** | Launches GStack Browser with built-in sidebar extension for AI-assisted human browsing. | `launch gstack browser`, `open browser ai`, `connect-chrome` | [SKILL.md](.agents/skills/open-gstack-browser/SKILL.md) |
| **`setup-browser-cookies`** | Exports cookies from real Chromium browser profile into headless browser sessions. | `import cookies`, `copy browser session`, `auth scrape cookies` | [SKILL.md](.agents/skills/setup-browser-cookies/SKILL.md) |
| **`skillify`** | Turns a successful browser scraping flow into a reusable permanent automation skill. | `save scraping skill`, `skillify flow`, `automate scrape` | [SKILL.md](.agents/skills/skillify/SKILL.md) |

---

### 11. Agent Governance, Safety Rails & Multi-Agent Swarms

**Category Purpose:** Preventing AI mistakes, preventing infinite loops, locking files to specific directories, and coordinating multiple agent workers.

**Common User Intent Triggers:**
- User asks to restrict file edits, stop destructive commands, or prevent token runaways
- User manages multiple subagents or tasks in parallel

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`karpathy-guidelines`** | Enforces Andrej Karpathy's coding discipline: avoid overcomplication, surgical minimal diffs, surface hidden assumptions, and define verifiable test criteria. | `coding guidelines`, `clean code`, `karpathy rules`, `prevent overengineering`, `surgical edits` | [SKILL.md](.agents/skills/karpathy-guidelines/SKILL.md) |
| **`full-output-enforcement`** | Strictly bans placeholder code (`// ... rest of code stays same`), ensuring full, complete, and copy-pasteable files. | `no placeholders`, `write full code`, `complete implementation`, `do not truncate` | [SKILL.md](.agents/skills/full-output-enforcement/SKILL.md) |
| **`captain`** | Runs multiple parallel coding agent lanes under one controller without merge collisions. | `multi agent crew`, `captain`, `parallel agents`, `agent swarm` | [SKILL.md](.agents/skills/captain/SKILL.md) |
| **`guard`** | Maximum safety mode: warns before executing potentially destructive terminal commands and limits write boundaries. | `safe mode`, `guard rails`, `protect files`, `prevent dangerous commands` | [SKILL.md](.agents/skills/guard/SKILL.md) |
| **`careful`** | Adds interactive confirmation gates for destructive shell operations (rm -rf, git reset, drop table). | `careful mode`, `confirm destructive`, `shell safety` | [SKILL.md](.agents/skills/careful/SKILL.md) |
| **`freeze`** | Restricts all AI file edits strictly to a specified directory, preventing collateral damage to other files. | `freeze directory`, `edit only this folder`, `lock other files` | [SKILL.md](.agents/skills/freeze/SKILL.md) |
| **`unfreeze`** | Removes directory edit boundaries set by freeze. | `unfreeze directory`, `unlock edit scope` | [SKILL.md](.agents/skills/unfreeze/SKILL.md) |
| **`runaway-stopper`** | Identifies stuck subagents, looping tasks, or runaway CPU threads and cleanly terminates them. | `stop runaway agent`, `kill hanging task`, `infinite loop agent` | [SKILL.md](.agents/skills/runaway-stopper/SKILL.md) |
| **`pair-agent`** | Pairs an external AI agent directly with your live browser session for collaborative debugging. | `pair browser agent`, `remote agent pair` | [SKILL.md](.agents/skills/pair-agent/SKILL.md) |
| **`ubicloud`** | Offloads heavy test suites, builds, or benchmark evaluations onto ephemeral 16-vCPU cloud VMs. | `run on ubicloud`, `cloud vm build`, `heavy eval cloud` | [SKILL.md](.agents/skills/ubicloud/SKILL.md) |

---

### 12. Knowledge Retention, Documentation & Custom Skill Creation

**Category Purpose:** Preserving context across long chats, generating diagrams, writing PDF reports, and authoring new skills.

**Common User Intent Triggers:**
- User asks to save or restore context between chats
- User wants to generate mermaid/excalidraw diagrams, compile PDFs, or generate documentation

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`context-save`** | Saves current conversational working context, pending decisions, and state to disk. | `save context`, `remember this state`, `checkpoint session` | [SKILL.md](.agents/skills/context-save/SKILL.md) |
| **`context-restore`** | Restores saved working context from disk to resume right where the previous session left off. | `restore context`, `resume session`, `load checkpoint` | [SKILL.md](.agents/skills/context-restore/SKILL.md) |
| **`setup-gbrain`** | Initializes local PGLite or Supabase persistent agent memory brain with MCP registration. | `setup gbrain`, `agent memory`, `persistent memory` | [SKILL.md](.agents/skills/setup-gbrain/SKILL.md) |
| **`sync-gbrain`** | Keeps persistent gbrain memory synchronized with recent codebase changes. | `sync memory`, `update gbrain`, `refresh brain` | [SKILL.md](.agents/skills/sync-gbrain/SKILL.md) |
| **`learn`** | Captures and persists project-specific learnings and edge-case corrections for future sessions. | `remember this lesson`, `learn from mistake`, `save project learning` | [SKILL.md](.agents/skills/learn/SKILL.md) |
| **`diagram`** | Converts text architectures into editable Excalidraw files, SVGs, and PNG diagrams. | `draw diagram`, `excalidraw`, `architecture diagram`, `mermaid chart` | [SKILL.md](.agents/skills/diagram/SKILL.md) |
| **`make-pdf`** | Converts markdown documents and reports into publication-quality styled PDFs. | `generate pdf`, `make pdf`, `export to pdf`, `styled document` | [SKILL.md](.agents/skills/make-pdf/SKILL.md) |
| **`document-generate`** | Generates comprehensive documentation for an undocumented module, API, or complete project. | `generate docs`, `document codebase`, `write readme`, `api docs` | [SKILL.md](.agents/skills/document-generate/SKILL.md) |
| **`retro`** | Conducts weekly engineering retrospectives analyzing shipped features, blockers, and tech debt. | `engineering retro`, `weekly retro`, `team review` | [SKILL.md](.agents/skills/retro/SKILL.md) |
| **`write-skill`** | Guides writing new skills or upgrading existing skills adhering to strict quality ladders. | `create new skill`, `author skill`, `write agent skill` | [SKILL.md](.agents/skills/write-skill/SKILL.md) |
| **`codex`** | OpenAI Codex CLI execution wrapper for specialized code synthesis tasks. | `run codex`, `codex cli` | [SKILL.md](.agents/skills/codex/SKILL.md) |
| **`gstack-upgrade`** | Upgrades the gstack suite to the latest upstream release. | `upgrade gstack`, `update skills` | [SKILL.md](.agents/skills/gstack-upgrade/SKILL.md) |

---

### 13. Antigravity Platform, Automation & Workflow Skills

**Category Purpose:** Antigravity IDE & CLI guidance, recurring automation triggers, and multi-agent workflow orchestration.

**Common User Intent Triggers:**
- User asks about Antigravity IDE, CLI commands, slash commands, or customizations
- User wants to schedule cron tasks or build recurring automations
- User wants to run multi-agent workflow scripts

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`antigravity-guide`** | Complete reference for Google Antigravity: agy CLI, Antigravity 2.0 IDE, keybindings, and plugins. | `antigravity guide`, `how to use agy`, `antigravity ide`, `slash command help` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/antigravity_guide/SKILL.md) |
| **`agy-customizations`** | Detailed guide to Antigravity customizations: loading priority, skills, rules, MCP servers, and hooks. | `customizations guide`, `how agy skills work`, `antigravity rules` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/agy-customizations/SKILL.md) |
| **`automation`** | Designs and configures scheduled background automations, cron jobs, and recurring alerts. | `schedule task`, `cron job`, `recurring automation`, `run every morning` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/automation/SKILL.md) |
| **`run-workflow`** | Orchestrates multi-agent dynamic workflow scripts in Python using `parallel`, `pipeline`, and `phase`. | `run workflow script`, `multi agent pipeline`, `orchestrate agents` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/run-workflow/SKILL.md) |
| **`plugin`** | Manages, enables, disables, or creates unified plugin bundles for Antigravity. | `manage plugin`, `create plugin`, `install plugin` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/plugin/SKILL.md) |
| **`migrate-workflows`** | Migrates legacy Antigravity workflows to modern SKILL.md format safely. | `migrate workflow`, `upgrade legacy workflow` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/migrate-workflows/SKILL.md) |
| **`ui-plugin-navigation`** | Discovers and surfaces one-click UI plugin side panels inside the Antigravity IDE. | `open plugin panel`, `toggle side pane` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/ui-plugin-navigation/SKILL.md) |
| **`permissioned-github`** | Handles GitHub operations within agent sandboxes and gracefully requests required token permissions. | `github permission`, `github api agent`, `git credential issue` | [SKILL.md](C:/Users/aakas/.gemini/antigravity/builtin/skills/permissioned-github/SKILL.md) |

---

### 14. Superpowers Autonomous Software Engineering Suite (by Jesse Vincent / obra)

**Category Purpose:** Full development methodology for AI coding agents. Enforces thorough brainstorming before coding, bite-sized step-by-step planning, strict Red-Green TDD, subagent-driven parallel execution, systematic 4-phase debugging, and verification before completion.

**Common User Intent Triggers:**
- User asks to brainstorm, plan, or build a complex feature from scratch
- User says 'TDD se karo', 'test driven development karo', 'pehle plan banao'
- User asks for systematic debugging of stubborn bugs
- User wants autonomous subagents dispatched to execute a verified plan

| Skill ID | What it Enforces & Delivers | Triggers & Keywords | Location |
| :--- | :--- | :--- | :--- |
| **`using-superpowers`** | Primary coordinator skill. Automatically activates Superpowers engineering practices at conversation start. | `superpowers`, `use superpowers`, `bootstrap dev methodology` | [SKILL.md](.agents/skills/using-superpowers/SKILL.md) |
| **`brainstorming`** | Teases out user intent, explores edge cases, and locks clear requirements before writing any code. | `brainstorm feature`, `explore requirements`, `clarify design` | [SKILL.md](.agents/skills/brainstorming/SKILL.md) |
| **`writing-plans`** | Breaks architectural designs into bite-sized, verifiable tasks tailored for autonomous subagents. | `write plan`, `implementation roadmap`, `detailed task breakdown` | [SKILL.md](.agents/skills/writing-plans/SKILL.md) |
| **`subagent-driven-development`** | Dispatches autonomous subagents sequentially with two-stage reviews (spec review + quality review). | `subagent development`, `dispatch subagents`, `autonomous plan execution` | [SKILL.md](.agents/skills/subagent-driven-development/SKILL.md) |
| **`executing-plans`** | Coordinates execution of complex multi-step engineering plans with checkpoint reviews. | `execute plan`, `run plan tasks`, `step by step build` | [SKILL.md](.agents/skills/executing-plans/SKILL.md) |
| **`test-driven-development`** | Enforces true Red-Green-Refactor: write failing test, verify failure, write minimal code, make test pass, refactor safely. | `tdd`, `test driven development`, `write test first`, `red green refactor` | [SKILL.md](.agents/skills/test-driven-development/SKILL.md) |
| **`systematic-debugging`** | 4-phase root-cause diagnosis protocol banning speculative fixes and symptom masking. | `systematic debug`, `find root cause`, `hard bug`, `why did it break` | [SKILL.md](.agents/skills/systematic-debugging/SKILL.md) |
| **`verification-before-completion`** | Strict protocol requiring tangible proof (green test runs, log evidence) before claiming work is finished. | `verify completion`, `prove it works`, `acceptance test` | [SKILL.md](.agents/skills/verification-before-completion/SKILL.md) |
| **`requesting-code-review`** | Formulates structured, context-rich code review requests for peer agents or senior engineers. | `request code review`, `review my PR`, `pre-landing review` | [SKILL.md](.agents/skills/requesting-code-review/SKILL.md) |
| **`receiving-code-review`** | Guides receiving feedback without defensiveness, validating review comments, and implementing fixes cleanly. | `receive code review`, `handle review feedback`, `respond to review` | [SKILL.md](.agents/skills/receiving-code-review/SKILL.md) |
| **`dispatching-parallel-agents`** | Identifies non-conflicting tasks and dispatches multiple parallel subagents to accelerate execution. | `parallel subagents`, `concurrent agents`, `dispatch parallel` | [SKILL.md](.agents/skills/dispatching-parallel-agents/SKILL.md) |
| **`finishing-a-development-branch`** | Comprehensive pre-merge checklist: tests pass, dead code removed, git history squashed cleanly. | `finish branch`, `ready to merge`, `clean git branch` | [SKILL.md](.agents/skills/finishing-a-development-branch/SKILL.md) |
| **`using-git-worktrees`** | Manages isolated git worktrees so parallel agents can develop without file collision or branch switches. | `git worktree`, `isolated workspace`, `parallel git branches` | [SKILL.md](.agents/skills/using-git-worktrees/SKILL.md) |
| **`diagnosing-superpowers`** | Self-test and diagnostic routine verifying all installed Superpowers skills and harnesses. | `diagnose superpowers`, `test skills install`, `check superpowers` | [SKILL.md](.agents/skills/diagnosing-superpowers/SKILL.md) |
| **`writing-skills`** | Meta-skill defining best practices for drafting, structuring, and testing composable agent skills. | `write skill`, `author skill`, `create composable skill` | [SKILL.md](.agents/skills/writing-skills/SKILL.md) |

---

## Mandatory Execution Steps for AI

When the user presents any task, you MUST strictly adhere to this disciplined execution lifecycle:

1. **Identify the Core Category & Proactive Routing**: Review the tables above to match the user's intent. Never wait for explicit slash commands.
2. **Read the SKILL.md Before Action**: Read the exact instructions from the corresponding `SKILL.md` before generating code or plans.
3. **Adhere to the Superpowers Engineering Lifecycle**:
   - **Brainstorm First (`brainstorming`)**: For any new feature or behavior change, explore requirements and edge cases before coding.
   - **Plan in Bite-Sized Verifiable Steps (`writing-plans`)**: Break plans into clear tasks with exact file paths, expected test commands, and verifiable success criteria.
   - **Test-Driven Development (`test-driven-development`)**: When adding logic or bug fixes, write the failing test first, verify failure, write minimal production code, and verify pass.
   - **Root Cause Debugging (`systematic-debugging`)**: For errors and bugs, run a 4-phase diagnosis (Reproduce → Locate Root Cause → Formulate Minimal Fix → Verify) instead of guessing or masking symptoms.
   - **Verification Before Completion (`verification-before-completion`)**: Always run real verification commands (`npx tsc --noEmit`, test suites, dev server curl) and provide tangible output evidence before asserting that a task is finished.
4. **Apply Compounding Aesthetic & Quality Skills**:
   - Aesthetics: `design-taste-frontend` or `high-end-visual-design`
   - Animation: `animate` & `animation-performance`
   - Mobile Touch: `mobile-native`
   - Code Discipline: `karpathy-guidelines` & `full-output-enforcement`
5. **Execute to Perfection**: Deliver 100% complete, production-grade solutions without placeholders or shortcuts.

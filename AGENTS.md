<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# gstack AI Engineering System

This repository is powered by **gstack** (Garry Tan / Y Combinator) alongside our frontend and performance skill suites.

## Core Ethos

- **Boil the Ocean**: Complete coverage, minimal code. Cover 100% of the requirement (all edge cases, error states, and tests) without shipping sloppy shortcuts. Never write speculative abstractions beyond the requirement.
- **Search Before Building**: Understand existing patterns and standard libraries before writing new code. Don't reinvent the wheel.
- **User Sovereignty**: Models recommend, the user decides. Cross-model agreement is signal, never permission.
- **Build for Yourself**: Concrete problems beat hypotheticals.

## The Reuse Ladder

Before writing new code, stop at the first rung that holds:
1. A helper, utility, or pattern already in this repo.
2. The standard library.
3. A native platform feature (CSS over JS, DB constraint over app code).
4. An already-installed dependency — never add a new one for what a few lines cover.

Bug fixes hit the root cause, not symptoms: one guard in the shared function beats a guard in every caller.

## Voice & Quality Standards

- Direct, concrete, builder-to-builder.
- Always name the file, function, command, and user-visible impact.
- Short paragraphs, clear next steps, zero corporate fluff, zero AI hallucinations.

## Key Workflow Roles & Skills

Skills reside in `.agents/skills/`. Key roles and suites include:

### 1. gstack AI Engineering System
- `/office-hours`: Product thinking, challenge framing, YC partner-level product diagnostic.
- `/plan-ceo-review`: Find the 10-star product version in the plan.
- `/plan-eng-review`: Lock architecture, data flows, edge cases, and test strategy.
- `/autoplan`: End-to-end plan review: CEO → Design → DevEx → Eng review.
- `/review`: Pre-landing PR review finding production bugs and security edge cases.
- `/qa` & `/qa-only`: Surface-aware QA across browser, API, worker, and webhook flows.
- `/cso`: Chief Security Officer audit (OWASP Top 10, STRIDE threat modeling).
- `/ship`: Full release pipeline: test pass, gate integrity, review, and PR creation.

### 2. Superpowers Autonomous Engineering Suite (obra / Jesse Vincent)
- `using-superpowers`: Automatic bootstrap & governance for coding agents.
- `brainstorming`: Tease out user intent and explore edge cases before touching code.
- `writing-plans`: Break architectural designs into bite-sized, verifiable tasks.
- `subagent-driven-development`: Dispatch autonomous subagents with two-stage reviews.
- `test-driven-development`: Red-Green-Refactor with true failing tests first.
- `systematic-debugging`: 4-phase root-cause diagnosis without speculative fixes.
- `verification-before-completion`: Tangible verification evidence required before claiming success.
- `finishing-a-development-branch`: Pre-merge test verification and clean git squash.

### 3. Awwwards Creative Engineering & Jury Suite (juliobsz)
- `/awwwards`: Creative director, designer, and creative developer in one. Builds Site of the Day award-caliber websites with concept, art direction, and browser visual QA.
- `/jury`: Blind Awwwards jury evaluation scoring Design, Usability, Creativity, and Content with Playwright screenshots, core web vitals, and ranked fixes.

<!-- ASTRYX:START -->
Astryx v0.7.13 · 174 components
CLI: run every command as `npx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — start every page from a template, never from scratch:
1. `astryx build "<idea>"` — names the template to scaffold from and the parts it lacks.
2. `astryx template <name> <path>` — scaffold it; keep its frame, gap and padding; replace the content.
3. `astryx template <Block>` for parts it lacks; `astryx component <Name>` to read props before using one.
Changing an existing page? Keep it: skip step 2 and add blocks/components inside its sections.
Before you deliver a build, run `astryx doctor --built <dir>`; don't deliver it if it fails.

RULES:
- No <div> — components handle all layout and spacing.
- Read `astryx docs layout` before changing a template's frame.
- Dense data = rows (Table, List/Item), not Card-wrapped lists. Badge = counts only.
- Style with component props first, then Tailwind utilities backed by tokens. No raw hex/px.
- Palettes and custom colors go through the theme, never :root overrides. Run `astryx theme add <slug>` to import; `theme eject <slug>` only forks source. See `astryx docs theme`.
- SELF-CHECK: re-read the file; replace any style={{…}}, raw <div>/<span>, imported .css/@apply, or hardcoded/arbitrary value (bg-[#fff], p-[13px]) with the component or a token-backed utility.

`astryx help` lists every command. Key ones beyond the workflow:
  search "<query>"   find any component / hook / doc / template
  discover <words>   integrations you could add
  docs <topic>       getting-started, principles, tokens, theme … (`astryx docs` lists all)
  docs cli           commands and API reference
  docs authoring     build an integration package, and every field it holds
  upgrade --from <old version> --apply   run after a dependency bump
<!-- ASTRYX:END -->

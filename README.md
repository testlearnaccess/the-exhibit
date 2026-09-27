# Newsletter Draft Desk

An internal drafting tool for the monthly newsletter of the UL Lafayette Science Museum ("The Exhibit"). It turns the editor's rough notes into a complete rough draft in the museum's own house style — built for one solo editor working on a monthly cadence, with the final layout assembled in Canva.

## What it does

- **Style profile** — capture how the newsletter actually reads (tone, headline examples, sign-off) either by filling it in by hand or by pasting a past issue and letting AI extract the profile from it. Each recurring section is classified by type:
  - **Narrative** — prose sections with a target word count
  - **Structured** — day/time/program grids, rendered as rows, never prose
  - **Evergreen** — boilerplate carried forward verbatim each issue (membership pricing, donation call-outs); flagged stale after 6 months
  - **Paired** — a puzzle with a separate answer key
  - **Image-anchored** — a photo with a caption-length text block
- **Monthly input** — one input block per section, matched to its type: free-form notes, a row grid, puzzle + answer key, caption + photo note, or carried-forward boilerplate.
- **Draft generation** — sections with no notes stay empty; the tool never invents facts. Each section is drafted in its own AI call so regeneration can take a fresh angle on one section without touching the rest.
- **Draft review** — per-section word counts against targets, inline editing, section-by-section regenerate, copy a section or the whole draft, and export as `.txt` or `.doc` for pasting into Canva.
- **Issue history** — every issue is saved with its original input notes and final draft, and can be reopened or deleted.

All data (profile and issues) lives in the browser's local storage — there are no accounts, since the tool serves a single editor.

## Tech

- [TanStack Start](https://tanstack.com/start) (React 19, TanStack Router, Vite)
- Tailwind CSS v4 with a dark "Kinetic Glass Console" theme (Space Grotesk headings, Inter body, cyan accent)
- shadcn/ui components (New York style, lucide icons)
- AI drafting through the Lovable AI Gateway, called from server-side functions so the API key never reaches the browser

## Development

Requires Node.js — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

Other scripts: `npm run build` (production build), `npm run lint`, `npm run format`.

## Built with

- TanStack Start — TypeScript, React 19
- Tailwind CSS v4
- shadcn/ui + Radix primitives
- Lovable AI Gateway

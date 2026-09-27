<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Newsletter draft tool
- Style profile and issues persist in browser localStorage via `src/lib/newsletter/store.ts` — single solo editor, no accounts needed.
- All AI drafting goes through server functions in `src/lib/newsletter/generate.functions.ts` using the Lovable AI Gateway Responses API — keeps the API key server-side.

# Sprint company file

Start with `examples/sample-sprint/company.json` (fictional) and read `sprint/company.schema.md` for the full contract. Write one company file per project. It holds their brand, goal, linked facts, first areas to explore, example route, real public percentage, tools, team-data path and call URL.

Keep scope, proof results, about facts, client logos, method steps and shared report defaults in the active profile's `claims.json`. Company files cannot replace those claims. Only the provider changes locked claims or official prices in the profile's `offers.json`.

1. Put photos in the project. Put all other art, including logos, in `assets/art/` as transparent PNGs or SVGs.
2. Set paths relative to `company.json`; an absolute read-only `team_json` path is also accepted.
3. Build with `python3 sprint/build_sprint.py /path/to/project`.
4. Run `python3 sprint/lint_sprint.py /path/to/project/build/slug.html`.
5. Run `python3 sprint/qa_sprint.py /path/to/project/build/slug.html`. Read the contact sheet and results in the project's `qa/` folder.

Run commands from the skill folder. A missing slot or lint failure stops the build before writing output. Correct company data, claims or components, then rebuild. Never patch the compiled HTML.

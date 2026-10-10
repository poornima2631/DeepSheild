# DeepShield — Admin Profile & Reporting update

This folder contains the existing DeepShield project files plus the updated `src/` frontend.

## What changed
- Sidebar entries: Reports and Admin Profile
- Report submission form with category, title, details, and optional contact email
- Report list, status filter, status updates, summary counts, and CSV export
- Editable admin display profile

## Run
1. Extract this folder.
2. Open a terminal in this folder.
3. Run `npm install` if dependencies are not installed.
4. Run `npm run dev`.
5. Open the local URL printed by Vite.

## Prototype limitations
Profile and report data are stored in the current browser's localStorage. They are not persisted by the Express server, shared between browsers, or protected by real authentication. Do not use this as production admin security.

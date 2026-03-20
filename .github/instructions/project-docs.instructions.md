---
description: "ALWAYS read PROJECT.md first for project context. After ANY code change (new file, edit, delete, rename, new IPC channel, new UI component, new function), update PROJECT.md to reflect the change."
applyTo: "**"
---

# Project Documentation Maintenance

## Before Starting Any Task
1. Read `PROJECT.md` at the project root to understand the full project architecture, file structure, IPC channels, data flow, and UI components.
2. This replaces the need to explore/read every file — the doc contains all key information.

## After Every Code Change
After completing ANY modification to the codebase, you MUST update `PROJECT.md` to keep it accurate:

- **New file created** → Add to Directory Structure section + describe in relevant section
- **File deleted/renamed** → Update Directory Structure + all references
- **New IPC channel** → Add to IPC Channels table + Preload APIs section
- **New/changed function** → Update Key Functions table or relevant section
- **New UI component/panel** → Update UI Screens & Panels section
- **New preload API** → Update Preload APIs section
- **Changed data structure** → Update Key Data Structures section
- **New CSS file or variable** → Update CSS Theme section
- **New setting** → Update Settings table
- **Scanner logic change** → Update Scanning Pipeline section

## Update Rules
- Update the "Last updated" date at the top of PROJECT.md
- Keep descriptions concise — function signatures, not full implementations
- Preserve the existing section structure
- Only update sections affected by the change

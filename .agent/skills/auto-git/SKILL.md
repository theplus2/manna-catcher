---
name: Auto Git
description: Automates the process of adding, committing, and pushing changes to the repository.
---

# Auto Git Instructions

When the user asks to "commit and push" or similar, follow these steps:

1.  **Check Status**: Run `git status` to see what changes are pending.
2.  **Add all changes**: Run `git add .`
3.  **Commit**: Run `git commit -m "MESSAGE"` where MESSAGE is a descriptive summary of the changes.
4.  **Push**: Run `git push origin main` (or the current branch).

## Example Command Chain
```powershell
git add .
git commit -m "Update project structure"
git push origin main
```

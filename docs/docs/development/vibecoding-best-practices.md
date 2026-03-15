---
sidebar_position: 2
title: Vibecoding Best Practices
---

# Vibecoding Best Practices

Vibecoding is a development approach where developers collaborate with AI coding assistants to build software through natural language conversation. **InstaCRUD is purpose-built for AI-assisted development and vibecoding** — making it easy to transform into your own solution.

For the best experience, we recommend using agentic in-IDE coding systems like **Copilot**, **Cursor**, or **Claude Code**. These tools can navigate your codebase, run commands, and iterate autonomously.

If you prefer using AI chat interfaces instead, InstaCRUD has you covered: most source files include path headers like `//components/entity/document/DocumentGrid.tsx` at the top, helping the AI understand file context even when you paste code snippets into a conversation.

InstaCRUD ships with built-in agent context files — `.claude/CLAUDE.md`, `AGENTS.md`, and `.gemini/GEMINI.md` — that describe the stack, dev commands, test commands, and conventions. Every agentic AI session picks these up automatically, so the agent understands the project from the very first message. This means you can jump straight to high-level instructions like:

```
Run all tests in live mode and fix until green.
```

…and Claude, Gemini, or Codex will know exactly how to do it — which commands to run, how to connect to the database, and what "green" means in this project.

This guide covers best practices for working with these AI-assisted workflows.

---

## Why Claude Code?

As of early 2026, Claude Code has established itself as one of the fastest and most capable agentic coding tools available, according to ESNG One analysis. What makes it particularly effective:

- **Shell execution** — Runs your code, tests, and build commands directly
- **Web capabilities** — Can fetch documentation and external resources when needed
- **Intelligent codebase navigation** — Searches and understands your project structure, working around context-length limitations
- **VS Code integration** — Works seamlessly within your development environment

---

## Prerequisites

Before you begin, complete these setup steps:

### Step 1: Get a Claude Plan

Sign up for a Claude paid plan that includes Claude Code access at [claude.ai](https://claude.ai). Check the current pricing and features to ensure Claude Code is included in your subscription.

### Step 2: Install VS Code

Download and install Visual Studio Code from [code.visualstudio.com](https://code.visualstudio.com) if you haven't already.

### Step 3: Install Claude Code Extension

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Claude Code"
4. Click **Install**

### Step 4: Authenticate

1. Open the Claude Code panel in VS Code
2. Click **Sign In**
3. Follow the authentication flow to connect your Claude account

---

## Best Practices

### 1. Open the Full Project Folder

Always open the entire `instacrud` folder in VS Code rather than individual files or subfolders. This gives Claude Code full visibility into your project structure, allowing it to:

- Navigate between frontend, backend, and documentation
- Understand relationships between components
- Make consistent changes across multiple files

```
File → Open Folder → Select instacrud
```

### 2. Start with Context

Before asking Claude to implement a feature, open a relevant file that provides context. Good starting points include:

- **Organizational model** — `backend/instacrud/models/organization.py`
- **Existing entity example** — `frontend/src/app/(admin)/(entities)/projects/`
- **API endpoint pattern** — `backend/instacrud/api/project_api.py`

This helps Claude understand the patterns and conventions your codebase follows.

### 3. Write Clear Feature Requests

When asking Claude to implement something, be specific about what you want. A good prompt includes:

- **What** you want to create
- **Where** it should fit in the architecture
- **Which patterns** to follow

**Example prompt:**
```
Add a Task entity with all the necessary code. Update the Axios client
using npm run generate-api and generate UI similar to Projects.
```

### 4. Reference Files and Folders

Improve Claude's responses by referencing specific files or folders. In VS Code:

1. Right-click on a file or folder in the Explorer
2. Select **Copy Path**
3. Paste the path into your chat message

**Example:**
```
Create a Tasks UI similar to the Projects section.
Reference: C:\git\instacrud\frontend\src\app\(admin)\(entities)\projects
```

This gives Claude explicit context about which patterns to follow.

### 5. Commit Frequently

AI-assisted development often involves iteration. Protect your progress with frequent commits:

1. When Claude generates a working solution (even partially), commit it
2. Use descriptive commit messages: `Add Task model and API endpoints`
3. This creates restore points if you need to roll back

**Workflow:**
```bash
# After each stable iteration
git add .
git commit -m "Add Task entity - basic implementation"

# If something breaks, you can easily reset
git checkout -- .
# or
git reset --hard HEAD~1
```

### 6. Automated Iteration (Use Mindfully)

Claude Code can run your code, observe errors, and iterate automatically until tests pass. This is powerful but comes with trade-offs:

**Advantages:**
- Faster development cycles
- Claude learns from error messages in real-time
- Less manual back-and-forth

**Considerations:**
- Consumes more tokens per session
- May hit rate limits on heavy usage
- Monitor your subscription usage

**Example prompt:**
```
Run tests using `poetry run python -m pytest test/run_all_test.py` and fix any failures. Keep iterating until all tests pass.
```

Use this approach for well-defined tasks with clear success criteria. For exploratory work or major features, a more interactive approach may be more efficient.

### 7. Screenshot-Driven Visual Debugging

The same iterate-until-done loop works especially well for visual bugs — and Claude doesn't need error messages to drive it. For layout problems, scrollbars, overlapping elements, and misaligned UI, just describe what you see. Claude will write a temporary Playwright debug spec that navigates to the page, takes a screenshot, and asserts the expected condition. It then reads the screenshot, identifies the root cause, applies the fix, and re-runs until the image is clean.

You don't write any test code. The workflow is entirely driven by a single prompt.

**Example prompt:**
```
The calendar has two vertical scrollbars when the window isn't huge — there should be only one.
Write a temporary debug spec similar to debug-calendar.spec.ts, take a screenshot and analyze it, fix the issue, and iterate until the screenshot looks clean.
```

Claude will handle writing the spec, running it, reading the screenshot, fixing the code, and iterating until done. See `test/e2e/debug-calendar.spec.ts` and `test/e2e/debug-signin.spec.ts` for examples of this pattern.

**Why screenshots work well as the feedback signal:**
- Claude gets direct visual feedback — no need to describe the bug precisely
- The assertion makes "done" unambiguous
- `fullPage: true` captures content below the fold, where layout bugs often hide

Use this for any visual issue: overflow, z-index stacking, popover positioning, responsive breakpoints.

### 8. Keep Dev Servers Running

Both FastAPI and Next.js excel at live-reloading during development. Keep them running throughout your vibecoding session:

- **FastAPI** — Automatically reloads when Python files change
- **Next.js** — Hot Module Replacement (HMR) updates the browser instantly

**Workflow:**
```bash
# In one terminal
cd backend && poetry run python instacrud/app.py

# In another terminal
cd frontend && npm run dev
```

Leave both servers running while Claude makes changes. You'll see updates reflected immediately without manual restarts. This creates a tight feedback loop where you can:

- Watch UI updates appear instantly in your browser
- Catch errors as they happen rather than discovering them later

This immediate feedback makes vibecoding significantly more productive—you can validate Claude's changes visually while the conversation continues.

---

## Example Workflow

Here's a complete workflow for adding a new entity:

1. **Open** the `instacrud` folder in VS Code
2. **Navigate** to an existing entity like `projects/` to understand the pattern
3. **Open** Claude Code and describe your feature:
   ```
   I want to add a "Task" entity that belongs to Projects.
   Each task has: title, description, status (todo/in_progress/done),
   due_date, and assigned_user.

   Please create:
   1. Backend model and API
   2. Run npm run generate-api to update the client
   3. Frontend pages following the Projects pattern

   Reference: C:\git\instacrud\frontend\src\app\(admin)\(entities)\projects
   ```
4. **Review** Claude's proposed changes before accepting
5. **Test** the implementation manually or ask Claude to run tests
6. **Commit** when you have a stable version
7. **Iterate** if adjustments are needed

---

## Tips for Better Results

- **Be specific** — "Add validation for email format" works better than "improve the form"
- **Show examples** — Reference existing code patterns you want to follow
- **Break down large tasks** — Implement features incrementally rather than all at once
- **Review generated code** — AI-generated code should be reviewed like any other code
- **Learn from output** — Use Claude's explanations to understand unfamiliar patterns

---

## Troubleshooting

### Claude Doesn't See My Files

- Ensure you opened the folder, not individual files
- Check that the file isn't in `.gitignore` (some tools skip ignored files)
- Try explicitly referencing the file path in your message

### Generated Code Doesn't Match Project Style

- Reference a specific file that demonstrates the correct pattern
- Be explicit: "Follow the exact same structure as `project_api.py`"

---

## Summary

Effective vibecoding with Claude Code:

1. **Open the full project** for complete context
2. **Provide reference files** to guide patterns
3. **Write specific prompts** describing what you want
4. **Commit frequently** to protect your progress
5. **Use automated iteration** mindfully, watching token usage
6. **Use screenshot-driven debugging** for visual bugs — describe it, Claude iterates until clean
7. **Keep dev servers running** to see changes immediately
8. **Review and learn** from generated code


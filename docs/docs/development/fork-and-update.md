---
sidebar_position: 1
title: Fork and Keep Updated
---

# How to Fork and Keep Updated

InstaCRUD is designed to be forked and customized while still receiving upstream updates. This guide explains how to maintain your fork and merge new features from the main repository.

---

## Why Fork?

Forking InstaCRUD gives you:

- **Full ownership** — Your code, your rules
- **Customization freedom** — Modify anything without restrictions
- **Update pathway** — Pull improvements from upstream
- **Contribution opportunity** — Submit fixes back to the community

---

## Initial Setup

### Step 1: Fork the Repository

1. Go to [InstaCRUD on GitHub](https://github.com/esng-one/instacrud)
2. Click **Fork** (top right)
3. Select your account/organization
4. Wait for fork to complete

### Step 2: Clone Your Fork

```bash
git clone https://github.com/YOUR_USERNAME/instacrud.git
cd instacrud
```

### Step 3: Add Upstream Remote

Link your fork to the original repository:

```bash
git remote add upstream https://github.com/esng-one/instacrud.git
git remote -v
```

You should see:

```
origin    https://github.com/YOUR_USERNAME/instacrud.git (fetch)
origin    https://github.com/YOUR_USERNAME/instacrud.git (push)
upstream  https://github.com/esng-one/instacrud.git (fetch)
upstream  https://github.com/esng-one/instacrud.git (push)
```

---

## Keeping Updated

### Method 1: GitHub Sync Button (Easiest)

1. Go to your fork on GitHub
2. Click **Sync fork** button
3. Click **Update branch**

This works when there are no conflicts.

### Method 2: Command Line

For more control or when conflicts exist:

```bash
# Fetch upstream changes
git fetch upstream

# Switch to main branch
git checkout main

# Merge upstream changes
git merge upstream/main

# Push to your fork
git push origin main
```

### Handling Merge Conflicts

When conflicts occur:

1. Git marks conflicting files
2. Open each file and resolve conflicts
3. Look for conflict markers:
   ```
   <<<<<<< HEAD
   Your changes
   =======
   Upstream changes
   >>>>>>> upstream/main
   ```
4. Edit to keep the correct code
5. Stage and commit:
   ```bash
   git add .
   git commit -m "Merge upstream/main, resolve conflicts"
   git push origin main
   ```

---

## Using Claude Code for Conflict Resolution

Claude Code can help resolve merge conflicts:

1. Run the merge command
2. When conflicts occur, ask Claude Code:
   ```
   Help me resolve merge conflicts in backend/instacrud/api/organization_api.py
   ```
3. Claude Code will analyze both versions and suggest resolutions
4. Or simply ask Claude to merge changes from upstream and resolve all conflicts

---

## Best Practices for Minimal Conflicts

1. Keep the folder structure unchanged where reasonable and Git will handle most merges automatically while conflicts are easily resolved by Claude Code. This is especially valuable on the frontend — maintain the structure and you can pull not only InstaCRUD updates but TailAdmin updates as well.

2. If you have important improvements, consider creating a Pull Request to include them in InstaCRUD so everyone benefits.

---

## Syncing Feature Branches

If you work on feature branches:

```bash
# Update main first
git checkout main
git fetch upstream
git merge upstream/main

# Rebase your feature branch
git checkout my-feature
git rebase main

# Or merge main into feature
git merge main
```

---

## Upstream Contribution

Found a bug or made an improvement? Contribute back! Before opening a pull request, please review the [Contribution Rules](./contribution-rules.md) — it covers what makes a good PR and what to include.

### Step 1: Create Feature Branch

```bash
git checkout main
git checkout -b fix/my-bugfix
```

### Step 2: Make Changes

Implement your fix or feature.

### Step 3: Push to Your Fork

```bash
git push origin fix/my-bugfix
```

### Step 4: Create Pull Request

1. Go to your fork on GitHub
2. Click **Compare & pull request**
3. Select `esng-one/instacrud` as base
4. Describe your changes
5. Submit the PR

---

## Versioning Your Fork

Consider tagging releases in your fork:

```bash
# Tag a release
git tag -a v1.0.0 -m "Initial customized release"
git push origin v1.0.0

# Tag after major customizations
git tag -a v1.1.0 -m "Added custom reporting module"
git push origin v1.1.0
```

This helps track which upstream version your customizations are based on.

---

## Troubleshooting

### "Divergent Branches" Error

```bash
# If branches have diverged significantly
git pull upstream main --rebase

# Or force sync (loses local changes on main)
git fetch upstream
git reset --hard upstream/main
git push origin main --force
```

### Large Merge Conflicts

For major version updates with many conflicts:

1. Create a backup branch: `git checkout -b backup-before-merge`
2. List all conflicts: `git diff --name-only --diff-filter=U`
3. Resolve one file at a time
4. Test thoroughly after each major resolution

### Accidentally Committed to Main

```bash
# Move commits to a feature branch
git checkout -b my-feature
git checkout main
git reset --hard upstream/main
```

---

## Summary

Maintaining a fork effectively:

1. **Set up upstream remote** after forking
2. **Sync regularly** to avoid large merge conflicts
3. **Extend rather than modify** core files
4. **Use separate directories** for custom code
5. **Contribute back** valuable improvements
6. **Tag releases** to track customization versions

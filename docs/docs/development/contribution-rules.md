---
sidebar_position: 2
title: Contribution Rules
---

# Contributing to InstaCRUD

Contributions are warmly welcomed! Whether you've fixed a bug, improved performance, or built something that could benefit everyone — we'd love to hear from you. This page explains how to contribute in a way that works well for everyone.

---

## The Philosophy

InstaCRUD aims to stay **generic and lightweight**. The goal is to be a solid foundation that anyone can fork and build upon — not a monolith that tries to do everything for everyone.

This means that highly specific features tailored to a particular industry, workflow, or niche use case may not be the right fit for the core project, even if they're well-built and useful to you. If your contribution is very domain-specific, forking and maintaining it separately is often the better path — and there's nothing wrong with that at all.

When in doubt, open an issue or discussion first to share your idea. We're happy to talk it through.

---

## Using AI for Development

We fully encourage using AI tools — including Claude Code — to help write code. AI can dramatically speed up development and help you produce well-structured code.

That said, please **do a careful manual review** before submitting. AI-generated code can occasionally introduce subtle issues, miss edge cases, or add unnecessary complexity. A quick read-through before opening a PR goes a long way toward keeping the codebase clean and trustworthy.

---

## Pull Request Guidelines

When you're ready to submit, please include:

- **A clear description** of what the change does and why it's useful
- **A screenshot or short video** if the change is visual or affects the UI — this makes review much easier and faster
- **All tests passing in live mode** — both backend and frontend tests should run and pass against a real environment before submission (not just in mock/unit mode). Running them locally with the app running is completely sufficient — no CI pipeline or staging server needed

The more context you provide, the smoother the review process will be for everyone.

---

## Upstream Contribution

The [Fork and Keep Updated](./fork-and-update.md#upstream-contribution) guide walks through the mechanics of creating a branch and opening a pull request against the main InstaCRUD repository.

Once your PR is open, we'll review it, may suggest some adjustments, and if it's a good fit — merge it in so the whole community benefits.

Thank you for contributing!

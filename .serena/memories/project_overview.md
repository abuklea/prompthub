# PromptHub - Project Overview

## Project Description
PromptHub is a centralized repository where users can efficiently store, organize, and manage their AI prompts, built with a modern, themeable, and responsive frontend.

## Current Development State

**Branch**: master (18 commits ahead of origin/master)  
**Last Major Commit**: db81a3b - "fix: P5S4 - Critical cache contamination and race condition bugs resolved"  
**Working Tree**: Clean  
**Primary Test User**: allan@formationmedia.net / *.Password123  
**Archon Project ID**: d449f266-1f36-47ad-bd2d-30f1a0f5e999

## Technology Stack

**Frontend**:
- Next.js 14.2.3 (Pages Router)
- React 18.3.1
- TypeScript 5.4.5
- Tailwind CSS 3.4.3
- Shadcn/UI components
- Framer Motion 11.2.4

**Backend**:
- Supabase (PostgreSQL + Auth + Storage + RLS)
- Prisma 6.19.0 (ORM)
- Next.js API routes

**State Management**:
- Zustand 4.5.2 (global state)
- React Hook Form 7.66.0 (forms)
- Zod 3.25.76 (validation)

**Development**:
- Node.js + npm
- ESLint + TypeScript strict mode
- Dev server port: 3010 (HMR active)

## Recent Major Developments (P5S4)

### Critical Cache Contamination & Race Condition Fixes

**P0 Priority Fixes**:
1. **P0T1**: Added promptIdRef guard to prevent stale localStorage saves during rapid tab switching
2. **P0T2**: Fixed ownership ref timing in cache hit path to prevent race conditions
3. **P0T3**: Implemented isTransitioning lock to guard cache updates during document transitions

**P1 Priority Fixes**:
4. **P1T4**: Disabled auto-save during document transitions
5. **P1T5**: Changed title type to string|null throughout system with getDisplayTitle utility

**Security Fixes**:
6. **P5S4T2**: User-scoped document cache with userId validation and logout clearing

**Performance Improvements**:
7. **P5S4T4**: Prevented duplicate database loads in React Strict Mode
8. **P5S4T5**: Added NODE_ENV guards to console.log statements

## Active PRPs (Product Requirements & Planning)

- **P5S4**: Fix cache, render loop, and security issues
- **P5S4e**: Improved document naming and save workflow

## Core Features

1. **Document Management**: Create, edit, save versions of AI prompts
2. **Folder Organization**: Hierarchical folder structure for organizing prompts
3. **Tabbed Editor**: Multi-document tabs with preview/permanent states
4. **Auto-Save**: 500ms debounce with localStorage persistence
5. **Version History**: Git-style diffs for version tracking
6. **User Authentication**: Supabase Auth with JWT and RLS policies
7. **Full-Text Search**: PostgreSQL tsvector for prompt search

## Critical Development Rules

**DO NOT**:
- Use TodoWrite (use Archon MCP server instead)
- Use placeholders or mock data in production code
- Implement backwards compatibility
- Use backslashes in paths
- Call `supabase start` (cloud Supabase only)
- Create triggers on auth.users table (Supabase Cloud restriction)

**ALWAYS**:
- Check Archon tasks before starting work
- Use forward slashes in paths
- Run lint/typecheck before commits
- Update task status in Archon
- Write tests (TDD approach, 80%+ coverage)
- Document complex logic
- Use real, production-ready data
- End files with newline character

## File Organization

**PRPs**: `./PRPs/` - Product requirements and planning documents  
**PRP Reports**: `./PRPs/reports/` - Initial and completion reports  
**Work in Progress**: `./wip/` - Testing, debugging, working files  
**Documentation**: `./docs/` - Project documentation and rules

## Development Workflow

1. Check Archon for current tasks
2. Update task status to `doing`
3. Research using RAG knowledge base
4. Implement with TDD approach
5. Run tests (80%+ coverage required)
6. Update task to `review`
7. Commit with proper prefix (feat/fix/refactor/etc.)
8. Mark task `done` in Archon

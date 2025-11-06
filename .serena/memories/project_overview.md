# PromptHub - Project Overview
Last Updated: 06/11/2025 19:56 GMT+10

## Purpose
PromptHub is a centralized repository application designed to help developers, researchers, and content creators efficiently store, organize, and manage their AI prompts. It provides a "GitHub for prompts" experience with version control, nested folders, and full-text search.

## Current Status
**Phase**: Phase 4 - Prompt Organization & Retrieval (In Progress)
**Completed**: Authentication, folder management with optimistic UI, basic prompt structure
**In Progress**: Prompt editor integration, version control system
**Next**: Monaco Editor integration, prompt editing, version history

## Implemented Features
✅ User authentication (sign up, sign in, sign out)
✅ Protected routes with middleware
✅ Nested folder organization with hierarchical structure
✅ Folder CRUD operations (create, rename, delete)
✅ Optimistic UI updates for instant feedback
✅ Toast notifications for user actions
✅ Basic prompt list component
✅ Theme support (dark/light mode)
✅ Responsive layout with three-pane design

## Pending Features
⏳ Monaco Editor integration for rich editing
⏳ Prompt content editing and saving
⏳ Git-style version control with diff-based versioning
⏳ Version history UI
⏳ Full-text search with indexed search capability
⏳ Tagging system for organization and filtering

## Technology Stack

### Frontend
- **Framework**: Next.js 14.2.3 (App Router)
- **React**: 18.3.1
- **TypeScript**: 5.4.5 (strict mode enabled)
- **Styling**: Tailwind CSS 3.4.3
- **UI Components**: Shadcn/UI (Button, Input, Card, Dropdown, Toast)
- **Animation**: Framer Motion 11.2.4
- **Editor**: Monaco Editor (pending integration)
- **Icons**: lucide-react

### Backend
- **Backend Logic**: Next.js Server Actions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with JWT
- **ORM**: Prisma 6.19.0
- **Security**: Row Level Security (RLS) policies
- **Notifications**: Sonner (toast notifications)

### State Management
- **Global State**: Zustand 4.5.2
- **Forms**: React Hook Form 7.66.0
- **Validation**: Zod 3.25.76
- **Themes**: next-themes 0.4.6

## Development Environment
- **Node.js** + npm
- **Dev Server Port**: 3010
- **Hot Module Replacement (HMR)**: Active
- **Platform**: Linux (WSL2)
- **Database**: Supabase Cloud (xmuysganwxygcsxwteil)
- **Project Root**: /home/allan/projects/PromptHub

## Recent Improvements
- Added instant folder refresh with optimistic UI updates (06/11/2025)
- Fixed hydration warnings from theme provider (06/11/2025)
- Added autocomplete attributes to form inputs (06/11/2025)
- Created favicon (SVG + ICO) (06/11/2025)
- Fixed db import issues (default vs named export) (06/11/2025)

# PromptHub - Project Overview

## Purpose
PromptHub is a centralized repository application designed to help developers, researchers, and content creators efficiently store, organize, and manage their AI prompts. It provides a "GitHub for prompts" experience with version control, nested folders, and full-text search.

## Core Features
- Nested folder organization with hierarchical structure
- Full-text search with indexed search capability
- Rich prompt editor powered by Monaco Editor (VS Code-like)
- Git-style version control with diff-based versioning
- Tagging system for organization and filtering
- Secure authentication with Supabase Auth
- Row Level Security (RLS) for data isolation

## Technology Stack

### Frontend
- **Framework**: Next.js 14.2.3 (App Router)
- **React**: 18.3.1
- **TypeScript**: 5.4.5 (strict mode enabled)
- **Styling**: Tailwind CSS 3.4.3
- **UI Components**: Shadcn/UI
- **Animation**: Framer Motion 11.2.4
- **Editor**: Monaco Editor

### Backend
- **Backend Logic**: Next.js Server Actions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with JWT
- **ORM**: Prisma 6.19.0
- **Security**: Row Level Security (RLS) policies

### State Management
- **Global State**: Zustand 4.5.2
- **Forms**: React Hook Form 7.66.0
- **Validation**: Zod 3.25.76
- **Themes**: next-themes 0.4.6

## Development Environment
- **Node.js** + npm
- **Dev Server Port**: 3010
- **Hot Module Replacement (HMR)**: Active
- **Platform**: Linux

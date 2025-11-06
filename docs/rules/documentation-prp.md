## PRP Document Footer Formatting Standards

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| PRP Document Footer Formatting Standards | 21/10/2025 14:16 GMT+10 | 21/10/2025 14:16 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Document Types](#document-types)
- [Common Fields](#common-fields)
- [Document-Specific Fields](#document-specific-fields)
- [Field Definitions](#field-definitions)
- [Formatting Rules](#formatting-rules)
- [Examples](#examples)
- [Validation Checklist](#validation-checklist)

## Overview

This document defines the required footer/sign-off section formatting for all PRP (Product Requirements & Planning) documents in the WalkingTours project. Consistent formatting ensures:

- Easy parsing and tracking of project status
- Clear identification of dependencies and relationships
- Accurate time and resource estimation
- Proper task assignment and agent recommendations

**FTE Definition**: Full-Time Employee (FTE) refers to the predicted/expected output from a single full-time developer working on the task.

## Document Types

The WalkingTours project uses four distinct PRP document types, each with specific footer requirements:

| Document Type | Location | Purpose | Filename Pattern |
|--------------|----------|---------|------------------|
| **PRP INITIAL** | `./PRPs/reports/` | Initial planning and task breakdown | `*-INITIAL.md` |
| **PRP REPORT** | `./PRPs/reports/` | Completion summary and results | `*-REPORT.md` |
| **PRP** | `./PRPs/` | Main implementation specification | `P#S#-*.md` |
| **WIP** | `./wip/` | Work-in-progress documentation | `P#S#-*.md` |

## Common Fields

These fields appear in **all** PRP document types:
----
| Field | Format | Required | Description |
|-------|--------|----------|-------------|
| **PRP Status** | Enum (see below) | Yes | Current status of the PRP |
| **PRP ID** | `P#S#` | Yes | Phase-Step identifier |
| **Archon Project** | `ProjectName (project-id)` | Yes | Archon MCP project reference |
| **PRP Document** | `PRPs/P#S#-*.md` | Yes | Path to main PRP document |
| **Tasks** | `# tasks (P#S#T#-P#S#T#)` | Yes | Task count and range |
| **Phase** | `Phase # - Description` | Yes | Project phase context |
| **Notes** | Markdown list | No | Important notes and context |

### PRP Status Values

| Status | Meaning | Used In |
|--------|---------|---------|
| `TODO` | Not yet started | INITIAL |
| `IN PROGRESS` | Currently being implemented | INITIAL, WIP |
| `REVIEW` | Awaiting review | INITIAL, WIP |
| `COMPLETE` | Fully implemented and tested | REPORT, PRP |
| `BLOCKED` | Blocked by dependencies | Any |

## Document-Specific Fields

### PRP INITIAL Reports

Additional fields for initial planning documents:

| Field | Format | Required | Description |
|-------|--------|----------|-------------|
| **Plan Status** | `REVIEW \| ACTIVE \| COMPLETE` | Yes | Planning phase status |
| **Dependencies** | `P#S# (Status)` or `None` | Yes | Prerequisite PRPs |
| **Implementation Status** | `NOT YET STARTED (P#S#)` | Yes | Code implementation status |
| **Testing Status** | `NOT YET TESTED` | Yes | Testing progress |
| **Next PRP** | `P#S# - Description` | Yes | Subsequent PRP reference |
| **Documentation** | Markdown list of paths | No | Related documentation files |
| **Recommendations** | Structured (see format) | Yes | Agent assignments and notes |
| **Estimated Implementation Time (FTE)** | `#-# hours` or `#-# days` | Yes | Time estimate for single FTE |

### PRP Completion REPORTS

Additional fields for completion summaries:

| Field | Format | Required | Description |
|-------|--------|----------|-------------|
| **Report Status** | `DRAFT \| FINAL \| ACTIVE` | Yes | Report completion status |
| **Dependencies** | `P#S# (Status)` or `None` | Yes | Prerequisite PRPs |
| **Implementation Status** | `COMPLETE (P#S#)` | Yes | Code implementation status |
| **Testing Status** | `COMPLETE (#/# tests passed)` | Yes | Testing results |
| **Next PRP** | `P#S# - Description` | Yes | Subsequent PRP reference |

### Main PRP Documents

Additional fields for main specification documents:

| Field | Format | Required | Description |
|-------|--------|----------|-------------|
| **Dependencies** | `P#S# (Status), ...` | Yes | Prerequisite PRPs (comma-separated) |
| **Next PRP** | `P#S# - Description` | Yes | Subsequent PRP reference |
| **Recommendations** | Structured (see format) | Yes | Agent assignments and notes |
| **Estimated Implementation Time (FTE)** | `#-# hours` or `#-# days` | Yes | Time estimate for single FTE |

### WIP Documents

Additional fields for work-in-progress documents:

| Field | Format | Required | Description |
|-------|--------|----------|-------------|
| **Implementation Status** | Status description | Yes | Current implementation state |
| **Testing Status** | Status description | Yes | Current testing state |

## Field Definitions

### Created / Last Modified
- **Format**: `dd/MM/yyyy HH:mm GMT+10`
- **Timezone**: Always GMT+10 (Australia/Brisbane)
- **Source**: Use `mcp__time__get_current_time` tool
- **Example**: `21/10/2025 14:16 GMT+10`

### Archon Project
- **Format**: `ProjectName (project-id)`
- **Example**: `WalkingTours (67f567de-8bee-4709-9e19-4123e693de61)`
- **Source**: Project configuration

### PRP Document
- **Format**: Relative path from project root
- **Example**: `PRPs/P2S8-implement-create-project-form.md`

### PRP ID
- **Format**: `P#S#` where # is a number
- **Pattern**: Phase-Step identifier
- **Example**: `P2S8`, `P1S1`, `P3S15`

### Tasks
- **Format**: `# tasks (P#S#T#-P#S#T#)` or `# tasks (P#S#T# - P#S#T#)`
- **Examples**:
  - `5 tasks (P1S1T1 - P1S1T5)`
  - `12 tasks (P2S8T1 - P2S8T12)`

### Phase
- **Format**: `Phase # - Description (Context)`
- **Examples**:
  - `Phase 1 - Research and planning (Report)`
  - `Phase 2 - Multi-Project Management (Web Portal)`

### Dependencies
- **Format**: `P#S# (Status), P#S# (Status)` or `None`
- **Examples**:
  - `None`
  - `P2S1 (Complete)`
  - `P2S7 (Complete), P2S6 (Complete), P2S5 (Complete)`

### Implementation Status
- **INITIAL Format**: `NOT YET STARTED (P#S#)`
- **REPORT Format**: `COMPLETE (P#S#)`
- **WIP Format**: Descriptive status
- **Examples**:
  - `NOT YET STARTED (P1S1)`
  - `COMPLETE (P2S8)`
  - `IN PROGRESS - 3/5 tasks complete`

### Testing Status
- **INITIAL Format**: `NOT YET TESTED`
- **REPORT Format**: `COMPLETE (#/# tests passed)`
- **WIP Format**: Descriptive status
- **Examples**:
  - `NOT YET TESTED`
  - `COMPLETE (10/10 tests passed)`
  - `IN PROGRESS - 7/10 tests passing`

### Recommendations
Structured format with agents and notes:

```markdown
**Recommendations:**
Agents:
- `agent-name` (Task range or description)
- `another-agent` (Task range or description)
Notes:**
- Important note about implementation
- Critical warning or requirement
- Unity-mcp availability check
```

**Example**:
```markdown
**Recommendations:**
Agents:
- `unity6-expert-developer` (Tasks 2-10, 12)
- `senior-backend-engineer` (Task 1)
- `qa-test-automation-engineer` (Task 11)
Notes:**
- T1 (API endpoints) with `senior-backend-engineer`
- T2-10 (Unity scripts) with `unity6-expert-developer` in parallel
- Use unity-mcp server; if not accessible, pause and report issue
```

### Estimated Implementation Time (FTE)
- **Format**: `#-# hours` or `#-# days` with optional context
- **Examples**:
  - `2-5 hours`
  - `25-30 hours (3-4 days)`
  - `1-2 days`

## Formatting Rules

### General Rules
1. **Separator**: Always use `---` (three hyphens) before footer section
2. **Bold Labels**: All field names must be in bold (`**Field Name**:`)
3. **Spacing**: Single space after colon before value
4. **Line Breaks**: No blank lines between fields
5. **Ordering**: Fields must appear in the order defined in this document
6. **Accuracy**: All timestamps must be in GMT+10 timezone
7. **Consistency**: Use exact field names and formats as specified

### Field Value Rules
1. **Enums**: Use exact values from defined enums (case-sensitive)
2. **Paths**: Use forward slashes (`/`), relative to project root
3. **IDs**: Follow `P#S#` and `P#S#T#` patterns exactly
4. **Timestamps**: Always use `dd/MM/yyyy HH:mm GMT+10` format
5. **Lists**: Use markdown list syntax with proper indentation
6. **References**: Always include full PRP ID in cross-references

### Markdown Rules
1. **Code Formatting**: Agent names in backticks (`` `agent-name` ``)
2. **Emphasis**: Use bold for field labels, regular text for values
3. **Lists**: Use `-` for bullet points with 2-space indentation
4. **Links**: Not required in footer sections
5. **Newlines**: End file with single newline character

## EXAMPLES

### EXAMPLE: Complete PRP INITIAL Footer

```markdown
----
**Plan Status**: READY
**PRP Status**: TODO
**PRP ID**: P2S9
**Archon Project**: WalkingTours (67f567de-8bee-4709-9e19-4123e693de61)
**PRP Document**: PRPs/P2S9-unity-core-architecture-rebuild.md
**Tasks**: 10 tasks (P2S9T1 - P2S9T10)
**Phase**: Phase 2 - Multi-Project Management (Unity)
**Dependencies**: P2S8 (Complete)
**Implementation Status**: NOT YET STARTED (P2S9)
**Testing Status**: NOT YET TESTED
**Next PRP**: P2S10 - Content Synchronization System
**Documentation**:
docs/guides/Unity6-ARFoundation.md
docs/guides/Unity-OdinInspector.md
**Recommendations:**
Agents:
- `unity6-expert-developer` (Tasks 1-10)
Notes:**
- Use unity-mcp server; if not accessible, pause and report issue
- Follow service-oriented architecture patterns
- Implement comprehensive error handling
**Estimated Implementation Time (FTE):** 25-30 hours (3-4 days)
```

### EXAMPLE: Complete PRP REPORT Footer

```markdown
----
**Report Status**: FINAL
**PRP Status**: COMPLETE
**PRP ID**: P2S8
**Archon Project**: WalkingTours (67f567de-8bee-4709-9e19-4123e693de61)
**PRP Document**: PRPs/P2S8-implement-create-project-form.md
**Tasks**: 12 tasks (P2S8T1 - P2S8T12)
**Phase**: Phase 2 - Multi-Project Management (Web Portal)
**Dependencies**: P2S7 (Complete), P2S6 (Complete)
**Implementation Status**: COMPLETE (P2S8)
**Testing Status**: COMPLETE (12/12 tests passed)
**Next PRP**: P2S9 - Unity Core Architecture Rebuild
Notes:**
- All form validation working correctly
- Server actions successfully integrated
- Comprehensive error handling implemented
```

### EXAMPLE: Complete Main PRP Footer

```markdown
----
**PRP Status**: COMPLETE
**PRP ID**: P2S8
**Archon Project**: WalkingTours (67f567de-8bee-4709-9e19-4123e693de61)
**Tasks**: 12 tasks (P2S8T1 - P2S8T12)
**Phase**: Phase 2 - Multi-Project Management (Web Portal)
**Dependencies**: P2S7 (Complete), P2S6 (Complete), P2S5 (Complete)
**Next PRP**: P2S9 - Unity Core Architecture Rebuild
**Recommendations:**
Agents:
- `senior-frontend-engineer` (Tasks 1-8)
- `senior-backend-engineer` (Tasks 9-10)
- `qa-test-automation-engineer` (Tasks 11-12)
Notes:**
- T1-8 (Form components) with `senior-frontend-engineer`
- T9-10 (Server actions) with `senior-backend-engineer` in parallel
- Follow Next.js 15 server action patterns
**Estimated Implementation Time (FTE):** 15-20 hours (2-3 days)
```

### EXAMPLE: Complete WIP Footer

```markdown
----
**PRP Document**: PRPs/P2S9-unity-core-architecture-rebuild.md
**PRP Status**: IN PROGRESS
**PRP ID**: P2S9
**Tasks**: 10 tasks (P2S9T1 - P2S9T10)
**Phase**: Phase 2 - Multi-Project Management (Unity)
**Implementation Status**: IN PROGRESS - 7/10 tasks complete
**Testing Status**: IN PROGRESS - 15/20 tests passing
Notes:**
- AuthenticationManager fully implemented and tested
- ContentSyncManager implementation in progress
- NetworkManager pending task start
```

## Validation Checklist

### Before Finalizing Any PRP Document

- [ ] Footer separator (`---`) present
- [ ] All required fields included for document type
- [ ] Field names exactly match specification (bold, correct spelling)
- [ ] Field order matches specification
- [ ] Timestamps in GMT+10 timezone
- [ ] Timestamp format: `dd/MM/yyyy HH:mm GMT+10`
- [ ] PRP ID follows `P#S#` pattern
- [ ] Task range follows `P#S#T#-P#S#T#` pattern
- [ ] Dependencies list complete (or explicitly `None`)
- [ ] Status values match defined enums
- [ ] Agent names in backticks
- [ ] Recommendations section properly formatted
- [ ] File ends with single newline character
- [ ] No blank lines between fields
- [ ] All paths use forward slashes
- [ ] Archon Project ID matches project configuration

### Document Type-Specific Checks

#### PRP INITIAL
- [ ] Plan Status present and valid
- [ ] Implementation Status = `NOT YET STARTED (P#S#)`
- [ ] Testing Status = `NOT YET TESTED`
- [ ] Estimated Implementation Time included
- [ ] Next PRP referenced

#### PRP REPORT
- [ ] Report Status present and valid
- [ ] Implementation Status = `COMPLETE (P#S#)`
- [ ] Testing Status shows pass/fail counts
- [ ] Results documented in notes section

#### Main PRP
- [ ] Estimated Implementation Time included
- [ ] Recommendations section complete
- [ ] Dependencies explicitly listed

#### WIP
- [ ] Implementation Status descriptive
- [ ] Testing Status descriptive
- [ ] Notes explain current work state


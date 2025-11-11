# PromptHub
## P5S5T7: Comprehensive Testing Guide - Bug Fixes Phase 5 Sprint 5

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| P5S5T7: Comprehensive Testing Guide - Bug Fixes Phase 5 Sprint 5 | 09/11/2025 18:15 GMT+10 | 09/11/2025 18:15 GMT+10 |

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Test Environment Setup](#test-environment-setup)
- [Test Scenarios](#test-scenarios)
  - [1. Optimistic Updates Performance](#1-optimistic-updates-performance)
  - [2. Cache Security Multi-User Testing](#2-cache-security-multi-user-testing)
  - [3. Duplicate Load Prevention](#3-duplicate-load-prevention)
  - [4. Request Reduction Validation](#4-request-reduction-validation)
- [Success Criteria](#success-criteria)
- [Known Issues](#known-issues)
- [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides comprehensive testing procedures for validating the bug fixes implemented in Phase 5 Sprint 5 (Tasks T3-T6).

**Fixed Issues:**
- **P5S5T3**: Optimistic updates (50-67% request reduction)
- **P5S5T5**: Cache security (multi-user isolation)
- **P5S5T6**: Duplicate database loads (dev-only)
- **P5S5T2**: Redundant database requests eliminated

**Testing Duration:** 1-2 hours
**Test User:** allan@formationmedia.net / *.Password123

---

## Prerequisites

### Required Tools
- Chrome DevTools Network tab
- Two separate browser profiles or incognito windows
- Developer console enabled
- React DevTools (optional but recommended)

### Test Accounts
You need **two test user accounts** to verify multi-user cache isolation:

- **User A**: allan@formationmedia.net / *.Password123
- **User B**: Create a second test account or use existing

### Environment
- Development server running: `npm run dev` on port 3010
- React Strict Mode: Enabled (default in development)
- Browser: Chrome/Edge recommended for DevTools

---

## Test Environment Setup

### 1. Clear Browser State
```bash
# Before starting tests:
1. Clear browser cache (Ctrl+Shift+Delete)
2. Clear localStorage (DevTools > Application > Local Storage > Clear All)
3. Close all tabs
4. Restart browser
```

### 2. Enable Network Monitoring
```bash
# Chrome DevTools:
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Disable cache" checkbox
4. Enable "Preserve log" checkbox
5. Filter by "Fetch/XHR" for API requests
```

### 3. Enable Console Logging
```bash
# Development mode logs are already enabled:
- [EditorPane] messages show cache operations
- [TabContent] messages show tab state
- Network requests visible in console
```

---

## Test Scenarios

### 1. Optimistic Updates Performance

**Objective:** Verify instant UI updates without loading states

#### Test 1.1: Document Creation
```markdown
STEPS:
1. Login as User A
2. Select a folder in left pane
3. Open Network tab, clear all requests
4. Click "+" button to create new document
5. Observe:
   - Document appears INSTANTLY in prompt list
   - Tab opens INSTANTLY in editor
   - No loading spinner visible
6. Check Network tab

EXPECTED:
- ✅ Document appears in UI immediately
- ✅ Exactly 1 POST request to create document
- ✅ No GET request to refetch folder
- ✅ No loading state visible
- ✅ Total requests: 1

ACTUAL:
- [ ] Pass / [ ] Fail
- Request count: _____
- Notes: _____________________
```

#### Test 1.2: Document Rename
```markdown
STEPS:
1. Select any document
2. Open Network tab, clear all requests
3. Click "Edit" button (pencil icon)
4. Enter new title: "Test Document Rename"
5. Click "Rename"
6. Observe:
   - Title updates INSTANTLY in prompt list
   - Tab title updates INSTANTLY
   - No loading spinner
7. Check Network tab

EXPECTED:
- ✅ Title updates immediately in UI
- ✅ Exactly 1 POST request to rename
- ✅ No GET request to refetch folder
- ✅ Total requests: 1

ACTUAL:
- [ ] Pass / [ ] Fail
- Request count: _____
- Notes: _____________________
```

#### Test 1.3: Document Delete
```markdown
STEPS:
1. Create a test document
2. Open Network tab, clear all requests
3. Click "Delete" button (trash icon)
4. Confirm deletion
5. Observe:
   - Document disappears INSTANTLY from list
   - Tab closes INSTANTLY
   - No loading spinner
6. Check Network tab

EXPECTED:
- ✅ Document removed immediately from UI
- ✅ Tab closed immediately
- ✅ Exactly 1 POST request to delete
- ✅ No GET request to refetch folder
- ✅ Total requests: 1

ACTUAL:
- [ ] Pass / [ ] Fail
- Request count: _____
- Notes: _____________________
```

#### Test 1.4: Error Reversion
```markdown
STEPS:
1. Disconnect internet or stop server
2. Try to rename a document
3. Observe behavior
4. Reconnect internet/restart server

EXPECTED:
- ✅ Title updates optimistically (instant)
- ✅ Error toast appears after server responds
- ✅ Title reverts to original after refetch
- ✅ UI shows correct state after revert

ACTUAL:
- [ ] Pass / [ ] Fail
- Notes: _____________________
```

---

### 2. Cache Security Multi-User Testing

**Objective:** Verify complete cache isolation between users

#### Test 2.1: Basic Cache Isolation
```markdown
STEPS:
1. Login as User A in Browser Profile 1
2. Open several documents (3-5)
3. Note the document titles and content
4. Logout User A
5. Login as User B in same browser profile
6. Navigate to folders and open documents
7. Observe User B's documents

EXPECTED:
- ✅ User B sees ONLY their own documents
- ✅ No User A documents appear in list
- ✅ No User A content shown in editor
- ✅ Cache completely cleared on logout

ACTUAL:
- [ ] Pass / [ ] Fail
- Found User A data: [ ] Yes / [ ] No
- Notes: _____________________
```

#### Test 2.2: Concurrent Session Testing
```markdown
STEPS:
1. Open Browser Profile 1 (Chrome)
2. Login as User A
3. Open document "Doc A" with content "User A Content"
4. Open Browser Profile 2 (Chrome Incognito)
5. Login as User B
6. Open document "Doc B" with content "User B Content"
7. Switch between browsers, edit documents
8. Check console logs for cache keys

EXPECTED:
- ✅ User A cache keys: "userA-id-{promptId}"
- ✅ User B cache keys: "userB-id-{promptId}"
- ✅ No cross-contamination in console logs
- ✅ Each user only sees their own content

ACTUAL:
- [ ] Pass / [ ] Fail
- Cache key format correct: [ ] Yes / [ ] No
- Notes: _____________________
```

#### Test 2.3: Logout Cache Clearing
```markdown
STEPS:
1. Login as User A
2. Open 5 documents
3. Open DevTools Console
4. Type: localStorage
5. Note cache entries
6. Click "Sign Out" button
7. Check console log for "[EditorPane] Document cache cleared"
8. Check localStorage again

EXPECTED:
- ✅ Console shows cache cleared message
- ✅ Cache Map is empty after logout
- ✅ No document data persists in memory

ACTUAL:
- [ ] Pass / [ ] Fail
- Cache cleared: [ ] Yes / [ ] No
- Notes: _____________________
```

---

### 3. Duplicate Load Prevention

**Objective:** Verify no duplicate database requests in React Strict Mode

#### Test 3.1: First Document Open
```markdown
STEPS:
1. Ensure React Strict Mode enabled (development)
2. Refresh page (F5)
3. Login
4. Open Network tab, clear all requests
5. Select a folder
6. Click on first document to open
7. Count database requests

EXPECTED:
- ✅ Exactly 1 GET request for document details
- ✅ No duplicate requests visible
- ✅ Console shows single "Loading from database" log
- ✅ AbortController cancels duplicate fetch

ACTUAL:
- [ ] Pass / [ ] Fail
- Request count: _____
- Console logs count: _____
- Notes: _____________________
```

#### Test 3.2: Rapid Tab Switching
```markdown
STEPS:
1. Open 5 documents in tabs
2. Open Network tab, clear all requests
3. Rapidly click between tabs (1→2→3→4→5→1)
4. Check Network tab for requests
5. Check console logs

EXPECTED:
- ✅ Cache hits show "Loading from cache"
- ✅ No database requests for cached documents
- ✅ Instant switching with no loading states
- ✅ No AbortController errors in console

ACTUAL:
- [ ] Pass / [ ] Fail
- Database requests: _____
- Cache hits: _____
- Notes: _____________________
```

---

### 4. Request Reduction Validation

**Objective:** Measure and verify 60-70% overall request reduction

#### Test 4.1: Baseline Measurement (Old Code)
```markdown
This is for reference - you're testing NEW code.
Old behavior (before fixes):
- Create: 3 requests (create + refetch folder + open)
- Rename: 2 requests (rename + refetch folder)
- Delete: 2 requests (delete + refetch folder)
- Selection: 1-2 requests (details + sometimes duplicate)
```

#### Test 4.2: Current Measurement (New Code)
```markdown
STEPS:
1. Clear Network tab
2. Perform 10 operations:
   - Create 3 documents
   - Rename 3 documents
   - Delete 2 documents
   - Select 2 existing documents
3. Count total requests
4. Calculate reduction

EXPECTED TOTAL:
- 3 creates × 1 req = 3 requests
- 3 renames × 1 req = 3 requests
- 2 deletes × 1 req = 2 requests
- 2 selections × 1 req = 2 requests
- Total: 10 requests

OLD TOTAL (for comparison):
- 3 creates × 3 req = 9 requests
- 3 renames × 2 req = 6 requests
- 2 deletes × 2 req = 4 requests
- 2 selections × 1-2 req = 2-4 requests
- Total: 21-23 requests

REDUCTION: ~54-57% fewer requests

ACTUAL:
- [ ] Pass / [ ] Fail
- Total requests: _____
- Reduction %: _____
- Notes: _____________________
```

---

## Success Criteria

### Performance ✅
- [ ] All mutations complete in <100ms (UI time)
- [ ] No loading spinners during optimistic updates
- [ ] Cache hits load instantly (<10ms)
- [ ] Database requests reduced by 50-70%

### Security ✅
- [ ] Zero cross-user cache contamination
- [ ] Cache cleared on logout
- [ ] User-scoped cache keys verified
- [ ] No privacy violations detected

### Functionality ✅
- [ ] All document operations work correctly
- [ ] Error handling reverts optimistic updates
- [ ] No infinite loops or crashes
- [ ] React Strict Mode duplicate fetches prevented

### User Experience ✅
- [ ] UI feels instant and responsive
- [ ] No unexpected loading states
- [ ] Smooth tab switching
- [ ] Proper error messages on failures

---

## Known Issues

### Expected Warnings
```javascript
// This warning is INTENTIONAL - localContent excluded from deps
Warning: React Hook useEffect has a missing dependency: 'localContent'
// Reason: Prevents circular dependency and race conditions
```

### Development Mode Behavior
- React Strict Mode causes double-mounting in development
- AbortController handles duplicate fetches gracefully
- Production build will not have double-mounting

---

## Troubleshooting

### Issue: Optimistic update not reverting on error
```markdown
CAUSE: triggerPromptRefetch() not called in error handler
FIX: Check DocumentToolbar.tsx error handlers have refetch call
```

### Issue: Cache not clearing on logout
```markdown
CAUSE: clearDocumentCache() not called or called too late
FIX: Check Header.tsx handleSignOut() calls clearDocumentCache()
DEBUG: Add console.log in clearDocumentCache() to verify execution
```

### Issue: Still seeing duplicate requests
```markdown
CAUSE: AbortController not properly implemented
FIX: Check EditorPane.tsx has cleanup function that calls abort()
DEBUG: Add console.log in cleanup to verify it runs
```

### Issue: Cross-user contamination detected
```markdown
CAUSE: Cache key not including userId
FIX: Verify all cache.get/set use ${userId}-${promptId} format
DEBUG: Check console logs for cache key format
LOCATIONS: EditorPane.tsx lines 165, 325, 392
```

---

## Test Report Template

```markdown
## Test Execution Report
**Date:** _________________
**Tester:** _________________
**Environment:** Development (port 3010)

### Test Results Summary
- Total Tests: 15
- Passed: _____
- Failed: _____
- Blocked: _____

### Performance Metrics
- Request reduction: _____%
- Average operation time: _____ms
- Cache hit rate: _____%

### Issues Found
1. _____________________
2. _____________________

### Recommendations
_____________________

### Sign-off
- [ ] All tests passed
- [ ] Ready for production
- [ ] Issues documented in PRP
```

---

**Testing Complete:** [ ] Yes / [ ] No
**Next Steps:** Mark P5S5T7 as complete in Archon and update PRP document

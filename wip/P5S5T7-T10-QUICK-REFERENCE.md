# P5S5T7-T10 QUICK REFERENCE CARD

## TESTING STATUS: ✅ READY TO BEGIN

---

## SERVER
```
URL: http://localhost:3010
Status: RUNNING ✅
Login: allan@formationmedia.net / *.Password123
```

---

## TESTS (70 minutes total)

### T7: New Document Creation (15 min)
**WATCH**: localStorage when clicking "New Doc"  
**CRITICAL**: New doc must be EMPTY (not show old content)

### T8: Rapid Tab Switching (20 min)
**WATCH**: Content during rapid A→B→C switches  
**CRITICAL**: No flashing, no mixed content

### T9: localStorage Isolation (15 min)
**WATCH**: localStorage keys during ALL operations  
**CRITICAL**: Keys NEVER overwrite each other

### T10: Cache Isolation (20 min)
**WATCH**: Console logs `[CACHE UPDATE]`  
**CRITICAL**: promptId MUST match content  
**CLEANUP**: Remove debug logging after test

---

## PASS/FAIL CRITERIA

**PASS** = All 4 tests meet ALL criteria  
**FAIL** = Any test fails ANY criterion  
**BLOCKED** = Cannot complete tests

---

## DOCUMENTS

**Test Guide** (detailed protocols):  
`/home/allan/projects/PromptHub/wip/P5S5T7-T10-manual-test-execution-report.md`

**Code Analysis** (implementation verification):  
`/home/allan/projects/PromptHub/wip/P5S5T7-T10-code-verification-analysis.md`

**Summary** (this reference):  
`/home/allan/projects/PromptHub/wip/P5S5T7-T10-testing-ready-summary.md`

---

## BROWSER SETUP

1. Open: http://localhost:3010
2. Login: allan@formationmedia.net / *.Password123
3. Press F12 (DevTools)
4. Open: Console tab + Application → Local Storage

---

## AFTER TESTING

**IF PASS ✅**: Update Archon → Commit → Report  
**IF FAIL ❌**: Document → Report → Wait for fix → Re-test  
**IF BLOCKED 🚫**: Fix environment → Restart

---

## EXPECTED RESULT: ✅ ALL TESTS PASS
## CONFIDENCE: 95% (code verified)
## TIME: ~2 hours (testing + documentation)

---

**START TESTING**: Follow test execution guide

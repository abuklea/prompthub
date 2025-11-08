# PromptHub - P5S4T4 Markdown Actions Test Execution Plan

## Test Session Information
- **Date**: 07/11/2025 21:00 GMT+10
- **Tester**: QA Test Automation Engineer (Agent)
- **Test Environment**: http://localhost:3010/dashboard
- **Test User**: allan@formationmedia.net / *.Password123
- **Browser**: Chrome (via chrome-devtools-mcp)
- **PRP**: P5S4 - Editor UI with Manual Save
- **Task**: P5S4T4 - Functional Testing of Markdown Actions

## Pre-Test Verification
- [x] Dev server running on port 3010
- [x] Editor.tsx font size: 13px (T1 complete)
- [x] markdown-actions.ts created (T2 complete)
- [x] Actions integrated into Editor.tsx (T3 complete)
- [ ] Browser navigation to dashboard
- [ ] User authentication verified
- [ ] Prompt opened in editor
- [ ] Console cleared for error monitoring

## Test Matrix Overview
Total Tests: 12 categories with 35+ individual test cases
- Bold (3 scenarios)
- Italic (3 scenarios)
- Headings (6 scenarios)
- Code Inline (2 scenarios)
- Code Block (2 scenarios)
- Bullet List (3 scenarios)
- Numbered List (3 scenarios)
- Blockquote (3 scenarios)
- Insert Link (2 scenarios)
- Insert Table (2 scenarios)
- Context Menu (3 scenarios)
- Edge Cases (3 scenarios)

## Detailed Test Scenarios

### Test 1: Bold (Ctrl+B) - 3 scenarios
**Action**: markdown.bold
**Keybinding**: Ctrl+B (2048 | 32)

#### Scenario 1.1: Bold with Selection
- **Steps**:
  1. Type "hello world" in editor
  2. Select text "world"
  3. Press Ctrl+B
- **Expected Result**: "hello **world**"
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**: 

#### Scenario 1.2: Bold without Selection
- **Steps**:
  1. Position cursor in empty area
  2. Press Ctrl+B
- **Expected Result**: "**bold**" inserted with cursor between asterisks (position: column + 2)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 1.3: Bold Toggle (Remove Formatting)
- **Steps**:
  1. Select text "**bold**" (including asterisks)
  2. Press Ctrl+B
- **Expected Result**: "bold" (asterisks removed)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 2: Italic (Ctrl+I) - 3 scenarios
**Action**: markdown.italic
**Keybinding**: Ctrl+I (2048 | 39)

#### Scenario 2.1: Italic with Selection
- **Steps**:
  1. Type "hello world" in editor
  2. Select text "world"
  3. Press Ctrl+I
- **Expected Result**: "hello *world*"
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 2.2: Italic without Selection
- **Steps**:
  1. Position cursor in empty area
  2. Press Ctrl+I
- **Expected Result**: "*italic*" inserted with cursor between asterisks
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 2.3: Italic Toggle (Remove Formatting)
- **Steps**:
  1. Select text "*italic*" (including asterisks)
  2. Press Ctrl+I
- **Expected Result**: "italic" (asterisks removed)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 3: Headings (Ctrl+1, Ctrl+2, Ctrl+3) - 6 scenarios
**Actions**: markdown.heading1, markdown.heading2, markdown.heading3
**Keybindings**: Ctrl+1 (2048 | 22), Ctrl+2 (2048 | 23), Ctrl+3 (2048 | 24)

#### Scenario 3.1: Heading 1 - Add
- **Steps**:
  1. Type "Title" on a line
  2. Place cursor anywhere on that line
  3. Press Ctrl+1
- **Expected Result**: "# Title"
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 3.2: Heading 1 - Toggle Remove
- **Steps**:
  1. Line contains "# Title"
  2. Place cursor on that line
  3. Press Ctrl+1
- **Expected Result**: "Title" (heading removed)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 3.3: Heading Level Replacement (H1 to H2)
- **Steps**:
  1. Line contains "# Title"
  2. Place cursor on that line
  3. Press Ctrl+2
- **Expected Result**: "## Title" (replaced, not "## # Title")
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 3.4: Heading 2 - Add
- **Steps**:
  1. Type "Subtitle" on a line
  2. Place cursor on that line
  3. Press Ctrl+2
- **Expected Result**: "## Subtitle"
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 3.5: Heading 3 - Add
- **Steps**:
  1. Type "Section" on a line
  2. Place cursor on that line
  3. Press Ctrl+3
- **Expected Result**: "### Section"
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 3.6: Heading Level Replacement (H3 to H1)
- **Steps**:
  1. Line contains "### Section"
  2. Press Ctrl+1
- **Expected Result**: "# Section"
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 4: Code Inline (Ctrl+`) - 2 scenarios
**Action**: markdown.codeInline
**Keybinding**: Ctrl+` (2048 | 88)

#### Scenario 4.1: Inline Code with Selection
- **Steps**:
  1. Type and select "console.log"
  2. Press Ctrl+`
- **Expected Result**: "`console.log`"
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 4.2: Inline Code without Selection
- **Steps**:
  1. Position cursor in empty area
  2. Press Ctrl+`
- **Expected Result**: "`code`" inserted with cursor inside backticks
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 5: Code Block (Ctrl+Shift+C) - 2 scenarios
**Action**: markdown.codeBlock
**Keybinding**: Ctrl+Shift+C (2048 | 1024 | 33)

#### Scenario 5.1: Code Block with Selection
- **Steps**:
  1. Type multiple lines:
     ```
     function test() {
       return true
     }
     ```
  2. Select all lines
  3. Press Ctrl+Shift+C
- **Expected Result**: 
  ````
  ```
  function test() {
    return true
  }
  ```
  ````
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 5.2: Code Block without Selection
- **Steps**:
  1. Position cursor in empty area
  2. Press Ctrl+Shift+C
- **Expected Result**: 
  ````
  ```
  code
  ```
  ````
  With cursor after opening backticks (position: column + 3)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 6: Bullet List (Ctrl+Shift+8) - 3 scenarios
**Action**: markdown.bulletList
**Keybinding**: Ctrl+Shift+8 (2048 | 1024 | 29)

#### Scenario 6.1: Add Bullet List
- **Steps**:
  1. Type three lines:
     ```
     Item 1
     Item 2
     Item 3
     ```
  2. Select all three lines
  3. Press Ctrl+Shift+8
- **Expected Result**: 
  ```
  - Item 1
  - Item 2
  - Item 3
  ```
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 6.2: Toggle Remove Bullets
- **Steps**:
  1. Start with bullet list:
     ```
     - Item 1
     - Item 2
     - Item 3
     ```
  2. Select all lines
  3. Press Ctrl+Shift+8
- **Expected Result**: 
  ```
  Item 1
  Item 2
  Item 3
  ```
  (Bullets removed)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 6.3: Replace Numbered with Bullets
- **Steps**:
  1. Start with numbered list:
     ```
     1. Item 1
     2. Item 2
     3. Item 3
     ```
  2. Select all lines
  3. Press Ctrl+Shift+8
- **Expected Result**: 
  ```
  - Item 1
  - Item 2
  - Item 3
  ```
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 7: Numbered List (Ctrl+Shift+7) - 3 scenarios
**Action**: markdown.numberedList
**Keybinding**: Ctrl+Shift+7 (2048 | 1024 | 28)

#### Scenario 7.1: Add Numbered List
- **Steps**:
  1. Type three lines:
     ```
     Item 1
     Item 2
     Item 3
     ```
  2. Select all lines
  3. Press Ctrl+Shift+7
- **Expected Result**: 
  ```
  1. Item 1
  2. Item 2
  3. Item 3
  ```
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 7.2: Toggle Remove Numbering
- **Steps**:
  1. Start with numbered list:
     ```
     1. Item 1
     2. Item 2
     3. Item 3
     ```
  2. Select all lines
  3. Press Ctrl+Shift+7
- **Expected Result**: 
  ```
  Item 1
  Item 2
  Item 3
  ```
  (Numbering removed)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 7.3: Replace Bullets with Numbered
- **Steps**:
  1. Start with bullet list:
     ```
     - Item 1
     - Item 2
     - Item 3
     ```
  2. Select all lines
  3. Press Ctrl+Shift+7
- **Expected Result**: 
  ```
  1. Item 1
  2. Item 2
  3. Item 3
  ```
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 8: Blockquote (Ctrl+Shift+.) - 3 scenarios
**Action**: markdown.blockquote
**Keybinding**: Ctrl+Shift+. (2048 | 1024 | 88)

#### Scenario 8.1: Add Blockquote
- **Steps**:
  1. Type "This is a quote"
  2. Place cursor on line
  3. Press Ctrl+Shift+.
- **Expected Result**: "> This is a quote"
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 8.2: Toggle Remove Blockquote
- **Steps**:
  1. Line contains "> This is a quote"
  2. Place cursor on line
  3. Press Ctrl+Shift+.
- **Expected Result**: "This is a quote" (prefix removed)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 8.3: Multi-line Blockquote
- **Steps**:
  1. Type multiple lines:
     ```
     Line 1
     Line 2
     Line 3
     ```
  2. Select all lines
  3. Press Ctrl+Shift+.
- **Expected Result**: 
  ```
  > Line 1
  > Line 2
  > Line 3
  ```
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 9: Insert Link (Ctrl+K) - 2 scenarios
**Action**: markdown.insertLink
**Keybinding**: Ctrl+K (2048 | 41)

#### Scenario 9.1: Insert Link with Selection
- **Steps**:
  1. Type and select "GitHub"
  2. Press Ctrl+K
- **Expected Result**: "[GitHub](url)" with "url" selected for immediate replacement
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**: Verify cursor/selection position at "url"

#### Scenario 9.2: Insert Link without Selection
- **Steps**:
  1. Position cursor in empty area
  2. Press Ctrl+K
- **Expected Result**: "[text](url)" with "url" selected
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**: Verify cursor/selection position at "url"

---

### Test 10: Insert Table (Context Menu) - 2 scenarios
**Action**: markdown.insertTable
**Keybinding**: None (context menu only)

#### Scenario 10.1: Insert Table via Context Menu
- **Steps**:
  1. Right-click in editor
  2. Navigate to "Markdown" submenu
  3. Click "Insert Table"
- **Expected Result**: 3x3 table template inserted:
  ```
  | Header 1 | Header 2 | Header 3 |
  |----------|----------|----------|
  | Cell 1   | Cell 2   | Cell 3   |
  | Cell 4   | Cell 5   | Cell 6   |
  ```
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 10.2: Cursor Position after Table Insert
- **Steps**:
  1. Insert table via context menu
  2. Check cursor position
- **Expected Result**: Cursor at position column + 2 (inside first header cell)
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 11: Context Menu Integration - 3 scenarios

#### Scenario 11.1: Context Menu Exists
- **Steps**:
  1. Right-click anywhere in editor
  2. Look for "Markdown" submenu
- **Expected Result**: "Markdown" group appears in context menu
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 11.2: All Actions Present
- **Steps**:
  1. Right-click in editor
  2. Expand "Markdown" submenu
  3. Count visible actions
- **Expected Result**: All 12 actions visible:
  1. Bold
  2. Italic
  3. Inline Code
  4. Code Block
  5. Heading 1
  6. Heading 2
  7. Heading 3
  8. Bullet List
  9. Numbered List
  10. Blockquote
  11. Insert Link
  12. Insert Table
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

#### Scenario 11.3: Context Menu Order
- **Steps**:
  1. Open context menu
  2. Verify action order matches contextMenuOrder
- **Expected Result**: Actions appear in order 1-12
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**:

---

### Test 12: Edge Cases - 3 scenarios

#### Scenario 12.1: Empty Editor - All Actions
- **Steps**:
  1. Start with completely empty editor
  2. Test each action (Bold, Italic, Code, etc.)
- **Expected Result**: No errors, placeholders inserted correctly
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**: Check console for errors

#### Scenario 12.2: Large Text Block Performance
- **Steps**:
  1. Paste 500+ lines of text
  2. Select all
  3. Apply bullet list action (Ctrl+Shift+8)
  4. Measure response time
- **Expected Result**: Action completes in < 1 second, no lag
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**: Performance metric

#### Scenario 12.3: Undo/Redo (Ctrl+Z)
- **Steps**:
  1. Apply bold action (Ctrl+B)
  2. Apply italic action (Ctrl+I)
  3. Press Ctrl+Z twice
- **Expected Result**: Both actions undo correctly, editor returns to original state
- **Actual Result**: [PENDING]
- **Status**: [PASS/FAIL]
- **Notes**: Monaco undo stack integration

---

## Console Error Monitoring

### Browser Console Check Points
- [ ] Before test session start
- [ ] After each test category (1-12)
- [ ] After edge case testing
- [ ] Final check before report completion

### Expected Console Output
- No errors
- No warnings
- Monaco initialization messages (acceptable)
- Supabase auth messages (acceptable)

### Error Tracking
| Test # | Console Errors | Warnings | Critical? |
|--------|---------------|----------|-----------|
| 1      | [NONE]        | [NONE]   | N/A       |
| 2      | [NONE]        | [NONE]   | N/A       |
| 3      | [NONE]        | [NONE]   | N/A       |
| 4      | [NONE]        | [NONE]   | N/A       |
| 5      | [NONE]        | [NONE]   | N/A       |
| 6      | [NONE]        | [NONE]   | N/A       |
| 7      | [NONE]        | [NONE]   | N/A       |
| 8      | [NONE]        | [NONE]   | N/A       |
| 9      | [NONE]        | [NONE]   | N/A       |
| 10     | [NONE]        | [NONE]   | N/A       |
| 11     | [NONE]        | [NONE]   | N/A       |
| 12     | [NONE]        | [NONE]   | N/A       |

---

## Test Execution Checklist

### Pre-Execution
- [ ] Dev server confirmed running (port 3010)
- [ ] Browser opened to dashboard
- [ ] User authenticated
- [ ] Prompt opened/created in editor
- [ ] Console cleared
- [ ] DevTools open (F12)

### During Execution
- [ ] Execute tests in order (1-12)
- [ ] Document each result immediately
- [ ] Take screenshots of failures
- [ ] Copy console errors for failures
- [ ] Note unexpected behaviors

### Post-Execution
- [ ] Review all test results
- [ ] Calculate pass/fail statistics
- [ ] Document all issues found
- [ ] Provide reproduction steps for failures
- [ ] Check regression criteria
- [ ] Generate final test report

---

## Success Criteria Checklist
- [ ] All 12 actions work as specified
- [ ] Toggle behaviors function correctly (bold, italic, lists, headings, blockquote)
- [ ] Keyboard shortcuts recognized and respond correctly
- [ ] Context menu displays all 12 actions under "Markdown" group
- [ ] Edge cases handled properly (empty editor, large text, undo)
- [ ] No console errors during testing
- [ ] No visual regressions from P5S3b/P5S3d
- [ ] Font size confirmed at 13px
- [ ] All actions complete in < 1 second

---

## Test Results Summary
**Status**: [PENDING]
**Total Tests**: 35+
**Passed**: [0]
**Failed**: [0]
**Blocked**: [0]
**Pass Rate**: [0%]

**Console Errors**: [0]
**Warnings**: [0]
**Critical Issues**: [0]

**Overall Assessment**: [PENDING]

**Ready for T5 (Final Verification)**: [YES/NO]

---

## Notes and Observations
[To be filled during testing]

---

## Test Sign-off
**Tester**: QA Test Automation Engineer Agent
**Date**: 07/11/2025
**Status**: Test execution in progress

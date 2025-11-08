# P5S4T4 - Quick Test Execution Guide

## 🚀 Quick Start
```bash
# 1. Verify server (should already be running)
ps aux | grep next-server

# 2. Open browser to:
http://localhost:3010/dashboard

# 3. Login credentials:
Email: allan@formationmedia.net
Password: *.Password123
```

## ⌨️ Keyboard Shortcuts to Test

| Action | Shortcut | Expected Behavior |
|--------|----------|-------------------|
| **Bold** | Ctrl+B | Wrap in `**text**` or toggle |
| **Italic** | Ctrl+I | Wrap in `*text*` or toggle |
| **Heading 1** | Ctrl+1 | Add/toggle `# ` |
| **Heading 2** | Ctrl+2 | Add/toggle `## ` |
| **Heading 3** | Ctrl+3 | Add/toggle `### ` |
| **Inline Code** | Ctrl+` | Wrap in `` `text` `` |
| **Code Block** | Ctrl+Shift+C | Wrap in triple backticks |
| **Bullet List** | Ctrl+Shift+8 | Add/toggle `- ` prefix |
| **Numbered List** | Ctrl+Shift+7 | Add/toggle `1. ` prefix |
| **Blockquote** | Ctrl+Shift+. | Add/toggle `> ` prefix |
| **Insert Link** | Ctrl+K | Insert `[text](url)` |
| **Insert Table** | Right-click menu | Insert 3x3 table |

## ✅ Quick Test Checklist

### For Each Action:
1. **With Selection**: Select text → Apply action → Verify result
2. **Without Selection**: Empty cursor → Apply action → Verify placeholder
3. **Toggle**: Apply twice → Verify formatting removed

### Context Menu:
1. Right-click in editor
2. Find "Markdown" submenu
3. Verify 12 actions present
4. Verify correct order

### Edge Cases:
1. Empty editor → Test all actions
2. Large text (500+ lines) → Test list actions
3. Undo (Ctrl+Z) → Verify actions reverse

## 📊 Results Tracking

Copy this template for quick notes:

```
BOLD (Ctrl+B):
  ✅/❌ With selection:
  ✅/❌ Without selection:
  ✅/❌ Toggle:

ITALIC (Ctrl+I):
  ✅/❌ With selection:
  ✅/❌ Without selection:
  ✅/❌ Toggle:

HEADING 1 (Ctrl+1):
  ✅/❌ Add:
  ✅/❌ Toggle:
  ✅/❌ Replace:

HEADING 2 (Ctrl+2):
  ✅/❌ Add:
  ✅/❌ Replace:

HEADING 3 (Ctrl+3):
  ✅/❌ Add:
  ✅/❌ Replace:

INLINE CODE (Ctrl+`):
  ✅/❌ With selection:
  ✅/❌ Without selection:

CODE BLOCK (Ctrl+Shift+C):
  ✅/❌ With selection:
  ✅/❌ Without selection:

BULLET LIST (Ctrl+Shift+8):
  ✅/❌ Add:
  ✅/❌ Toggle:
  ✅/❌ Replace numbered:

NUMBERED LIST (Ctrl+Shift+7):
  ✅/❌ Add:
  ✅/❌ Toggle:
  ✅/❌ Replace bullets:

BLOCKQUOTE (Ctrl+Shift+.):
  ✅/❌ Add:
  ✅/❌ Toggle:
  ✅/❌ Multi-line:

INSERT LINK (Ctrl+K):
  ✅/❌ With selection:
  ✅/❌ Without selection:

INSERT TABLE (Context Menu):
  ✅/❌ Insert:
  ✅/❌ Cursor position:

CONTEXT MENU:
  ✅/❌ Menu exists:
  ✅/❌ 12 actions present:
  ✅/❌ Correct order:

EDGE CASES:
  ✅/❌ Empty editor:
  ✅/❌ Large text performance:
  ✅/❌ Undo/Redo:

CONSOLE ERRORS: [NONE / list errors]
```

## 🐛 If You Find Issues

Document:
1. **Action**: Which action failed
2. **Input**: What you typed/selected
3. **Expected**: What should happen
4. **Actual**: What actually happened
5. **Console**: Any errors in DevTools
6. **Reproduction**: Step-by-step to reproduce

## 📝 Final Report Location

Update results in:
```
/home/allan/projects/PromptHub/wip/P5S4T4-markdown-actions-test-report.md
```

## ⏱️ Estimated Time
- **Setup**: 2 minutes
- **Testing**: 30-40 minutes
- **Documentation**: 5 minutes
- **Total**: ~45 minutes

Good luck! 🚀

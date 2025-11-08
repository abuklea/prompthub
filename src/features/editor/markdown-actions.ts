/*
Project: PromptHub
Author: Allan James
Source: src/features/editor/markdown-actions.ts
MIME: text/typescript
Type: TypeScript

Created: 07/11/2025 20:30 GMT+10
Last modified: 07/11/2025 20:30 GMT+10
---------------
Markdown editor action definitions for Monaco Editor.
Provides keyboard shortcuts and context menu actions for common markdown operations.

Changelog:
07/11/2025 20:30 GMT+10 | Initial creation with 10 markdown actions
*/

export interface MarkdownAction {
  id: string
  label: string
  keybindings?: number[]
  contextMenuGroupId: string
  contextMenuOrder?: number
  run: (editor: any) => void
}

/**
 * Helper: Wrap selected text with prefix and suffix
 * If no selection, insert placeholder with cursor positioned inside
 */
function wrapSelection(
  editor: any,
  prefix: string,
  suffix: string,
  placeholder: string = 'text'
): void {
  const selection = editor.getSelection()
  const model = editor.getModel()
  const text = model?.getValueInRange(selection) || ''

  if (text) {
    // Wrap existing text
    editor.executeEdits('', [{
      range: selection,
      text: `${prefix}${text}${suffix}`
    }])
  } else {
    // Insert placeholder
    editor.executeEdits('', [{
      range: selection,
      text: `${prefix}${placeholder}${suffix}`,
      forceMoveMarkers: true
    }])
    // Position cursor inside wrapper
    const pos = selection.getStartPosition()
    editor.setPosition({
      lineNumber: pos.lineNumber,
      column: pos.column + prefix.length
    })
  }
}

/**
 * Helper: Toggle line prefix (for lists, blockquotes, headings)
 * Works across multiple selected lines
 */
function toggleLinePrefix(
  editor: any,
  prefix: string,
  replace: boolean = false
): void {
  const selection = editor.getSelection()
  const model = editor.getModel()
  const startLine = selection.startLineNumber
  const endLine = selection.endLineNumber

  const edits = []
  for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
    const lineContent = model.getLineContent(lineNum)
    let newContent = lineContent

    if (lineContent.startsWith(prefix)) {
      // Remove prefix (toggle off)
      newContent = lineContent.slice(prefix.length)
    } else if (replace && lineContent.match(/^([-*]|\d+\.)\s/)) {
      // Replace existing list marker
      newContent = prefix + lineContent.replace(/^([-*]|\d+\.)\s/, '')
    } else {
      // Add prefix
      newContent = prefix + lineContent
    }

    edits.push({
      range: {
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: lineContent.length + 1
      },
      text: newContent
    })
  }

  editor.executeEdits('', edits)
}

/**
 * Helper: Insert template at cursor position
 */
function insertTemplate(
  editor: any,
  template: string,
  cursorOffset: number = 0
): void {
  const selection = editor.getSelection()
  editor.executeEdits('', [{
    range: selection,
    text: template
  }])

  if (cursorOffset !== 0) {
    const pos = selection.getStartPosition()
    editor.setPosition({
      lineNumber: pos.lineNumber,
      column: pos.column + cursorOffset
    })
  }
}

// Define all markdown actions
export const markdownActions: MarkdownAction[] = [
  // 1. Bold
  {
    id: 'markdown.bold',
    label: 'Bold',
    keybindings: [2048 | 32], // Ctrl+B (KeyMod.CtrlCmd | KeyCode.KeyB)
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 1,
    run: (editor) => wrapSelection(editor, '**', '**', 'bold')
  },

  // 2. Italic
  {
    id: 'markdown.italic',
    label: 'Italic',
    keybindings: [2048 | 39], // Ctrl+I
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 2,
    run: (editor) => wrapSelection(editor, '*', '*', 'italic')
  },

  // 3. Code Inline
  {
    id: 'markdown.codeInline',
    label: 'Inline Code',
    keybindings: [2048 | 88], // Ctrl+`
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 3,
    run: (editor) => wrapSelection(editor, '`', '`', 'code')
  },

  // 4. Code Block
  {
    id: 'markdown.codeBlock',
    label: 'Code Block',
    keybindings: [2048 | 1024 | 33], // Ctrl+Shift+C
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 4,
    run: (editor) => {
      const selection = editor.getSelection()
      const text = editor.getModel()?.getValueInRange(selection) || ''

      if (text) {
        const wrapped = `\`\`\`\n${text}\n\`\`\``
        editor.executeEdits('', [{ range: selection, text: wrapped }])
      } else {
        insertTemplate(editor, '```\ncode\n```', 3)
      }
    }
  },

  // 5. Heading 1
  {
    id: 'markdown.heading1',
    label: 'Heading 1',
    keybindings: [2048 | 22], // Ctrl+1
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 5,
    run: (editor) => {
      const position = editor.getPosition()
      const model = editor.getModel()
      const lineContent = model.getLineContent(position.lineNumber)

      let newContent = lineContent
      if (lineContent.startsWith('# ')) {
        newContent = lineContent.slice(2)
      } else if (lineContent.match(/^#{1,6} /)) {
        newContent = '# ' + lineContent.replace(/^#{1,6} /, '')
      } else {
        newContent = '# ' + lineContent
      }

      editor.executeEdits('', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        },
        text: newContent
      }])
    }
  },

  // 6. Heading 2
  {
    id: 'markdown.heading2',
    label: 'Heading 2',
    keybindings: [2048 | 23], // Ctrl+2
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 6,
    run: (editor) => {
      const position = editor.getPosition()
      const model = editor.getModel()
      const lineContent = model.getLineContent(position.lineNumber)

      let newContent = lineContent
      if (lineContent.startsWith('## ')) {
        newContent = lineContent.slice(3)
      } else if (lineContent.match(/^#{1,6} /)) {
        newContent = '## ' + lineContent.replace(/^#{1,6} /, '')
      } else {
        newContent = '## ' + lineContent
      }

      editor.executeEdits('', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        },
        text: newContent
      }])
    }
  },

  // 7. Heading 3
  {
    id: 'markdown.heading3',
    label: 'Heading 3',
    keybindings: [2048 | 24], // Ctrl+3
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 7,
    run: (editor) => {
      const position = editor.getPosition()
      const model = editor.getModel()
      const lineContent = model.getLineContent(position.lineNumber)

      let newContent = lineContent
      if (lineContent.startsWith('### ')) {
        newContent = lineContent.slice(4)
      } else if (lineContent.match(/^#{1,6} /)) {
        newContent = '### ' + lineContent.replace(/^#{1,6} /, '')
      } else {
        newContent = '### ' + lineContent
      }

      editor.executeEdits('', [{
        range: {
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: lineContent.length + 1
        },
        text: newContent
      }])
    }
  },

  // 8. Bullet List
  {
    id: 'markdown.bulletList',
    label: 'Bullet List',
    keybindings: [2048 | 1024 | 29], // Ctrl+Shift+8
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 8,
    run: (editor) => toggleLinePrefix(editor, '- ', true)
  },

  // 9. Numbered List
  {
    id: 'markdown.numberedList',
    label: 'Numbered List',
    keybindings: [2048 | 1024 | 28], // Ctrl+Shift+7
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 9,
    run: (editor) => {
      const selection = editor.getSelection()
      const model = editor.getModel()
      const startLine = selection.startLineNumber
      const endLine = selection.endLineNumber

      const edits = []
      let number = 1
      for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
        const lineContent = model.getLineContent(lineNum)
        let newContent = lineContent

        if (lineContent.match(/^\d+\. /)) {
          newContent = lineContent.replace(/^\d+\. /, '')
        } else if (lineContent.startsWith('- ')) {
          newContent = `${number}. ` + lineContent.slice(2)
          number++
        } else {
          newContent = `${number}. ` + lineContent
          number++
        }

        edits.push({
          range: {
            startLineNumber: lineNum,
            startColumn: 1,
            endLineNumber: lineNum,
            endColumn: lineContent.length + 1
          },
          text: newContent
        })
      }

      editor.executeEdits('', edits)
    }
  },

  // 10. Blockquote
  {
    id: 'markdown.blockquote',
    label: 'Blockquote',
    keybindings: [2048 | 1024 | 88], // Ctrl+Shift+.
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 10,
    run: (editor) => toggleLinePrefix(editor, '> ')
  },

  // 11. Insert Link
  {
    id: 'markdown.insertLink',
    label: 'Insert Link',
    keybindings: [2048 | 41], // Ctrl+K
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 11,
    run: (editor) => {
      const selection = editor.getSelection()
      const text = editor.getModel()?.getValueInRange(selection) || 'text'
      const linkTemplate = `[${text}](url)`

      editor.executeEdits('', [{ range: selection, text: linkTemplate }])

      // Position cursor at 'url' for immediate typing
      const pos = selection.getStartPosition()
      const urlStart = pos.column + text.length + 3
      editor.setSelection({
        startLineNumber: pos.lineNumber,
        startColumn: urlStart,
        endLineNumber: pos.lineNumber,
        endColumn: urlStart + 3
      })
    }
  },

  // 12. Insert Table
  {
    id: 'markdown.insertTable',
    label: 'Insert Table',
    contextMenuGroupId: 'markdown',
    contextMenuOrder: 12,
    run: (editor) => {
      const tableTemplate =
`| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`

      insertTemplate(editor, tableTemplate, 2)
    }
  }
]

# PROJECT DOCUMENTATION

## RULES AND FORMATTING

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| PROJECT DOCUMENTATION - RULES AND FORMATTING | 19/08/2025 10:00 GMT+10 | 22/08/2025 11:29 GMT+10 |

## Table of Contents
- [Documentation Rules](#documentation-rules)
- [Source Code Headers](#source-code-and-scripts-file-headers)
- [Header Format](#header-format)
- [Language-Specific Formats](#language-specific-formats)
- [Changelog Requirements](#changelog-requirements)

## Documentation Rules

- **AVOID over-confidence**: Enforce strictly high standards on the execution and documentation of our own work (design, architectural, and implementation correctness, and self-reflection and improvement).
- DON'T deliver _unnecessary praise_ on the developer, or over-enthusiastic agreement for user-provided suggestions, ideas, or decisions regarding the project; ALWAYS be fair and honest to the facts, and **do not be a blind yes-man** as your optimal and accurate advice is needed.
- **Be CRITICAL. Be REALISTIC**: Don't _over-sell_ the completeness of the project, or the benefits/success/suitability of a solution, a feature, or the project in any way.
- Documentation is for **developers** (unless _explicitly_ told otherwise), and is NEVER to contain marketing, or sales pitch-like rhetoric, or self-praise (unless required to communicate a point to the developers).
- Only write markdown .md files. Use sections, code examples, and headings.
- Add the correct language tags to all code blocks in markdown files, e.g.:
```javascript
function example() {
  return "hello";
}
```

```csharp
string example() {
  return "hello";
}
```
- Use tables, visual charts and `mermaid` diagrams, and mcp tool, to improve communication clarity and effectiveness.
- Refactor large files into more modular structures to **ALWAYS keep files under 500 lines.**
- NEVER leak secrets or environment values.

- **ALWAYS begin ALL SOURCECODE and DOCUMENTATION files with the EXACT header formatting below (BETWEEN the ```); with template variables {x}:**

```text
# {Project name}
## {Document title}

| `Title` | `Created` | `Last modified` |
|---------|-----------|-----------------|
| {Document title} | {Creation date and time} | {Last modified date and time} |

## Table of Contents
{Table of Contents}

```

- ENSURE the {Project name} is set to the name from the first entry in `/README.md`
- The `Title` field should have the current ({Document title}) to match the h2 title.
- Use the `time` mcp tool to get/convert accurate times in the correct timezones
- ALWAYS update {Last modified date and time} with the correct date and time that the document was last modified; use format: `dd/MM/yyyy HH:mm GMT+10`.
  - CRITICAL!! **ALWAYS** MAKE SURE THE TIME IS CORRECT, FOR THE GMT+10 TIMEZONE!!
- ALWAYS provide a Table of Contents ({Table of Contents}) with clickable anchor links.
- ALWAYS insert `mermaid` charts and diagrams to more effectively explain concepts including system design, data/concept relationships & structures, and sequence diagrams.
- SPECIFIC COLORS: In documentation markdown, for any explicitly referenced color, either by the individual color by name, or a hexidecimal color code (e.g. #FF10AE) - please decorate the markdown element with the correct specified color using <span> tag. Examples:
  - Font color: <span style="color: #FF10AE;">#FF10AE</span>
  - We need a <span style="color: red;">red</span> sign over there.

## DOCUMENTATION CONTENT

- DO NOT use words such as `it appears..`, `could be`, etc., because it shows a limited understanding of the topic in focus - stop and take time to review and deeply understand the concepts be sure about the accuracy of your responses before committing to words.
- **NO SPECULATION.** Ask questions if needed, to clarify any information or concepts and we can clarify to the detail resolution and accuracy (100%) necessary for this review output.
- Only document information (i.e. of a feature/pattern/system/process/etc.) if the information is **100% VERIFIED TRUTH**, **COMPLETELY ACCURATE**, and that you have _confirmed_, in order to be **FULLY CONFIDENT IN THE ACCURACY AND RELEVANCE** of the information documented.

### Code Documentation
- Every module should have a docstring explaining its purpose
- Public functions must have complete docstrings
- Complex logic should have inline comments with `# Reason:` prefix
- Keep README.md updated with setup instructions and examples
- Maintain CHANGELOG.md for version history

### Component Documentation

Document complex components with JSDoc comments:

```typescript
/**
 * EXAMPLE ONLY: A complex component with integration
 *
 * @param datasets - Array of data to display
 * @param onDatasetSelect - Callback when user selects a dataset
 * @param enableStats - Whether to show stats
 */
interface ComplexCompProps {
  datasets: Dataset[];
  onDatasetSelect: (dataset: Dataset) => void;
  enableStats?: boolean;
}

export function ComplexComp({ datasets, onDatasetSelect, enableStats = true }: ComplexCompProps) {
  // Implementation...
}
```

## SOURCE CODE and SCRIPTS File Headers

### Header Format
All source code files must begin with a standard header containing:
- Project name
- Author (Allan James)
- Source file path (relative)
- MIME type (refer to `mime-types-guide.md`)
- File type/language
- Creation and last modified timestamps (GMT+10)
- File description
- Changelog section

### Language-Specific Formats

#### JavaScript/TypeScript/JSON
```javascript
/*
Project: {Project name}
Author: Allan James
Source: {Relative-path file name}
MIME: {MIME type}
Type: {Source code language/type/format}

Created: {dd/MM/yyyy HH:mm GMT+10}
Last modified: {dd/MM/yyyy HH:mm GMT+10}
---------------
{File description}

Changelog:
{dd/MM/yyyy HH:mm GMT+10} | {Change description}
*/
```

#### Python
```python
"""
Project: {Project name}
Author: Allan James
Source: {Relative-path file name}
MIME: {MIME type}
Type: {Source code language/type/format}

Created: {dd/MM/yyyy HH:mm GMT+10}
Last modified: {dd/MM/yyyy HH:mm GMT+10}
---------------
{File description}

Changelog:
{dd/MM/yyyy HH:mm GMT+10} | {Change description}
"""
```

#### HTML
```html
<!--
Project: {Project name}
Author: Allan James
Source: {Relative-path file name}
MIME: {MIME type}
Type: {Source code language/type/format}

Created: {dd/MM/yyyy HH:mm GMT+10}
Last modified: {dd/MM/yyyy HH:mm GMT+10}
---------------
{File description}

Changelog:
{dd/MM/yyyy HH:mm GMT+10} | {Change description}
//-->
```

## Changelog Requirements
- Keep changelog updated with each significant change
- Each entry must include:
  - Timestamp in `dd/MM/yyyy HH:mm GMT+10` format
  - Brief summary of the change
- Only include changes specific to the file

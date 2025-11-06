# MCP TOOL USAGE

1. **ALWAYS** use `archon` and follow the ARCHON-FIRST commitment.
- ARCHON PROJECT ID: 67f567de-8bee-4709-9e19-4123e693de61 (Walking Tours)

2. **ALWAYS** use `serena` for understanding code structure, relationships, and semantics through language server integration, deep code analysis and intelligent editing suggestions. Apply these capabilities as needed:
  - **Project Understanding**: Analyze entire codebases and understand architectural patterns
  - **Intelligent Editing**: Make precise code changes based on semantic understanding
  - **Cross-Reference Analysis**: Track function calls, imports, and dependencies
  - **Code Quality Assessment**: Identify potential issues and improvement opportunities

3. Use the following mcp tools whenever necessary:

- Use the `UnityMCP` tool whenever possible and appropriate for any Unity related tasks or operations.

- Use `perplex` and `brave` when debugging or trying to find a solution to an issue or a challenge. Use these tools for online research and searching for information, coding solutions/architectures, code and scripting examples, and software/code libraries and package documentations.

- `seqthk` for complex tasks, where initial research and/or planning is required.

- Always use `ref` and `context7` whenever you require API documentation or examples. Use for locating knowledge, like package/platform/api/library documentations, and API code and scripting  guides and code examples.

- Use the `time` tools to access the current date/time and other timezone tools.

- `mermaid` to generate PNG image or SVG from `mermaid` markdown.
  - For each required diagram always produce both svg file (e.g. outputFormat: 'svg'), and png image (e.g. outputFormat: 'png')
    - Always produce transparent background version
    - Two (2) files created for each diagram (png/svg)
  - ALWAYS call `mermaid` generate tool automatically whenever `mermaid` markdown is written into a document, to generate the required 2 files for every diagram.
  - Ensure the filename doesn't have duplicate extensions or other strange/non-standard filenames.
  - Parameters:
    code: mermaid markdown text/code
    backgroundColor: 'transparent'
    outputFormat: 'png' | 'svg'
    name: '{{filename}}-{{diagram_id}}'
    folder: '{{WORKSPACE_FOLDER}}/mermaid' (absolute path required)

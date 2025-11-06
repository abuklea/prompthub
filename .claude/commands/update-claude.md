---
description: Update the project './CLAUDE.md' with important new/modified rules and information.
argument-hint: <request> (string)
---
## Task 
_Given the provided context and request <request>:_
**Use the `system-architect` agent**
1. Read the file: './CLAUDE.md' and remove or modify any outdated/incorrect/inaccurate information
2. Update the file: './CLAUDE.md' with any important new and/or modified rules.
  - Identify any target/s of the request in <request>, and be sure the correct information is added, including any other RELATED significant/important rules.
  - Keep ./CLAUDE.md entries to critical project-wide rules, fixes, decisions, or significant architecture information.
  - Keep ./CLAUDE.md entries especially succinct and to the point - capture all details in compact statements.

##  **CRITICAL DETAILS** - ./CLAUDE.md Supremacy
The contents of the CLAUDE.md are adhered to much more strictly than the user prompt.

### **Adherence Hierarchy:**

- ./CLAUDE.md instructions: Treated as immutable system rules that define operational boundaries
- User prompts: Interpreted as flexible requests that must work within those established rules
- Behavioral Differences:

- Process execution: ./CLAUDE.md steps followed sequentially vs user prompts adapted and optimised
- Persistence: ./CLAUDE.md context maintained throughout session vs user prompts contextual to the moment
- Override behavior: User prompts rarely override ./CLAUDE.md directives vs ./CLAUDE.md consistently overrides user preferences

**SOUND ADVICE**: Dexterously describe development processes in ./CLAUDE.md. **Tactically** flood the ./CLAUDE.md with as much **high-quality** context as possible relating to the correct steps to follow.

### Modular ./CLAUDE.md design and length management

Break ./CLAUDE.md into modules of functionality. To ensure maximum adherence, format the information in markdown ensuring Claude can see the boundaries between instructions and modules, it also helps prevent instruction bleed.

As you add more workflow systems to ./CLAUDE.md, the growing ./CLAUDE.md size will start affecting performance. **ALWAYS** be mindful of our token budget and optimise token spend, while also assuring high-performance; a delicate balance. It can be more effective to front-load the context (including providing multiple examples and denoting which files can be read, and which files are forbidden to read, within the project workspace), in ./CLAUDE.md.

### Mechanic Benefits

Higher instruction adherence: ./CLAUDE.md content treated as authoritative system rules
Consistent execution: Sequential process steps followed systematically
Context persistence: Instructions maintained throughout entire session
Reduced context pollution: Controlled file access prevents unwanted information contamination
Modular organisation: Clear markdown separations between functional areas prevent instruction bleeding

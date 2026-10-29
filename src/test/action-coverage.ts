/*
Project: PromptHub
Author: Allan James
Source: src/test/action-coverage.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:29 GMT+10
Last modified: 29/10/2026 21:31 GMT+10
---------------
The isolation coverage rule as a pure function of source files, so the fixture cases can drive it without editing the
real tree. A server action is an `export async function` of a file whose first statement is the "use server"
directive. The rule reports:
  - an action with no isolation test: a title `<action>:` opened by a quote in a `*.isolation.test.ts` file (signIn and
    signUp are looked up in features/auth/handlers.test.ts instead; signOut has no tenant data and is exempt);
  - an action whose wrapper does not call `handlers.<action>(actionDeps` (`authDeps` for signIn and signUp);
  - an export of a "use server" file that is neither an async function nor a type;
  - src/lib/ensure-profile.ts when it carries the directive or lacks `import "server-only"`.

Limits: the comment stripper knows strings and template literals but not regular expression literals, and a title in a
test that is skipped still counts as a title. The checker reads text only; it does not run the tests.

Changelog:
29/10/2026 21:31 GMT+10 | Implemented the four checks (P7S2T10, issue #118)
29/10/2026 21:29 GMT+10 | Stub created (P7S2T10, red phase)
*/

/** A source file: its path from the repository root with forward slashes, and its text. */
export interface SourceFile {
  path: string
  text: string
}

/** A server action found in a "use server" file. */
export interface FoundAction {
  name: string
  path: string
}

/** What the rule found wrong; every list is empty when the tree complies. */
export interface CoverageReport {
  /** Names of the actions with no isolation test. */
  uncovered: string[]
  /** Names of the actions whose wrapper does not call its handler with the expected dependencies. */
  notDelegating: string[]
  /** `<path>: <export line>` for each export of a "use server" file that is not an async function or a type. */
  badExports: string[]
  /** Messages about src/lib/ensure-profile.ts. */
  ensureProfile: string[]
}

const ENSURE_PROFILE_PATH = "src/lib/ensure-profile.ts"
const AUTH_ACTIONS_PATH = /(^|\/)features\/auth\/actions\.ts$/
const AUTH_HANDLERS_TEST_PATH = /(^|\/)features\/auth\/handlers\.test\.ts$/
const ISOLATION_TEST_PATH = /\.isolation\.test\.ts$/
const AUTH_ACTIONS = new Set(["signIn", "signUp"])
const SIGN_OUT = "signOut"

const DIRECTIVE = /^\s*(["'])use server\1\s*;?/
const SERVER_ONLY_IMPORT = /^\s*import\s+(["'])server-only\1/m
const EXPORT_LINE = /^[ \t]*export\b.*$/gm
const ASYNC_FUNCTION_EXPORT = /^export\s+async\s+function\s+([A-Za-z_$][\w$]*)/
const TYPE_EXPORT = /^export\s+(type|interface)\b/

/** The index just after the string or template literal that opens at `start`. */
function endOfString(text: string, start: number): number {
  const quote = text[start]
  let i = start + 1
  while (i < text.length) {
    const ch = text[i]
    if (ch === "\\") i += 2
    else if (ch === quote) return i + 1
    // Reason: a plain string cannot span lines, so an unmatched quote (a regular expression literal) ends at the line.
    else if (ch === "\n" && quote !== "`") return i
    else i++
  }
  return text.length
}

/** The text with every comment replaced by one space; strings and template literals are kept as they are. */
function stripComments(text: string): string {
  let out = ""
  let i = 0
  while (i < text.length) {
    const pair = text.slice(i, i + 2)
    if (pair === "//") {
      const end = text.indexOf("\n", i)
      i = end === -1 ? text.length : end
      out += " "
    } else if (pair === "/*") {
      const end = text.indexOf("*/", i + 2)
      i = end === -1 ? text.length : end + 2
      out += " "
    } else if (text[i] === '"' || text[i] === "'" || text[i] === "`") {
      const end = endOfString(text, i)
      out += text.slice(i, end)
      i = end
    } else {
      out += text[i]
      i++
    }
  }
  return out
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** A file that has been stripped of comments, with its exports located. */
interface ParsedFile {
  path: string
  code: string
  isServerFile: boolean
  /** Each export statement line with the offset where it starts, trimmed of indentation. */
  exports: { line: string; offset: number }[]
}

function parse(file: SourceFile): ParsedFile {
  const code = stripComments(file.text)
  // Reason: tsconfig sets no target (ES5), where spreading an iterator needs downlevelIteration; Array.from does not.
  const exports = Array.from(code.matchAll(EXPORT_LINE)).map((match) => ({
    line: match[0].trim(),
    offset: match.index ?? 0,
  }))
  return { path: file.path, code, isServerFile: DIRECTIVE.test(code), exports }
}

/** The async functions a parsed "use server" file exports, each with the text of its own body. */
function actionsOf(file: ParsedFile): { name: string; body: string }[] {
  const found: { name: string; body: string }[] = []
  file.exports.forEach((entry, index) => {
    const name = ASYNC_FUNCTION_EXPORT.exec(entry.line)?.[1]
    if (!name) return
    const end = file.exports[index + 1]?.offset ?? file.code.length
    found.push({ name, body: file.code.slice(entry.offset, end) })
  })
  return found
}

/** The "use server" files, leaving out ensure-profile, which has its own check. */
function serverFiles(files: ParsedFile[]): ParsedFile[] {
  return files.filter((file) => file.isServerFile && file.path !== ENSURE_PROFILE_PATH)
}

/**
 * Every server action in the files: each `export async function` of a file whose first statement is the "use server"
 * directive, comments and the header block ignored.
 *
 * @param files - The source files to read.
 * @returns The actions in file order, then source order.
 */
export function findActions(files: SourceFile[]): FoundAction[] {
  return serverFiles(files.map(parse)).flatMap((file) =>
    actionsOf(file).map((action) => ({ name: action.name, path: file.path })),
  )
}

/** Whether a title `<name>:` opened by a quote or backtick appears in the code. */
function hasTitle(code: string, name: string): boolean {
  return new RegExp(`["'\`]${escapeRegExp(name)}:`).test(code)
}

function isAuthException(action: FoundAction): boolean {
  return AUTH_ACTIONS.has(action.name) && AUTH_ACTIONS_PATH.test(action.path)
}

function isSignOut(action: FoundAction): boolean {
  return action.name === SIGN_OUT && AUTH_ACTIONS_PATH.test(action.path)
}

function delegates(body: string, name: string, deps: string): boolean {
  return new RegExp(`\\bhandlers\\.${escapeRegExp(name)}\\(\\s*${deps}\\b`).test(body)
}

function ensureProfileProblems(files: ParsedFile[]): string[] {
  const profile = files.find((file) => file.path === ENSURE_PROFILE_PATH)
  if (!profile) return [`${ENSURE_PROFILE_PATH} is missing`]
  const problems: string[] = []
  if (profile.isServerFile) problems.push(`${ENSURE_PROFILE_PATH} has the "use server" directive`)
  if (!SERVER_ONLY_IMPORT.test(profile.code)) problems.push(`${ENSURE_PROFILE_PATH} does not import "server-only"`)
  return problems
}

/**
 * Check the isolation coverage rule over a set of files.
 *
 * @param files - Every source file under src, with its path from the repository root.
 * @returns The report; all four lists are empty when the tree complies.
 */
export function checkActionCoverage(files: SourceFile[]): CoverageReport {
  const parsed = files.map(parse)
  const isolationCode = parsed.filter((file) => ISOLATION_TEST_PATH.test(file.path)).map((file) => file.code)
  const authTestCode = parsed.filter((file) => AUTH_HANDLERS_TEST_PATH.test(file.path)).map((file) => file.code)
  const report: CoverageReport = { uncovered: [], notDelegating: [], badExports: [], ensureProfile: [] }

  for (const file of serverFiles(parsed)) {
    for (const entry of file.exports) {
      if (!ASYNC_FUNCTION_EXPORT.test(entry.line) && !TYPE_EXPORT.test(entry.line)) {
        report.badExports.push(`${file.path}: ${entry.line}`)
      }
    }
    for (const { name, body } of actionsOf(file)) {
      const action = { name, path: file.path }
      if (isSignOut(action)) continue
      const authException = isAuthException(action)
      // Reason: signIn and signUp enter through a fake auth client, so their titles live in the auth handlers test.
      const titleFiles = authException ? authTestCode : isolationCode
      if (!titleFiles.some((code) => hasTitle(code, name))) report.uncovered.push(name)
      if (!delegates(body, name, authException ? "authDeps" : "actionDeps")) report.notDelegating.push(name)
    }
  }
  report.ensureProfile = ensureProfileProblems(parsed)
  return report
}

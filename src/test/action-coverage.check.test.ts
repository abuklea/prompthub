/*
Project: PromptHub
Author: Allan James
Source: src/test/action-coverage.check.test.ts
MIME: text/typescript
Type: TypeScript Module

Created: 29/10/2026 21:30 GMT+10
Last modified: 29/10/2026 21:30 GMT+10
---------------
Fixture cases for the isolation coverage rule: the checker is driven with synthetic files, so each way a tree can break
the rule is shown to be caught without editing the real tree. The real tree is checked in action-coverage.test.ts.

Changelog:
29/10/2026 21:30 GMT+10 | Created (P7S2T10, issue #118)
*/
import { describe, expect, it } from "vitest"
import { checkActionCoverage, findActions, type CoverageReport, type SourceFile } from "./action-coverage"

const EMPTY: CoverageReport = { uncovered: [], notDelegating: [], badExports: [], ensureProfile: [] }

const FOLDERS = "src/features/folders/actions.ts"
const FOLDERS_ISOLATION = "src/features/folders/handlers.isolation.test.ts"
const AUTH = "src/features/auth/actions.ts"
const AUTH_HANDLERS_TEST = "src/features/auth/handlers.test.ts"

const file = (path: string, text: string): SourceFile => ({ path, text })

/** A clean src/lib/ensure-profile.ts, which every tree must contain. */
const PROFILE_OK = file(
  "src/lib/ensure-profile.ts",
  'import "server-only"\nexport async function ensureProfileExists() {}\n',
)

/** An action that delegates to its handler. */
const delegating = (name: string, deps = "actionDeps") =>
  `export async function ${name}(data: unknown) {\n  return handlers.${name}(${deps}, data)\n}\n`

/** A wrapper file: the directive, the namespace import and the given declarations. */
const wrapper = (path: string, ...declarations: string[]) =>
  file(path, `"use server"\n\nimport * as handlers from "./handlers"\n\n${declarations.join("\n")}`)

/** An isolation test file holding one test per given title. */
const isolation = (path: string, ...titles: string[]) =>
  file(path, titles.map((title) => `it(${title}, async () => {})`).join("\n"))

const check = (...files: SourceFile[]) => checkActionCoverage([PROFILE_OK, ...files])

describe("isolation coverage: actions", () => {
  it("reports nothing for an action with an isolation test", () => {
    const report = check(
      wrapper(FOLDERS, delegating("createFolder")),
      isolation(FOLDERS_ISOLATION, '"createFolder: user B cannot create under A\'s folder"'),
    )
    expect(report).toEqual(EMPTY)
  })

  it("names an action that has no isolation test beside covered ones", () => {
    const report = check(
      wrapper(FOLDERS, delegating("createFolder"), delegating("deleteFolder")),
      isolation(FOLDERS_ISOLATION, '"createFolder: user B ..."'),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["deleteFolder"] })
  })

  it("names an action when no isolation test file exists", () => {
    const report = check(wrapper(FOLDERS, delegating("createFolder")))
    expect(report).toEqual({ ...EMPTY, uncovered: ["createFolder"] })
  })

  it("does not count a title in a test file that is not an isolation test", () => {
    const report = check(
      wrapper(FOLDERS, delegating("createFolder")),
      isolation("src/features/folders/handlers.test.ts", '"createFolder: user B ..."'),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["createFolder"] })
  })

  it.each([
    ["double quote", '"createFolder: user B ..."'],
    ["single quote", "'createFolder: user B ...'"],
    ["backtick", "`createFolder: user B ...`"],
  ])("finds a title opened with a %s", (_quote, title) => {
    const report = check(wrapper(FOLDERS, delegating("createFolder")), isolation(FOLDERS_ISOLATION, title))
    expect(report).toEqual(EMPTY)
  })

  it("does not count a name that merely ends a longer title word", () => {
    const report = check(
      wrapper(FOLDERS, delegating("createFolder")),
      isolation(FOLDERS_ISOLATION, '"recreateFolder: user B ..."'),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["createFolder"] })
  })

  it("does not count a title that is only in a comment", () => {
    const report = check(
      wrapper(FOLDERS, delegating("createFolder")),
      file(FOLDERS_ISOLATION, '// it("createFolder: user B ...")\n/* it("createFolder: user B ...") */\n'),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["createFolder"] })
  })

  it("still sees a comment after a line with a stray quote, such as a regular expression literal", () => {
    const report = check(
      wrapper(FOLDERS, delegating("createFolder")),
      file(FOLDERS_ISOLATION, "const quote = /'/\n// it('createFolder: user B ...')\n"),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["createFolder"] })
  })

  it("reads a file that ends in a line comment, an unterminated block comment or an unterminated template", () => {
    const text = `"use server"\n${delegating("createFolder")}`
    expect(findActions([file(FOLDERS, `${text}// no newline after this`)])).toHaveLength(1)
    expect(findActions([file(FOLDERS, `${text}/* never closed`)])).toHaveLength(1)
    expect(findActions([file(FOLDERS, `${text}const open = \`never closed`)])).toHaveLength(1)
  })

  it("does not count a title without its colon", () => {
    const report = check(
      wrapper(FOLDERS, delegating("createFolder")),
      isolation(FOLDERS_ISOLATION, '"createFolder user B ..."'),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["createFolder"] })
  })

  it("covers an action whose name contains a dollar sign", () => {
    const report = check(
      wrapper(FOLDERS, delegating("get$Folder")),
      isolation(FOLDERS_ISOLATION, '"get$Folder: user B ..."'),
    )
    expect(report).toEqual(EMPTY)
  })
})

describe("isolation coverage: which files are wrappers", () => {
  it.each([
    ["double quotes", '"use server"\n'],
    ["single quotes", "'use server'\n"],
    ["a semicolon", '"use server";\n'],
  ])("finds the directive written with %s", (_style, directive) => {
    const text = `${directive}import * as handlers from "./handlers"\n${delegating("createFolder")}`
    expect(findActions([file(FOLDERS, text)])).toEqual([{ name: "createFolder", path: FOLDERS }])
  })

  it("finds the directive after a header block comment and line comments", () => {
    const header = '/*\nProject: x\nA "use server" wrapper.\n*/\n// a line comment\n\n'
    const text = `${header}"use server"\n\n${delegating("createFolder")}`
    expect(findActions([file(FOLDERS, text)])).toEqual([{ name: "createFolder", path: FOLDERS }])
  })

  it("finds the directive after a JSDoc block", () => {
    const text = `/** Wrapper. */\n"use server"\n${delegating("createFolder")}`
    expect(findActions([file(FOLDERS, text)])).toEqual([{ name: "createFolder", path: FOLDERS }])
  })

  it("ignores a file whose header only mentions the directive", () => {
    const text = `/*\nA plain module: no "use server" directive.\n*/\nexport async function createFolder() {}\n`
    expect(findActions([file("src/features/folders/handlers.ts", text)])).toEqual([])
  })

  it("ignores a file where the directive is not the first statement", () => {
    const text = `import x from "y"\n"use server"\nexport async function createFolder() {}\n`
    expect(findActions([file(FOLDERS, text)])).toEqual([])
  })

  it("ignores a file with no directive, however many functions it exports", () => {
    const text = `export async function createFolder() {}\nexport const x = 1\n`
    expect(check(file("src/features/folders/service.ts", text))).toEqual(EMPTY)
  })

  it("lists every async function a wrapper file exports, in order", () => {
    const files = [wrapper(FOLDERS, delegating("createFolder"), delegating("deleteFolder"))]
    expect(findActions(files).map((action) => action.name)).toEqual(["createFolder", "deleteFolder"])
  })

  it("does not list an export that only appears in a comment or a type", () => {
    const text = `"use server"\n// export async function ghost() {}\nexport type Result = { ok: boolean }\n`
    expect(findActions([file(FOLDERS, text)])).toEqual([])
  })
})

describe("isolation coverage: exceptions", () => {
  const signInSignUp = wrapper(AUTH, delegating("signUp", "authDeps"), delegating("signIn", "authDeps"))

  it("covers signIn and signUp by titles in the auth handlers test", () => {
    const titles = isolation(AUTH_HANDLERS_TEST, '"signIn: valid input ..."', "'signUp: valid input ...'")
    const report = check(signInSignUp, titles)
    expect(report).toEqual(EMPTY)
  })

  it("names signIn and signUp when the auth handlers test has no such title", () => {
    const report = check(signInSignUp, isolation(AUTH_HANDLERS_TEST, '"signIn: valid input ..."'))
    expect(report).toEqual({ ...EMPTY, uncovered: ["signUp"] })
  })

  it("does not take a signIn title from another test file", () => {
    const report = check(
      signInSignUp,
      isolation(AUTH_HANDLERS_TEST, '"signUp: valid input ..."'),
      isolation("src/features/auth/other.test.ts", '"signIn: valid input ..."'),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["signIn"] })
  })

  it("does not accept a signIn title in an isolation test in place of the auth handlers test", () => {
    const report = check(
      wrapper(AUTH, delegating("signIn", "authDeps")),
      isolation("src/features/auth/handlers.isolation.test.ts", '"signIn: user B ..."'),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["signIn"] })
  })

  it("exempts signOut from the isolation test and from the handler call", () => {
    const signOut = "export async function signOut() {\n  redirect(\"/login\")\n}\n"
    expect(check(wrapper(AUTH, signOut))).toEqual(EMPTY)
  })

  it("does not exempt signOut outside the auth actions file", () => {
    const signOut = "export async function signOut() {\n  redirect(\"/login\")\n}\n"
    const report = check(wrapper(FOLDERS, signOut))
    expect(report).toEqual({ ...EMPTY, uncovered: ["signOut"], notDelegating: ["signOut"] })
  })

  it("does not exempt signIn outside the auth actions file", () => {
    const report = check(
      wrapper(FOLDERS, delegating("signIn", "authDeps")),
      isolation(AUTH_HANDLERS_TEST, '"signIn: ..."'),
    )
    expect(report).toEqual({ ...EMPTY, uncovered: ["signIn"], notDelegating: ["signIn"] })
  })

  it("does not exempt getDashboardMetrics", () => {
    const report = check(wrapper("src/features/dashboard/actions.ts", delegating("getDashboardMetrics")))
    expect(report).toEqual({ ...EMPTY, uncovered: ["getDashboardMetrics"] })
  })
})

describe("isolation coverage: exports of a use server file", () => {
  const bad = (declaration: string) =>
    check(
      wrapper(FOLDERS, delegating("createFolder"), declaration),
      isolation(FOLDERS_ISOLATION, '"createFolder: user B ..."'),
    )

  it.each([
    ["a non-async function", "export function helper() {}"],
    ["a const", "export const LIMIT = 30"],
    ["a let", "export let counter = 0"],
    ["a class", "export class Box {}"],
    ["an enum", "export enum Kind { A }"],
    ["a default export", "export default async function () {}"],
    ["an export list", "export { helper }"],
    ["a re-export", 'export * from "./other"'],
    ["an async generator", "export async function* stream() {}"],
    ["an async arrow function", "export const run = async () => {}"],
  ])("reports %s", (_kind, declaration) => {
    const report = bad(declaration)
    expect(report.badExports).toEqual([`${FOLDERS}: ${declaration}`])
    expect(report.uncovered).toEqual([])
  })

  it.each([
    ["a type alias", "export type Result = { ok: boolean }"],
    ["an interface", "export interface Options { retries: number }"],
    ["a type-only export list", "export type { Folder } from \"@prisma/client\""],
  ])("allows %s, which is erased at build", (_kind, declaration) => {
    expect(bad(declaration)).toEqual(EMPTY)
  })

  it("reports a bad export that follows a block comment on the same line", () => {
    const report = check(
      wrapper(FOLDERS, delegating("createFolder"), "/* note */ export const LIMIT = 30"),
      isolation(FOLDERS_ISOLATION, '"createFolder: user B ..."'),
    )
    expect(report.badExports).toEqual([`${FOLDERS}: export const LIMIT = 30`])
  })

  it("does not report an export that is only in a comment", () => {
    expect(bad("// export const LIMIT = 30")).toEqual(EMPTY)
  })
})

describe("isolation coverage: wrappers delegate to their handler", () => {
  const covered = (name: string) => isolation(FOLDERS_ISOLATION, `"${name}: user B ..."`)

  it("reports a wrapper that does its own work", () => {
    const body = "export async function createFolder(data: unknown) {\n  return db.folder.create({ data })\n}\n"
    const report = check(wrapper(FOLDERS, body), covered("createFolder"))
    expect(report).toEqual({ ...EMPTY, notDelegating: ["createFolder"] })
  })

  it("reports a wrapper that calls the handler of a different action", () => {
    const body =
      "export async function createFolder(data: unknown) {\n  return handlers.deleteFolder(actionDeps, data)\n}\n"
    const report = check(wrapper(FOLDERS, body), covered("createFolder"))
    expect(report).toEqual({ ...EMPTY, notDelegating: ["createFolder"] })
  })

  it("reports a wrapper that calls its handler with other dependencies", () => {
    const report = check(wrapper(FOLDERS, delegating("createFolder", "realDeps")), covered("createFolder"))
    expect(report).toEqual({ ...EMPTY, notDelegating: ["createFolder"] })
  })

  it("reports a wrapper that imports its handler by name instead of as the namespace", () => {
    const text = `"use server"\nimport { createFolder as run } from "./handlers"\n` +
      "export async function createFolder(data: unknown) {\n  return run(actionDeps, data)\n}\n"
    const report = check(file(FOLDERS, text), covered("createFolder"))
    expect(report).toEqual({ ...EMPTY, notDelegating: ["createFolder"] })
  })

  it("reports a wrapper whose call is in another action's body", () => {
    const first = "export async function createFolder(data: unknown) {\n  return null\n}\n"
    const report = check(
      wrapper(FOLDERS, first, delegating("deleteFolder")),
      covered("createFolder"),
      covered("deleteFolder"),
    )
    expect(report).toEqual({ ...EMPTY, notDelegating: ["createFolder"] })
  })

  it("accepts a call that wraps over several lines, and a revalidation after it", () => {
    const body =
      "export async function createFolder(data: unknown) {\n  const result = await handlers.createFolder(\n" +
      "    actionDeps,\n    data,\n  )\n  if (result.success) revalidatePath(\"/\")\n  return result\n}\n"
    expect(check(wrapper(FOLDERS, body), covered("createFolder"))).toEqual(EMPTY)
  })

  it("accepts handlers.signIn(authDeps and handlers.signUp(authDeps in the auth file", () => {
    const report = check(
      wrapper(AUTH, delegating("signUp", "authDeps"), delegating("signIn", "authDeps")),
      isolation(AUTH_HANDLERS_TEST, '"signIn: ..."', '"signUp: ..."'),
    )
    expect(report).toEqual(EMPTY)
  })

  it("reports signIn called with actionDeps", () => {
    const report = check(
      wrapper(AUTH, delegating("signIn", "actionDeps")),
      isolation(AUTH_HANDLERS_TEST, '"signIn: ..."'),
    )
    expect(report).toEqual({ ...EMPTY, notDelegating: ["signIn"] })
  })

  it("does not take a call in a comment as a delegation", () => {
    const body =
      "export async function createFolder(data: unknown) {\n  // handlers.createFolder(actionDeps, data)\n}\n"
    const report = check(wrapper(FOLDERS, body), covered("createFolder"))
    expect(report).toEqual({ ...EMPTY, notDelegating: ["createFolder"] })
  })
})

describe("isolation coverage: ensure-profile", () => {
  const profile = (text: string) => file("src/lib/ensure-profile.ts", text)

  it("accepts a module with server-only and no directive", () => {
    const text =
      '/*\nNo "use server" directive.\n*/\nimport "server-only"\nexport async function ensureProfileExists() {}\n'
    expect(checkActionCoverage([profile(text)])).toEqual(EMPTY)
  })

  it("reports the directive, and does not list its exports as actions", () => {
    const text = '"use server"\nimport "server-only"\nexport async function ensureProfileExists() {}\n'
    const report = checkActionCoverage([profile(text)])
    expect(report.ensureProfile).toHaveLength(1)
    expect(report.ensureProfile[0]).toContain("use server")
    expect(report.uncovered).toEqual([])
  })

  it("reports a missing server-only import", () => {
    const report = checkActionCoverage([profile("export async function ensureProfileExists() {}\n")])
    expect(report.ensureProfile).toHaveLength(1)
    expect(report.ensureProfile[0]).toContain("server-only")
  })

  it("reports a server-only import that is only in a comment", () => {
    const report = checkActionCoverage([profile('// import "server-only"\nexport const x = 1\n')])
    expect(report.ensureProfile).toHaveLength(1)
  })

  it("reports both problems when the directive is present and the import is missing", () => {
    const report = checkActionCoverage([profile('"use server"\nexport async function ensureProfileExists() {}\n')])
    expect(report.ensureProfile).toHaveLength(2)
  })

  it("reports a tree that has no ensure-profile module", () => {
    const report = checkActionCoverage([])
    expect(report.ensureProfile).toEqual(["src/lib/ensure-profile.ts is missing"])
  })
})

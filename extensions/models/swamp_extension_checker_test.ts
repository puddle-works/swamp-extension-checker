/**
 * Tests for @puddleworks/swamp-extension-checker.
 *
 * Run with the "Test it" command in README.md.
 *
 * @module
 */
import { assertEquals } from "jsr:@std/assert@1.0.19";
import { assertSpyCallArgs, stub } from "jsr:@std/testing@1.0.21/mock";
import {
  behaviour,
  type GlobalArgs,
  GlobalArgsSchema,
  model,
  ResultSchema,
  RunArgsSchema,
} from "./swamp_extension_checker.ts";

/** Values for the required inputs. */
const REQUIRED = {};

/**
 * Placeholders that only need to pass the schema: these tests stub `run`.
 * Tests of the real behaviour call `run` with working settings of their own.
 */
const SETTINGS: GlobalArgs = {};

Deno.test("model type matches the app spec", () => {
  assertEquals(model.type, "@puddleworks/swamp-extension-checker");
});

Deno.test("run arguments are exactly the specification inputs", () => {
  assertEquals(Object.keys(RunArgsSchema.shape).sort(), ["path", "repo"]);
});

Deno.test("run arguments apply the specification defaults", () => {
  assertEquals(RunArgsSchema.parse(REQUIRED), { repo: "", path: "." });
});

Deno.test("run arguments reject values of the wrong type", () => {
  const wrong: Array<[string, unknown]> = [
    ["repo", 1],
    ["path", 1],
  ];
  for (const [name, value] of wrong) {
    assertEquals(RunArgsSchema.safeParse({ ...REQUIRED, [name]: value }).success, false, name);
  }
});

Deno.test("run writes one result resource with the arguments it ran with", async () => {
  using runStub = stub(behaviour, "run", () => Promise.resolve([]));
  const args = RunArgsSchema.parse(REQUIRED);
  const writes: Array<{ specName: string; data: Record<string, unknown> }> = [];
  const out = await model.methods.run.execute(args, {
    globalArgs: SETTINGS,
    writeResource: (specName, name, data) => {
      writes.push({ specName, data });
      return Promise.resolve({ name });
    },
  });
  assertEquals(out.dataHandles.length, 1);
  assertSpyCallArgs(runStub, 0, [args, SETTINGS]);
  assertEquals(writes.length, 1);
  assertEquals(writes[0].specName, "result");
  assertEquals(writes[0].data.args, args);
  assertEquals(ResultSchema.safeParse(writes[0].data).success, true);
});

// ---- The licence check ----

import { assert, assertRejects } from "jsr:@std/assert@1.0.19";
import { parse as parseYaml } from "jsr:@std/yaml@1.0.10";
import { io, type Licence, run, type RunArgs } from "./swamp_extension_checker.ts";

/** A temp directory with `.git` and the given root files; removed after `fn`. */
async function withRepo(
  files: string[],
  fn: (root: string) => Promise<void>,
  gitFile = false,
): Promise<void> {
  const root = await Deno.makeTempDir();
  try {
    if (gitFile) await Deno.writeTextFile(`${root}/.git`, "gitdir: /elsewhere\n");
    else await Deno.mkdir(`${root}/.git`);
    for (const f of files) {
      const dir = f.includes("/") ? `${root}/${f.slice(0, f.lastIndexOf("/"))}` : root;
      await Deno.mkdir(dir, { recursive: true });
      await Deno.writeTextFile(`${root}/${f}`, "text\n");
    }
    await fn(root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

/** Swap `io` for fakes: GitHub answers come from `github`, the origin from `origin`. */
function fakeIo(
  github: Record<string, unknown> = {},
  origin: string | null = null,
) {
  const calls: string[] = [];
  const gh = stub(io, "github", (path: string) => {
    calls.push(path);
    return Promise.resolve(path in github ? github[path] : null);
  });
  const or = stub(io, "originUrl", () => Promise.resolve(origin));
  return {
    calls,
    [Symbol.dispose]() {
      gh.restore();
      or.restore();
    },
  };
}

async function check(args: Partial<RunArgs>): Promise<Licence> {
  const items = await run(RunArgsSchema.parse(args), SETTINGS);
  assertEquals(items.length, 1);
  return items[0];
}

Deno.test("AC1: a LICENSE at the root of the local repository is a yes that names it", async () => {
  using _io = fakeIo();
  await withRepo(["LICENSE", "README.md"], async (root) => {
    const r = await check({ path: root });
    assertEquals(r.found, true);
    assertEquals(r.inGitRepository, true);
    assertEquals(r.file, "LICENSE");
    assertEquals(r.checked, "local");
    assertEquals(r.repository, await Deno.realPath(root));
    assertEquals(r.answer, "Yes: LICENSE.");
  });
});

Deno.test("AC2: no licence file at the root of the local repository is a no", async () => {
  using _io = fakeIo();
  await withRepo(["README.md"], async (root) => {
    const r = await check({ path: root });
    assertEquals(r.found, false);
    assertEquals(r.inGitRepository, true);
    assertEquals(r.file, null);
    assertEquals(r.answer, "No: there is no licence file at the root.");
  });
});

Deno.test("AC3: LICENSE.md, licence.txt and COPYING count and are named", async () => {
  using _io = fakeIo();
  for (const name of ["LICENSE.md", "licence.txt", "COPYING", "License.rst", "LICENCE"]) {
    await withRepo([name], async (root) => {
      const r = await check({ path: root });
      assertEquals([r.found, r.file], [true, name], name);
    });
  }
});

Deno.test("AC3: other extensions and licence files below the root do not count", async () => {
  using _io = fakeIo();
  await withRepo(["LICENSE.pdf", "docs/LICENSE", "LICENSES/MIT.txt"], async (root) => {
    const r = await check({ path: root });
    assertEquals([r.found, r.file], [false, null]);
  });
});

Deno.test("AC3: a directory named LICENSE is not a licence file", async () => {
  using _io = fakeIo();
  await withRepo(["LICENSE/MIT.txt"], async (root) => {
    assertEquals((await check({ path: root })).found, false);
  });
});

Deno.test("a path inside the repository is checked at the repository's root", async () => {
  using _io = fakeIo();
  await withRepo(["LICENSE", "src/main.ts"], async (root) => {
    const r = await check({ path: `${root}/src` });
    assertEquals([r.found, r.file, r.repository], [true, "LICENSE", await Deno.realPath(root)]);
  });
});

Deno.test("a worktree, whose .git is a file, is a git repository", async () => {
  using _io = fakeIo();
  await withRepo(["COPYING"], async (root) => {
    const r = await check({ path: root });
    assertEquals([r.inGitRepository, r.file], [true, "COPYING"]);
  }, true);
});

Deno.test("a local repository whose origin is on GitHub gets the SPDX name when GitHub's file is the same", async () => {
  using _io = fakeIo(
    { "repos/acme/tool/license": { path: "LICENSE", license: { spdx_id: "MIT" } } },
    "git@github.com:acme/tool.git",
  );
  await withRepo(["LICENSE"], async (root) => {
    const r = await check({ path: root });
    assertEquals([r.file, r.spdx, r.answer], ["LICENSE", "MIT", "Yes: LICENSE (MIT)."]);
  });
});

Deno.test("a local licence file GitHub does not report has no SPDX name", async () => {
  using _io = fakeIo(
    { "repos/acme/tool/license": { path: "COPYING", license: { spdx_id: "GPL-3.0" } } },
    "https://github.com/acme/tool",
  );
  await withRepo(["LICENSE.md"], async (root) => {
    assertEquals((await check({ path: root })).spdx, null);
  });
});

Deno.test("AC4: a named GitHub repository is checked on GitHub, with its SPDX name", async () => {
  using fake = fakeIo({
    "repos/puddle-works/swamp-extension-checker/contents/": [
      { name: "LICENSE", type: "file" },
      { name: "README.md", type: "file" },
    ],
    "repos/puddle-works/swamp-extension-checker/license": {
      path: "LICENSE",
      license: { spdx_id: "MIT" },
    },
  });
  const r = await check({ repo: "puddle-works/swamp-extension-checker" });
  assertEquals(r, {
    found: true,
    inGitRepository: true,
    file: "LICENSE",
    spdx: "MIT",
    checked: "github",
    repository: "puddle-works/swamp-extension-checker",
    answer: "Yes: LICENSE (MIT).",
  });
  assert(fake.calls.every((c) => c.startsWith("repos/puddle-works/swamp-extension-checker/")));
});

Deno.test("AC4: a github.com URL names the same repository", async () => {
  using fake = fakeIo({ "repos/acme/tool/contents/": [] });
  const r = await check({ repo: "https://github.com/acme/tool.git" });
  assertEquals([r.repository, r.found, r.answer], [
    "acme/tool",
    false,
    "No: there is no licence file at the root.",
  ]);
  assert(fake.calls.includes("repos/acme/tool/contents/"));
});

Deno.test("AC4: GitHub's NOASSERTION is no SPDX name, and a licence directory does not count", async () => {
  using _io = fakeIo({
    "repos/acme/tool/contents/": [
      { name: "LICENSE", type: "dir" },
      { name: "COPYING.txt", type: "file" },
    ],
    "repos/acme/tool/license": { path: "COPYING.txt", license: { spdx_id: "NOASSERTION" } },
  });
  const r = await check({ repo: "acme/tool" });
  assertEquals([r.file, r.spdx, r.answer], ["COPYING.txt", null, "Yes: COPYING.txt."]);
});

Deno.test("AC4: a repository GitHub cannot show is an error, not a no", async () => {
  using _io = fakeIo({});
  await assertRejects(() => check({ repo: "acme/missing" }), Error, "acme/missing");
});

Deno.test("a repo that is neither owner/name nor a github.com URL is refused", async () => {
  using fake = fakeIo();
  await assertRejects(() => check({ repo: "not a repo" }), Error, "owner/name");
  assertEquals(fake.calls, []);
});

Deno.test("AC5: outside any git repository it says so and asks GitHub nothing", async () => {
  using fake = fakeIo();
  const dir = await Deno.makeTempDir();
  try {
    const r = await check({ path: dir });
    assertEquals(r.inGitRepository, false);
    assertEquals(r.found, false);
    assertEquals(r.answer, `${await Deno.realPath(dir)} is not in a git repository.`);
    assertEquals(fake.calls, []);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("a path that does not exist is an error", async () => {
  using _io = fakeIo();
  await assertRejects(() => check({ path: "/no/such/dir/at/all" }), Error, "/no/such/dir/at/all");
});

Deno.test("AC6: a local check changes nothing in the repository", async () => {
  using fake = fakeIo();
  await withRepo(["LICENSE", "src/a.ts"], async (root) => {
    const before = await listTree(root);
    await check({ path: root });
    assertEquals(await listTree(root), before);
    assertEquals(fake.calls, []);
  });
});

async function listTree(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for await (const e of Deno.readDir(dir)) {
    const p = `${prefix}${e.name}`;
    out.push(p);
    if (e.isDirectory) out.push(...await listTree(`${dir}/${e.name}`, `${p}/`));
  }
  return out.sort();
}

interface Workflow {
  name: string;
  tags: Record<string, string>;
  inputs: { properties: Record<string, unknown> };
  jobs: Array<{ steps: Array<{ task: Record<string, unknown> }> }>;
}

/** A workflow under workflows/, parsed. */
async function workflow(file: string): Promise<Workflow> {
  const url = new URL(`../../workflows/${file}`, import.meta.url);
  return parseYaml(await Deno.readTextFile(url)) as Workflow;
}

const RECIPE_FILE = "workflow-swamp-extension-checker-licence-recipe.yaml";

/** The recipe the recipe workflow carries for @puddleworks/recipes. */
async function recipe(): Promise<Record<string, unknown>> {
  return JSON.parse((await workflow(RECIPE_FILE)).tags.puddlerouterRecipe);
}

Deno.test("the recipe workflow has the one step @puddleworks/recipes can run", async () => {
  // The router takes the method and definition from a single model_method step,
  // and refuses a step input that is neither a fixed word nor a declared capture.
  const wf = await workflow(RECIPE_FILE);
  const steps = wf.jobs.flatMap((j) => j.steps);
  assertEquals(steps.length, 1);
  const task = steps[0].task;
  assertEquals(task.type, "model_method");
  assertEquals(task.methodName, "run");
  assertEquals(task.modelIdOrName, "swamp-extension-checker-model");
  assertEquals(task.inputs, { repo: "${{ inputs.repo }}" });
  assertEquals(Object.keys(wf.inputs.properties), ["repo"]);
  assertEquals(wf.name, "@puddleworks/swamp-extension-checker-licence-recipe");
});

Deno.test("the form workflow carries no recipe, so it keeps its path input", async () => {
  const wf = await workflow("workflow-swamp-extension-checker.yaml");
  assertEquals(wf.tags.puddlerouterRecipe, undefined);
  assertEquals(Object.keys(wf.inputs.properties).sort(), ["path", "repo"]);
});

Deno.test("the manifest packages both workflows", async () => {
  const url = new URL("../../manifest.yaml", import.meta.url);
  const m = parseYaml(await Deno.readTextFile(url)) as { workflows: string[] };
  assertEquals(m.workflows.sort(), [RECIPE_FILE, "workflow-swamp-extension-checker.yaml"].sort());
});

Deno.test("AC6: the recipe calls this extension's run method and reads its result", async () => {
  const r = await recipe();
  assertEquals(r.extension, "@puddleworks/swamp-extension-checker");
  assertEquals(r.dataName, "result");
  assertEquals(r.inputs, { repo: { capture: 1, as: "repo" } });
  assertEquals(r.each, { path: "items", line: "{answer}" });
});

Deno.test("the recipe matches the spec's named-repository phrasings and no others", async () => {
  const pattern = new RegExp((await recipe()).pattern as string, "i");
  for (
    const phrase of [
      "does puddle-works/swamp-for-everything have a licence?",
      "Does puddle-works/swamp-for-everything have a LICENSE file?",
      "does acme/tool have a license",
    ]
  ) {
    const m = phrase.match(pattern);
    assert(m, phrase);
    assert(/^[\w.-]+\/[\w.-]+$/.test(m[1]), phrase);
  }
  for (const phrase of ["does acme/tool have a licence and a readme?", "add a licence to acme/tool"]) {
    assertEquals(pattern.test(phrase), false, phrase);
  }
});

Deno.test("the manifest labels it a read-only recipe pack", async () => {
  const url = new URL("../../manifest.yaml", import.meta.url);
  const m = parseYaml(await Deno.readTextFile(url)) as { labels?: string[] };
  assertEquals([...(m.labels ?? [])].sort(), ["effects-read", "puddlerouter-recipe"]);
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..", "..", "..");

const rootPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf-8");
const workspaces = ["editor", "export-ai-rpg", "renderer-2d", "schema"];

describe("version consistency", () => {
  it("root version is valid semver", () => {
    const parts = rootPkg.version.split(".");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(parts.slice(0, 3).every((p: string) => /^\d+$/.test(p))).toBe(true);
  });

  it("version is >= 1.0.0", () => {
    const major = Number(rootPkg.version.split(".")[0]);
    expect(major).toBeGreaterThanOrEqual(1);
  });

  it("CHANGELOG contains current version", () => {
    expect(changelog).toContain(`[${rootPkg.version}]`);
  });

  it("all workspace packages match root version", () => {
    for (const ws of workspaces) {
      const pkg = JSON.parse(
        readFileSync(join(ROOT, "packages", ws, "package.json"), "utf-8"),
      );
      expect(pkg.version).toBe(rootPkg.version);
    }
  });

  it("LICENSE exists and is MIT", () => {
    const license = readFileSync(join(ROOT, "LICENSE"), "utf-8");
    expect(license).toContain("MIT");
  });
});

export interface BumpPlan {
  status: 'bumped' | 'major-only' | 'noop';
  currentVersion: string;
  currentMajor: number;
  targetVersion: string | null;
  newerMajorVersion: string | null;
  compareUrl: string | null;
  packages: string[];
}

export interface BumpResult extends BumpPlan {
  dryRun: boolean;
  updatedFiles: string[];
}

export function parseStableSemver(input: string): { major: number; minor: number; patch: number; raw: string } | null;
export function compareSemver(
  a: { major: number; minor: number; patch: number },
  b: { major: number; minor: number; patch: number },
): number;

export function selectBumpPlan(opts: {
  currentVersion: string;
  publishedByPackage: Record<string, readonly string[]>;
}): BumpPlan;

export function formatEngineBumpIssue(opts: {
  plan: BumpPlan;
  repository?: string;
  branch?: string;
}): { title: string; body: string };

export function applyEngineBump(opts?: {
  repoRoot?: string;
  dryRun?: boolean;
  fetchVersions?: (pkgName: string) => Promise<readonly string[]> | readonly string[];
  regenerateLockfile?: (repoRoot: string, enginePackages: string[], targetVersion: string) => void;
  regenerateEngineLists?: (repoRoot: string, targetVersion: string) => void;
}): Promise<BumpResult>;

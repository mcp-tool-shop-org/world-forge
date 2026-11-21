export const DEFAULT_REPO_ROOT: string;
export const GENERATED_REL_PATH: string;

export interface EngineSchemaListExports {
  SIM_AFFECTING_KEYS?: unknown;
  ALLOWED_PACK_KEYS?: unknown;
  ENCOUNTER_ANCHOR_TYPES?: unknown;
  EVALUATED_NOT_MAPPED_KEYS?: unknown;
}

export function resolveInstalledContentSchemaInfo(repoRoot?: string): { pkgDir: string; version: string };
export function computeEngineVersionRange(version: string): string;
export function renderEngineListsModule(opts: {
  version: string;
  schemaExports: EngineSchemaListExports;
}): string;
export function generateEngineLists(options?: {
  repoRoot?: string;
  outRelPath?: string;
  version?: string;
  schemaExports?: EngineSchemaListExports;
  write?: boolean;
}): Promise<{ outPath: string; version: string; content: string }>;

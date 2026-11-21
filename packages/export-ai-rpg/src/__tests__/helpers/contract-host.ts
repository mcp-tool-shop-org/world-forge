// contract-host.ts — Shared test helper wiring engine contract tests to the
// single runtime validation host factory used by `--validate-only` CLI checks.

import {
  createRuntimeValidationHost,
  runIsolatedGateAndIntake,
  withIsolatedIntakeHost,
  type IsolatedGateAndIntakeResult,
} from '../../engine-gate.js';
import type { Engine } from '@ai-rpg-engine/core';
import type { ExportResult } from '../../export.js';

/** Single runtime host factory shared by CLI validation and contract tests. */
export const contractValidationHostFactory = createRuntimeValidationHost;

export function runContractGateAndIntake(
  exported: Pick<ExportResult, 'contentPack' | 'manifest'>,
): IsolatedGateAndIntakeResult {
  return runIsolatedGateAndIntake(exported, undefined, contractValidationHostFactory);
}

export function withContractIntakeHost<T>(
  manifest: ExportResult['manifest'],
  fn: (host: Engine, gameId: string) => T,
): T {
  return withIsolatedIntakeHost(manifest, fn, contractValidationHostFactory);
}

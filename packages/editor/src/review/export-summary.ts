// export-summary.ts — Markdown and JSON summary export for review snapshots

import type { EnrichedReviewSnapshot } from '../panels/ReviewPanel.js';

/** Generate a sanitized filename for summary exports. */
export function summaryFilename(projectName: string, format: 'md' | 'json'): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'project'}-review.${format}`;
}

/** Convert an enriched review snapshot to clean Markdown. */
export function reviewSnapshotToMarkdown(snapshot: EnrichedReviewSnapshot): string {
  const lines: string[] = [];

  lines.push(`# ${snapshot.projectName} — Review Summary`);
  lines.push('');

  // Health
  lines.push(`## Health: ${snapshot.health.toUpperCase()}`);
  lines.push('');
  lines.push(snapshot.healthLabel);
  lines.push('');

  // Project overview
  lines.push('## Project Overview');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Name | ${snapshot.projectName} |`);
  lines.push(`| Mode | ${snapshot.modeLabel} |`);
  lines.push(`| Genre | ${snapshot.genre} |`);
  lines.push(`| Version | ${snapshot.version} |`);
  if (snapshot.description) {
    lines.push(`| Description | ${snapshot.description} |`);
  }
  lines.push('');

  // Content counts
  lines.push('## Content Counts');
  lines.push('');
  lines.push(`| Content | Count |`);
  lines.push(`|---------|-------|`);
  for (const [key, value] of Object.entries(snapshot.counts)) {
    lines.push(`| ${key} | ${value} |`);
  }
  lines.push('');

  // System completeness
  lines.push('## System Completeness');
  lines.push('');
  const systemEntries: [string, boolean][] = [
    ['Player Template', snapshot.systems.hasPlayerTemplate],
    ['Build Catalog', snapshot.systems.hasBuildCatalog],
    ['Progression Trees', snapshot.systems.hasProgressionTrees],
    ['Dialogues', snapshot.systems.hasDialogues],
    ['Spawn Points', snapshot.systems.hasSpawnPoints],
  ];
  for (const [label, ok] of systemEntries) {
    lines.push(`- ${ok ? '[x]' : '[ ]'} ${label}`);
  }
  if (snapshot.systems.missingLabels.length > 0) {
    lines.push('');
    lines.push(`**Missing:** ${snapshot.systems.missingLabels.join(', ')}`);
  }
  lines.push('');

  // Regions
  if (snapshot.regions.length > 0) {
    lines.push('## Regions');
    lines.push('');
    for (const r of snapshot.regions) {
      lines.push(`### ${r.name}`);
      lines.push('');
      lines.push(`- **Zones:** ${r.zoneCount} — ${r.zoneNames.join(', ')}`);
      if (r.controllingFaction) lines.push(`- **Faction:** ${r.controllingFaction}`);
      lines.push(`- **Metrics:** Commerce ${r.metrics.commerce}, Morale ${r.metrics.morale}, Safety ${r.metrics.safety}, Stability ${r.metrics.stability}`);
      if (r.entityCount > 0) {
        const roles = Object.entries(r.entityRoles).map(([role, count]) => `${role}: ${count}`).join(', ');
        lines.push(`- **Entities:** ${r.entityCount} (${roles})`);
      }
      if (r.encounterCount > 0) lines.push(`- **Encounters:** ${r.encounterCount}`);
      if (r.itemCount > 0) lines.push(`- **Items:** ${r.itemCount}`);
      lines.push('');
    }
    // Unassigned zones
    if (snapshot.unassignedZoneNames && snapshot.unassignedZoneNames.length > 0) {
      lines.push(`### Unassigned Zones`);
      lines.push('');
      lines.push(`${snapshot.unassignedZoneNames.length} zones not in any district: ${snapshot.unassignedZoneNames.join(', ')}`);
      lines.push('');
    }
  }

  // Encounters
  if (snapshot.encounters.totalCount > 0) {
    lines.push('## Encounters');
    lines.push('');
    lines.push(`| Type | Count |`);
    lines.push(`|------|-------|`);
    for (const [type, count] of Object.entries(snapshot.encounters.byType)) {
      lines.push(`| ${type} | ${count} |`);
    }
    lines.push('');
    lines.push(`- **Total:** ${snapshot.encounters.totalCount}`);
    lines.push(`- **Avg Probability:** ${(snapshot.encounters.avgProbability * 100).toFixed(0)}%`);
    lines.push(`- **Zones with Encounters:** ${snapshot.encounters.zonesWithEncounters}`);
    if (snapshot.encounters.bossEncounters > 0) {
      lines.push(`- **Boss Encounters:** ${snapshot.encounters.bossEncounters}`);
    }
    lines.push('');
  }

  // Connections
  if (snapshot.connections.totalCount > 0) {
    lines.push('## Connections');
    lines.push('');
    lines.push(`| Kind | Count |`);
    lines.push(`|------|-------|`);
    for (const [kind, count] of Object.entries(snapshot.connections.byKind)) {
      lines.push(`| ${kind} | ${count} |`);
    }
    lines.push('');
    lines.push(`- **Total:** ${snapshot.connections.totalCount}`);
    lines.push(`- **Bidirectional:** ${snapshot.connections.bidirectionalCount}`);
    lines.push(`- **One-way:** ${snapshot.connections.oneWayCount}`);
    if (snapshot.connections.conditionalCount > 0) {
      lines.push(`- **Conditional:** ${snapshot.connections.conditionalCount}`);
    }
    lines.push('');
  }

  // Dependencies
  lines.push('## Dependencies');
  lines.push('');
  if (snapshot.dependencies.totalIssues === 0) {
    lines.push('All references resolved.');
  } else {
    lines.push(`- **Broken:** ${snapshot.dependencies.broken}`);
    lines.push(`- **Mismatched:** ${snapshot.dependencies.mismatched}`);
    lines.push(`- **Orphaned:** ${snapshot.dependencies.orphaned}`);
    lines.push(`- **Total Issues:** ${snapshot.dependencies.totalIssues}`);
  }
  lines.push('');

  // Validation
  lines.push('## Validation');
  lines.push('');
  if (snapshot.validation.valid) {
    lines.push('No validation errors.');
  } else {
    lines.push(`**${snapshot.validation.errorCount} errors:**`);
    lines.push('');
    for (const [domain, count] of Object.entries(snapshot.validation.errorsByDomain)) {
      lines.push(`- ${domain}: ${count}`);
    }
    if (snapshot.validation.firstErrors.length > 0) {
      lines.push('');
      lines.push('First errors:');
      for (const e of snapshot.validation.firstErrors) {
        lines.push(`- \`${e.path}\`: ${e.message}`);
      }
    }
  }
  lines.push('');

  // Provenance
  if (snapshot.kitName || snapshot.importFormat || snapshot.bundleSource) {
    lines.push('## Provenance');
    lines.push('');
    if (snapshot.kitName) lines.push(`- **Kit:** ${snapshot.kitName}`);
    if (snapshot.importFormat) lines.push(`- **Import Format:** ${snapshot.importFormat}`);
    if (snapshot.bundleSource) lines.push(`- **Source:** ${snapshot.bundleSource}`);
    if (snapshot.importFidelityPercent != null) lines.push(`- **Fidelity:** ${snapshot.importFidelityPercent}%`);
    if (snapshot.hasExported) lines.push(`- **Exported:** Yes`);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`Generated: ${snapshot.generatedAt}`);
  lines.push('');

  return lines.join('\n');
}

/** Convert an enriched review snapshot to a structured JSON object. */
export function reviewSnapshotToJSON(snapshot: EnrichedReviewSnapshot): object {
  return {
    project: {
      name: snapshot.projectName,
      id: snapshot.projectId,
      version: snapshot.version,
      genre: snapshot.genre,
      mode: snapshot.mode,
      modeLabel: snapshot.modeLabel,
      description: snapshot.description,
    },
    health: {
      status: snapshot.health,
      label: snapshot.healthLabel,
    },
    counts: snapshot.counts,
    systems: snapshot.systems,
    regions: snapshot.regions,
    encounters: snapshot.encounters,
    connections: snapshot.connections,
    dependencies: snapshot.dependencies,
    validation: snapshot.validation,
    advisory: snapshot.advisory,
    provenance: {
      kit: snapshot.kitName ?? null,
      importFormat: snapshot.importFormat ?? null,
      bundleSource: snapshot.bundleSource ?? null,
      fidelityPercent: snapshot.importFidelityPercent ?? null,
      hasExported: snapshot.hasExported,
    },
    generatedAt: snapshot.generatedAt,
  };
}

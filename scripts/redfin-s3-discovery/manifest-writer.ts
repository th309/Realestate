/**
 * Manifest File Writer
 */

import * as fs from 'fs';
import * as path from 'path';
import type { RedfinDataset, DiscoveryManifest } from './types';

/**
 * Save discovery manifest to files
 */
export function saveManifest(datasets: RedfinDataset[]): void {
  const manifestDir = path.join(process.cwd(), 'redfin_downloads');

  if (!fs.existsSync(manifestDir)) {
    fs.mkdirSync(manifestDir, { recursive: true });
  }

  const manifest: DiscoveryManifest = {
    version: '2.0',
    discovered_at: new Date().toISOString(),
    total_datasets: datasets.length,
    datasets: datasets.map(d => ({
      name: d.name,
      description: d.description,
      url: d.url,
      category: d.category,
      geographic_level: d.geographicLevel,
      format: d.format,
      compressed: d.compressed
    }))
  };

  // Save JSON manifest
  const jsonPath = path.join(manifestDir, 's3-manifest.json');
  fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest saved to: ${jsonPath}`);

  // Save TypeScript manifest
  const tsPath = path.join(manifestDir, 's3-manifest.ts');
  const tsContent = generateTypeScriptManifest(manifest);
  fs.writeFileSync(tsPath, tsContent);
  console.log(`TypeScript manifest saved to: ${tsPath}`);
}

/**
 * Generate TypeScript manifest content
 */
function generateTypeScriptManifest(manifest: DiscoveryManifest): string {
  return `// Auto-generated Redfin S3 Dataset Manifest
// Generated at: ${manifest.discovered_at}

export interface RedfinS3Dataset {
  name: string
  description: string
  url: string
  category: string
  geographic_level: string
  format: 'tsv' | 'csv'
  compressed: boolean
}

export const REDFIN_S3_DATASETS: RedfinS3Dataset[] = ${JSON.stringify(manifest.datasets, null, 2)} as RedfinS3Dataset[]

export const REDFIN_S3_MANIFEST = {
  version: '${manifest.version}',
  discovered_at: '${manifest.discovered_at}',
  total_datasets: ${manifest.total_datasets},
  datasets: REDFIN_S3_DATASETS
}
`;
}

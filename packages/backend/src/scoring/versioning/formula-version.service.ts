/**
 * Formula Version Service
 *
 * Manages formula versions for PropertyIQ scores.
 * Supports versioning, rollback, and formula comparison.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { ScoreType } from '../scoring.types';

export interface FormulaConfig {
  components: Record<
    string,
    {
      weight: number;
      metrics: string[];
      normalization?: Record<string, unknown>;
    }
  >;
}

export interface FormulaVersion {
  id: string;
  version: string;
  scoreType: ScoreType;
  formulaConfig: FormulaConfig;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  isActive: boolean;
  isDefault: boolean;
  parentVersion: string | null;
  changeNotes: string | null;
}

export interface CreateVersionInput {
  scoreType: ScoreType;
  formulaConfig: FormulaConfig;
  description?: string;
  createdBy?: string;
  parentVersion?: string;
  changeNotes?: string;
}

@Injectable()
export class FormulaVersionService {
  private readonly logger = new Logger(FormulaVersionService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get the active formula version for a score type
   */
  async getActiveVersion(scoreType: ScoreType): Promise<FormulaVersion | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_formula_versions')
      .select('*')
      .eq('score_type', scoreType)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    return this.mapDbToVersion(data);
  }

  /**
   * Get the default formula version for a score type
   */
  async getDefaultVersion(scoreType: ScoreType): Promise<FormulaVersion | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_formula_versions')
      .select('*')
      .eq('score_type', scoreType)
      .eq('is_default', true)
      .single();

    if (error || !data) return null;

    return this.mapDbToVersion(data);
  }

  /**
   * Get a specific formula version
   */
  async getVersion(version: string, scoreType: ScoreType): Promise<FormulaVersion | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_formula_versions')
      .select('*')
      .eq('version', version)
      .eq('score_type', scoreType)
      .single();

    if (error || !data) return null;

    return this.mapDbToVersion(data);
  }

  /**
   * Get all versions for a score type
   */
  async getAllVersions(scoreType: ScoreType): Promise<FormulaVersion[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('propertyiq_formula_versions')
      .select('*')
      .eq('score_type', scoreType)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map(this.mapDbToVersion);
  }

  /**
   * Create a new formula version
   */
  async createVersion(input: CreateVersionInput): Promise<FormulaVersion> {
    const client = this.supabase.getClient();

    // Generate new version number
    const newVersion = await this.generateVersionNumber(input.scoreType, input.parentVersion);

    const { data, error } = await client
      .from('propertyiq_formula_versions')
      .insert({
        version: newVersion,
        score_type: input.scoreType,
        formula_config: input.formulaConfig,
        description: input.description,
        created_by: input.createdBy,
        parent_version: input.parentVersion,
        change_notes: input.changeNotes,
        is_active: false, // New versions are not active by default
        is_default: false,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`Error creating formula version: ${error?.message}`);
      throw new Error(`Failed to create formula version: ${error?.message}`);
    }

    this.logger.log(`Created formula version ${newVersion} for ${input.scoreType}`);

    return this.mapDbToVersion(data);
  }

  /**
   * Activate a formula version (makes it the current version used for scoring)
   */
  async activateVersion(version: string, scoreType: ScoreType): Promise<void> {
    const client = this.supabase.getClient();

    // First, deactivate all other versions for this score type
    await client
      .from('propertyiq_formula_versions')
      .update({ is_active: false })
      .eq('score_type', scoreType);

    // Then activate the specified version
    const { error } = await client
      .from('propertyiq_formula_versions')
      .update({ is_active: true })
      .eq('version', version)
      .eq('score_type', scoreType);

    if (error) {
      this.logger.error(`Error activating version ${version}: ${error.message}`);
      throw error;
    }

    this.logger.log(`Activated formula version ${version} for ${scoreType}`);
  }

  /**
   * Set a version as the default (baseline for comparisons)
   */
  async setDefaultVersion(version: string, scoreType: ScoreType): Promise<void> {
    const client = this.supabase.getClient();

    // First, clear default from all versions for this score type
    await client
      .from('propertyiq_formula_versions')
      .update({ is_default: false })
      .eq('score_type', scoreType);

    // Then set the specified version as default
    const { error } = await client
      .from('propertyiq_formula_versions')
      .update({ is_default: true })
      .eq('version', version)
      .eq('score_type', scoreType);

    if (error) {
      this.logger.error(`Error setting default version ${version}: ${error.message}`);
      throw error;
    }

    this.logger.log(`Set formula version ${version} as default for ${scoreType}`);
  }

  /**
   * Rollback to a previous version
   */
  async rollback(version: string, scoreType: ScoreType): Promise<void> {
    const targetVersion = await this.getVersion(version, scoreType);

    if (!targetVersion) {
      throw new Error(`Version ${version} not found for ${scoreType}`);
    }

    await this.activateVersion(version, scoreType);

    this.logger.log(`Rolled back ${scoreType} to version ${version}`);
  }

  /**
   * Compare two formula versions
   */
  compareVersions(
    version1: FormulaVersion,
    version2: FormulaVersion,
  ): {
    weightChanges: Array<{ component: string; oldWeight: number; newWeight: number }>;
    addedComponents: string[];
    removedComponents: string[];
    metricChanges: Array<{
      component: string;
      added: string[];
      removed: string[];
    }>;
  } {
    const result = {
      weightChanges: [] as Array<{ component: string; oldWeight: number; newWeight: number }>,
      addedComponents: [] as string[],
      removedComponents: [] as string[],
      metricChanges: [] as Array<{ component: string; added: string[]; removed: string[] }>,
    };

    const components1 = Object.keys(version1.formulaConfig.components);
    const components2 = Object.keys(version2.formulaConfig.components);

    // Find added/removed components
    result.addedComponents = components2.filter((c) => !components1.includes(c));
    result.removedComponents = components1.filter((c) => !components2.includes(c));

    // Compare shared components
    const sharedComponents = components1.filter((c) => components2.includes(c));

    for (const component of sharedComponents) {
      const config1 = version1.formulaConfig.components[component];
      const config2 = version2.formulaConfig.components[component];

      // Weight changes
      if (config1.weight !== config2.weight) {
        result.weightChanges.push({
          component,
          oldWeight: config1.weight,
          newWeight: config2.weight,
        });
      }

      // Metric changes
      const metrics1 = new Set(config1.metrics);
      const metrics2 = new Set(config2.metrics);

      const addedMetrics = config2.metrics.filter((m) => !metrics1.has(m));
      const removedMetrics = config1.metrics.filter((m) => !metrics2.has(m));

      if (addedMetrics.length > 0 || removedMetrics.length > 0) {
        result.metricChanges.push({
          component,
          added: addedMetrics,
          removed: removedMetrics,
        });
      }
    }

    return result;
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private async generateVersionNumber(
    scoreType: ScoreType,
    parentVersion?: string,
  ): Promise<string> {
    if (parentVersion) {
      // Increment patch version from parent
      const parts = parentVersion.split('.');
      if (parts.length === 3) {
        const patch = parseInt(parts[2], 10) + 1;
        return `${parts[0]}.${parts[1]}.${patch}`;
      }
    }

    // Get latest version for this score type
    const versions = await this.getAllVersions(scoreType);

    if (versions.length === 0) {
      return '1.0.0';
    }

    // Increment minor version
    const latest = versions[0].version;
    const parts = latest.split('.');
    if (parts.length === 3) {
      const minor = parseInt(parts[1], 10) + 1;
      return `${parts[0]}.${minor}.0`;
    }

    return '1.0.0';
  }

  private mapDbToVersion(row: Record<string, unknown>): FormulaVersion {
    return {
      id: row.id as string,
      version: row.version as string,
      scoreType: row.score_type as ScoreType,
      formulaConfig: row.formula_config as FormulaConfig,
      description: row.description as string | null,
      createdBy: row.created_by as string | null,
      createdAt: row.created_at as string,
      isActive: row.is_active as boolean,
      isDefault: row.is_default as boolean,
      parentVersion: row.parent_version as string | null,
      changeNotes: row.change_notes as string | null,
    };
  }
}

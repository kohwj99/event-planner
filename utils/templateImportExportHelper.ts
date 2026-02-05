// utils/templateImportExportHelper.ts
// Helper functions for importing and exporting table templates
// Supports single/multiple template export and import with name clash resolution

import { TableTemplateV2, CreateTemplateInputV2 } from '@/types/TemplateV2';
import JSZip from 'jszip';

// ============================================================================
// TYPES
// ============================================================================

export interface ExportedTemplate {
  version: string;
  exportedAt: string;
  template: Omit<TableTemplateV2, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>;
}

export interface ImportResult {
  success: boolean;
  importedCount: number;
  errors: string[];
  templates: CreateTemplateInputV2[];
}

// Current export format version
const EXPORT_VERSION = '2.0';

// ============================================================================
// NAME CLASH RESOLUTION
// ============================================================================

/**
 * Resolves name clashes by appending (x) suffix where x is the occurrence count
 * @param desiredName - The name to check for clashes
 * @param existingNames - Set of names that already exist
 * @returns A unique name with (x) suffix if needed
 */
export function resolveNameClash(desiredName: string, existingNames: Set<string>): string {
  if (!existingNames.has(desiredName)) {
    return desiredName;
  }

  // Extract base name (remove existing (x) suffix if present)
  const baseNameMatch = desiredName.match(/^(.+?)\s*\((\d+)\)$/);
  const baseName = baseNameMatch ? baseNameMatch[1].trim() : desiredName;

  let counter = 1;
  let newName = `${baseName} (${counter})`;

  while (existingNames.has(newName)) {
    counter++;
    newName = `${baseName} (${counter})`;
  }

  return newName;
}

/**
 * Resolves name clashes for multiple templates at once
 * @param templateNames - Array of template names to import
 * @param existingNames - Set of names that already exist
 * @returns Map of original names to resolved names
 */
export function resolveMultipleNameClashes(
  templateNames: string[],
  existingNames: Set<string>
): Map<string, string> {
  const nameMap = new Map<string, string>();
  const usedNames = new Set(existingNames);

  for (const name of templateNames) {
    const resolvedName = resolveNameClash(name, usedNames);
    nameMap.set(name, resolvedName);
    usedNames.add(resolvedName);
  }

  return nameMap;
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

/**
 * Prepares a single template for export (strips runtime-specific fields)
 * @param template - The template to export
 * @returns Exported template data without id, timestamps, and built-in flag
 */
function prepareTemplateForExport(
  template: TableTemplateV2
): Omit<TableTemplateV2, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'> {
  const { id, createdAt, updatedAt, isBuiltIn, ...exportData } = template;
  return exportData;
}

/**
 * Creates the export data structure for a single template
 * @param template - The template to export
 * @returns ExportedTemplate object
 */
function createExportData(template: TableTemplateV2): ExportedTemplate {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    template: prepareTemplateForExport(template),
  };
}

/**
 * Exports a single template to a JSON file
 * @param template - The template to export
 */
export function exportSingleTemplate(template: TableTemplateV2): void {
  const exportData = createExportData(template);
  const jsonString = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `template-${sanitizeFilename(template.name)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports multiple templates as individual JSON files in a zip folder
 * @param templates - Array of templates to export
 * @param folderName - Name for the zip file (defaults to 'templates-export')
 */
export async function exportMultipleTemplatesAsZip(
  templates: TableTemplateV2[],
  folderName: string = 'templates-export'
): Promise<void> {
  const zip = new JSZip();

  // Track used filenames to avoid duplicates within the zip
  const usedFilenames = new Set<string>();

  for (const template of templates) {
    const exportData = createExportData(template);
    const jsonString = JSON.stringify(exportData, null, 2);

    // Generate unique filename
    let baseFilename = `template-${sanitizeFilename(template.name)}`;
    let filename = `${baseFilename}.json`;
    let counter = 1;

    while (usedFilenames.has(filename)) {
      filename = `${baseFilename}-${counter}.json`;
      counter++;
    }

    usedFilenames.add(filename);
    zip.file(filename, jsonString);
  }

  // Generate and download the zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(folderName)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Sanitizes a filename by removing/replacing invalid characters
 * @param name - The name to sanitize
 * @returns Sanitized filename
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 50);
}

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================

/**
 * Validates a single template data structure
 * @param data - The data to validate
 * @returns Error message if invalid, null if valid
 */
function validateTemplateData(
  data: unknown
): string | null {
  if (!data || typeof data !== 'object') {
    return 'Invalid template data structure';
  }

  const template = data as Record<string, unknown>;

  if (!template.name || typeof template.name !== 'string') {
    return 'Template must have a valid name';
  }

  if (!template.config || typeof template.config !== 'object') {
    return 'Template must have a valid config';
  }

  const config = template.config as Record<string, unknown>;

  if (config.type !== 'circle' && config.type !== 'rectangle') {
    return 'Template config must have type "circle" or "rectangle"';
  }

  if (!template.sessionTypes || !Array.isArray(template.sessionTypes)) {
    return 'Template must have sessionTypes array';
  }

  return null;
}

/**
 * Parses and validates imported JSON data
 * @param jsonString - The JSON string to parse
 * @returns Parsed templates or error
 */
export function parseImportedData(
  jsonString: string
): { templates: Omit<TableTemplateV2, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>[]; errors: string[] } {
  const errors: string[] = [];
  const templates: Omit<TableTemplateV2, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>[] = [];

  try {
    const data = JSON.parse(jsonString);

    // Check if it's a bundle format (legacy - multiple templates in one file)
    if (data.templates && Array.isArray(data.templates)) {
      for (let i = 0; i < data.templates.length; i++) {
        const error = validateTemplateData(data.templates[i]);
        if (error) {
          errors.push(`Template ${i + 1}: ${error}`);
        } else {
          templates.push(data.templates[i]);
        }
      }
    }
    // Check if it's a single template export (standard format)
    else if (data.template) {
      const error = validateTemplateData(data.template);
      if (error) {
        errors.push(error);
      } else {
        templates.push(data.template);
      }
    }
    // Try to parse as a raw template (legacy format)
    else if (data.name && data.config) {
      const error = validateTemplateData(data);
      if (error) {
        errors.push(error);
      } else {
        templates.push(data);
      }
    } else {
      errors.push('Unrecognized template format');
    }
  } catch (e) {
    errors.push(`JSON parse error: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }

  return { templates, errors };
}

/**
 * Imports templates from a File object (JSON file)
 * @param file - The file to import
 * @param existingTemplateNames - Set of existing template names for clash resolution
 * @returns Promise resolving to import result
 */
export async function importTemplatesFromFile(
  file: File,
  existingTemplateNames: Set<string>
): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      const { templates, errors } = parseImportedData(content);

      if (templates.length === 0) {
        resolve({
          success: false,
          importedCount: 0,
          errors: errors.length > 0 ? errors : ['No valid templates found in file'],
          templates: [],
        });
        return;
      }

      // Resolve name clashes
      const templateNames = templates.map((t) => t.name);
      const nameMap = resolveMultipleNameClashes(templateNames, existingTemplateNames);

      // Create import inputs with resolved names
      const importInputs: CreateTemplateInputV2[] = templates.map((template) => ({
        ...template,
        name: nameMap.get(template.name) || template.name,
        isUserCreated: true,
      }));

      resolve({
        success: true,
        importedCount: importInputs.length,
        errors,
        templates: importInputs,
      });
    };

    reader.onerror = () => {
      resolve({
        success: false,
        importedCount: 0,
        errors: ['Failed to read file'],
        templates: [],
      });
    };

    reader.readAsText(file);
  });
}

/**
 * Imports templates from a zip file containing multiple JSON files
 * @param file - The zip file to import
 * @param existingTemplateNames - Set of existing template names for clash resolution
 * @returns Promise resolving to import result
 */
async function importTemplatesFromZip(
  file: File,
  existingTemplateNames: Set<string>
): Promise<ImportResult> {
  try {
    const zip = await JSZip.loadAsync(file);
    const allTemplates: Omit<TableTemplateV2, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>[] = [];
    const allErrors: string[] = [];

    // Process each file in the zip
    const filePromises: Promise<void>[] = [];

    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && relativePath.endsWith('.json')) {
        const promise = zipEntry.async('string').then((content) => {
          const { templates, errors } = parseImportedData(content);
          allTemplates.push(...templates);
          if (errors.length > 0) {
            allErrors.push(...errors.map((e) => `${relativePath}: ${e}`));
          }
        }).catch((err) => {
          allErrors.push(`${relativePath}: Failed to read file`);
        });
        filePromises.push(promise);
      }
    });

    await Promise.all(filePromises);

    if (allTemplates.length === 0) {
      return {
        success: false,
        importedCount: 0,
        errors: allErrors.length > 0 ? allErrors : ['No valid templates found in zip'],
        templates: [],
      };
    }

    // Resolve name clashes
    const templateNames = allTemplates.map((t) => t.name);
    const nameMap = resolveMultipleNameClashes(templateNames, existingTemplateNames);

    // Create import inputs with resolved names
    const importInputs: CreateTemplateInputV2[] = allTemplates.map((template) => ({
      ...template,
      name: nameMap.get(template.name) || template.name,
      isUserCreated: true,
    }));

    return {
      success: true,
      importedCount: importInputs.length,
      errors: allErrors,
      templates: importInputs,
    };
  } catch (err) {
    return {
      success: false,
      importedCount: 0,
      errors: ['Failed to read zip file'],
      templates: [],
    };
  }
}

/**
 * Imports templates from multiple File objects (JSON or ZIP files)
 * @param files - The files to import
 * @param existingTemplateNames - Set of existing template names for clash resolution
 * @returns Promise resolving to combined import result
 */
export async function importTemplatesFromFiles(
  files: FileList | File[],
  existingTemplateNames: Set<string>
): Promise<ImportResult> {
  const allTemplates: CreateTemplateInputV2[] = [];
  const allErrors: string[] = [];
  const usedNames = new Set(existingTemplateNames);

  for (const file of Array.from(files)) {
    const isZip = file.name.endsWith('.zip');
    const isJson = file.name.endsWith('.json');

    if (!isZip && !isJson) {
      allErrors.push(`${file.name}: Unsupported file type (use .json or .zip)`);
      continue;
    }

    let result: ImportResult;

    if (isZip) {
      result = await importTemplatesFromZip(file, usedNames);
    } else {
      result = await importTemplatesFromFile(file, usedNames);
    }

    if (result.success) {
      // Add resolved names to used names set
      result.templates.forEach((t) => usedNames.add(t.name));
      allTemplates.push(...result.templates);
    }

    if (result.errors.length > 0) {
      allErrors.push(...result.errors.map((e) => `${file.name}: ${e}`));
    }
  }

  return {
    success: allTemplates.length > 0,
    importedCount: allTemplates.length,
    errors: allErrors,
    templates: allTemplates,
  };
}

// ============================================================================
// FILE INPUT HELPERS
// ============================================================================

/**
 * Creates a hidden file input and triggers it
 * @param onFilesSelected - Callback when files are selected
 * @param multiple - Whether to allow multiple file selection
 */
export function triggerFileInput(
  onFilesSelected: (files: FileList) => void,
  multiple: boolean = true
): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.zip';
  input.multiple = multiple;

  input.onchange = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  input.click();
}
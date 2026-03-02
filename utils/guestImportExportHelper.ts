/**
 * guestImportExportHelper.ts
 *
 * Guest list import (Excel/CSV) and export utilities.
 * Handles duplicate column headers (e.g. multiple "#" tag columns)
 * by using position-based (array-of-arrays) parsing.
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Guest } from '@/store/guestStore';
import { toUpperCamelCase } from '@/utils/tagUtils';

export type ParsedGuest = Omit<Guest, 'id' | 'fromHost'>;

/**
 * Parse guest rows (arrays of arrays) using column indices.
 * Columns after Ranking with header "#" become tags; all others become meal plans.
 * Tag and meal plan columns may be interleaved in any order.
 */
export function parseGuestData(rows: unknown[][], headers: string[]): ParsedGuest[] {
  const normalizedHeaders = headers.map(h => (h || '').toLowerCase().trim());

  // Find column indices for base columns
  const nameIdx = normalizedHeaders.findIndex(h => h === 'name');
  const countryIdx = normalizedHeaders.findIndex(h => h === 'country');
  const companyIdx = normalizedHeaders.findIndex(h => h === 'company');
  const titleIdx = normalizedHeaders.findIndex(h => h === 'title');
  const rankingIdx = normalizedHeaders.findIndex(h => h === 'ranking');

  // Collect tag (#) and meal plan column indices after Ranking
  const tagColumnIndices: number[] = [];
  const mealPlanColumnIndices: number[] = [];
  if (rankingIdx !== -1) {
    for (let i = rankingIdx + 1; i < headers.length; i++) {
      const rawHeader = String(headers[i] || '').trim();
      if (!rawHeader) continue;

      if (rawHeader === '#') {
        tagColumnIndices.push(i);
      } else {
        mealPlanColumnIndices.push(i);
      }
    }
  }

  return rows
    .filter(row => {
      if (nameIdx === -1) return false;
      const name = row[nameIdx];
      return name !== undefined && name !== null && String(name).trim() !== '';
    })
    .map(row => {
      // Extract tags by column index
      const tags: string[] = [];
      tagColumnIndices.forEach(idx => {
        const value = row[idx];
        const trimmed = value !== undefined && value !== null ? String(value).trim() : '';
        if (trimmed) {
          const normalized = toUpperCamelCase(trimmed);
          if (normalized && !tags.includes(normalized)) {
            tags.push(normalized);
          }
        }
      });

      // Extract meal plans by column index
      const mealPlans: string[] = [];
      mealPlanColumnIndices.forEach(idx => {
        const value = row[idx];
        if (value !== undefined && value !== null && String(value).trim()) {
          mealPlans.push(String(value).trim());
        } else {
          mealPlans.push('');
        }
      });

      // Trim trailing empty meal plans but preserve ones in between
      let lastNonEmptyIndex = -1;
      for (let i = mealPlans.length - 1; i >= 0; i--) {
        if (mealPlans[i]) {
          lastNonEmptyIndex = i;
          break;
        }
      }
      const trimmedMealPlans = lastNonEmptyIndex >= 0
        ? mealPlans.slice(0, lastNonEmptyIndex + 1)
        : [];

      // Parse ranking - preserve decimals like 1.5, 2.3
      const rawRanking = rankingIdx !== -1 ? row[rankingIdx] : undefined;
      const parsedRanking = parseFloat(String(rawRanking));
      const ranking = !isNaN(parsedRanking) && parsedRanking > 0 ? parsedRanking : 10;

      return {
        name: nameIdx !== -1 ? String(row[nameIdx] ?? '') : '',
        country: countryIdx !== -1 ? String(row[countryIdx] ?? '') : '',
        company: companyIdx !== -1 ? String(row[companyIdx] ?? '') : '',
        title: titleIdx !== -1 ? String(row[titleIdx] ?? '') : '',
        ranking,
        mealPlans: trimmedMealPlans,
        tags,
      };
    });
}

/**
 * Parse an Excel file (.xlsx/.xls) into guest data.
 * Uses array-of-arrays mode to handle duplicate column headers.
 */
export async function parseExcelFile(file: File): Promise<ParsedGuest[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

  const allRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];
  if (allRows.length < 2) return [];

  const headers = (allRows[0] as unknown[]).map(h => String(h ?? ''));
  const dataRows = allRows.slice(1).filter(row =>
    (row as unknown[]).some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')
  );

  return parseGuestData(dataRows, headers);
}

/**
 * Parse a CSV file into guest data.
 * Uses header: false mode to handle duplicate column headers.
 */
export function parseCSVFile(file: File): Promise<ParsedGuest[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const allRows = results.data as unknown[][];
          if (allRows.length < 2) {
            resolve([]);
            return;
          }
          const headers = (allRows[0] as unknown[]).map((h: unknown) => String(h ?? ''));
          const dataRows = allRows.slice(1);

          resolve(parseGuestData(dataRows, headers));
        } catch (error) {
          reject(error);
        }
      },
      error: (error: Error) => reject(error),
    });
  });
}

/**
 * Generate a template Excel workbook for guest list import.
 */
export function buildGuestTemplateWorkbook(): XLSX.WorkBook {
  const headerRow = ['Name', 'Country', 'Company', 'Title', 'Ranking', 'Meal Plan 1', 'Meal Plan 2', 'Meal Plan 3', '#'];
  const sampleRow = ['John Doe', 'Singapore', 'Example Corp', 'CEO', 1, 'Vegetarian', 'No Nuts', '', 'Cybersecurity'];

  const ws = XLSX.utils.aoa_to_sheet([headerRow, sampleRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Guest List Template');
  return wb;
}

/**
 * Build an Excel workbook from the current guest list.
 * Dynamically creates meal plan and # (tag) columns based on guest data.
 */
export function buildCurrentGuestsWorkbook(guests: Guest[], sheetName: string): XLSX.WorkBook {
  let maxMealPlansInExport = 0;
  let maxTagsInExport = 0;
  guests.forEach(g => {
    if (g.mealPlans && g.mealPlans.length > maxMealPlansInExport) {
      maxMealPlansInExport = g.mealPlans.length;
    }
    if (g.tags && g.tags.length > maxTagsInExport) {
      maxTagsInExport = g.tags.length;
    }
  });

  const headerRow = [
    'Name', 'Country', 'Company', 'Title', 'Ranking',
    ...Array.from({ length: maxMealPlansInExport }, (_, i) => `Meal Plan ${i + 1}`),
    ...Array.from({ length: maxTagsInExport }, () => '#'),
  ];

  const dataRows = guests.map(g => {
    const row: (string | number)[] = [
      g.name, g.country, g.company, g.title, g.ranking,
      ...Array.from({ length: maxMealPlansInExport }, (_, i) => g.mealPlans?.[i] || ''),
      ...Array.from({ length: maxTagsInExport }, (_, i) => g.tags?.[i] || ''),
    ];
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

/**
 * Write a workbook to a file download.
 */
export function downloadWorkbook(workbook: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(workbook, filename);
}

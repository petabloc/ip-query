/**
 * CSV parser for timestamp input files
 */

import { parseTimeInput, splitTimeAroundCenter, TimeRange } from './time-parser.js';

export interface CSVTimeEntry {
  originalRow: string;
  rowNumber: number;
  timeRange: TimeRange;
  format: 'format1' | 'format2' | 'format3';
  description: string;
}

export interface CSVParseResult {
  entries: CSVTimeEntry[];
  errors: string[];
  detectedFormat: 'format1' | 'format2' | 'format3' | 'mixed' | 'unknown';
  summary: {
    totalRows: number;
    validEntries: number;
    errorCount: number;
    timeSpanSeconds?: number; // For format 1
  };
}

/**
 * Parse CSV content and determine format
 */
export function parseCSVTimestamps(content: string, timeSpanSeconds?: number): CSVParseResult {
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  if (lines.length === 0) {
    return {
      entries: [],
      errors: ['No valid CSV data found'],
      detectedFormat: 'unknown',
      summary: { totalRows: 0, validEntries: 0, errorCount: 1 },
    };
  }

  const result: CSVParseResult = {
    entries: [],
    errors: [],
    detectedFormat: 'unknown',
    summary: { totalRows: lines.length, validEntries: 0, errorCount: 0 },
  };

  // Detect format by analyzing first few rows
  const detectedFormat = detectCSVFormat(lines);
  result.detectedFormat = detectedFormat;

  if (detectedFormat === 'unknown') {
    result.errors.push('Unable to detect CSV format. See --help for supported formats.');
    result.summary.errorCount = lines.length;
    return result;
  }

  // Parse based on detected format
  switch (detectedFormat) {
    case 'format1':
      return parseFormat1(lines, timeSpanSeconds, result);
    case 'format2':
      return parseFormat2(lines, result);
    case 'format3':
      return parseFormat3(lines, result);
    default:
      result.errors.push('Mixed or unsupported CSV format detected');
      result.summary.errorCount = lines.length;
      return result;
  }
}

/**
 * Detect CSV format from sample rows
 */
function detectCSVFormat(lines: string[]): 'format1' | 'format2' | 'format3' | 'mixed' | 'unknown' {
  const sampleSize = Math.min(3, lines.length);
  const samples = lines.slice(0, sampleSize);

  const formats: string[] = [];

  for (const line of samples) {
    const columns = parseCSVRow(line);

    if (columns.length === 1) {
      // Could be Format 1 (single column of dates)
      formats.push('format1');
    } else if (columns.length === 2) {
      // Could be Format 2 (datetime, span) or Format 3 (start, end)
      try {
        // Try parsing second column as number (Format 2)
        const secondCol = columns[1].trim();

        // Only consider it a number if it's purely numeric (with optional decimal)
        if (/^\d+(\.\d+)?$/.test(secondCol)) {
          const spanSeconds = parseFloat(secondCol);

          if (spanSeconds > 0 && spanSeconds <= 3600) {
            formats.push('format2');
          } else {
            // Out of range for duration, try parsing as timestamp (Format 3)
            parseTimeInput(secondCol);
            formats.push('format3');
          }
        } else {
          // Try parsing as datetime (Format 3)
          parseTimeInput(secondCol);
          formats.push('format3');
        }
      } catch {
        // Could still be Format 3 with invalid second datetime
        formats.push('format3');
      }
    } else {
      formats.push('unknown');
    }
  }

  // Determine overall format
  const uniqueFormats = [...new Set(formats)];

  if (uniqueFormats.length === 1) {
    return uniqueFormats[0] as 'format1' | 'format2' | 'format3' | 'unknown';
  } else if (uniqueFormats.length > 1 && !uniqueFormats.includes('unknown')) {
    return 'mixed';
  } else {
    return 'unknown';
  }
}

/**
 * Parse Format 1: Single column of datetimes with uniform time span
 */
function parseFormat1(
  lines: string[],
  timeSpanSeconds: number | undefined,
  result: CSVParseResult
): CSVParseResult {
  if (!timeSpanSeconds) {
    result.errors.push('timeSpanSeconds is required for single-column CSV');
    result.summary.errorCount = lines.length;
    return result;
  }

  if (timeSpanSeconds < 1 || timeSpanSeconds > 3600) {
    result.errors.push(
      `Invalid time span: ${timeSpanSeconds}. Must be between 1 and 3600 seconds.`
    );
    result.summary.errorCount = lines.length;
    return result;
  }

  result.summary.timeSpanSeconds = timeSpanSeconds;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1;

    try {
      const columns = parseCSVRow(line);
      if (columns.length !== 1) {
        result.errors.push(
          `Row ${rowNumber}: Expected 1 column for Format 1, got ${columns.length}`
        );
        result.summary.errorCount++;
        continue;
      }

      const parsedTime = parseTimeInput(columns[0]);
      const timeRange = splitTimeAroundCenter(parsedTime, timeSpanSeconds);

      result.entries.push({
        originalRow: line,
        rowNumber,
        timeRange,
        format: 'format1',
        description: `${parsedTime.originalInput} ±${Math.floor(timeSpanSeconds / 2)}s`,
      });

      result.summary.validEntries++;
    } catch (error) {
      result.errors.push(
        `Row ${rowNumber}: ${error instanceof Error ? error.message : 'Parse error'}`
      );
      result.summary.errorCount++;
    }
  }

  return result;
}

/**
 * Parse Format 2: datetime, span_seconds
 */
function parseFormat2(lines: string[], result: CSVParseResult): CSVParseResult {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1;

    try {
      const columns = parseCSVRow(line);
      if (columns.length !== 2) {
        result.errors.push(
          `Row ${rowNumber}: Expected 2 columns for Format 2, got ${columns.length}`
        );
        result.summary.errorCount++;
        continue;
      }

      const parsedTime = parseTimeInput(columns[0]);
      const spanSeconds = parseFloat(columns[1].trim());

      if (isNaN(spanSeconds) || spanSeconds < 1 || spanSeconds > 3600) {
        result.errors.push(
          `Row ${rowNumber}: Invalid duration '${columns[1]}'. Duration must be between 1 and 3600 seconds.`
        );
        result.summary.errorCount++;
        continue;
      }

      const timeRange = splitTimeAroundCenter(parsedTime, spanSeconds);

      result.entries.push({
        originalRow: line,
        rowNumber,
        timeRange,
        format: 'format2',
        description: `${parsedTime.originalInput} ±${Math.floor(spanSeconds / 2)}s`,
      });

      result.summary.validEntries++;
    } catch (error) {
      result.errors.push(
        `Row ${rowNumber}: ${error instanceof Error ? error.message : 'Parse error'}`
      );
      result.summary.errorCount++;
    }
  }

  return result;
}

/**
 * Parse Format 3: start_time, end_time
 */
function parseFormat3(lines: string[], result: CSVParseResult): CSVParseResult {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const rowNumber = i + 1;

    try {
      const columns = parseCSVRow(line);
      if (columns.length !== 2) {
        result.errors.push(
          `Row ${rowNumber}: Expected 2 columns for Format 3, got ${columns.length}`
        );
        result.summary.errorCount++;
        continue;
      }

      const startTime = parseTimeInput(columns[0]);
      const endTime = parseTimeInput(columns[1]);

      const duration = endTime.epochSeconds - startTime.epochSeconds;
      if (duration < 1) {
        result.errors.push(`Row ${rowNumber}: Minimum time span is 1 second`);
        result.summary.errorCount++;
        continue;
      }

      if (duration > 3600) {
        result.errors.push(`Row ${rowNumber}: Maximum time span is 1 hour`);
        result.summary.errorCount++;
        continue;
      }

      const timeRange: TimeRange = {
        startTime: startTime.epochSeconds,
        endTime: endTime.epochSeconds,
        duration,
      };

      result.entries.push({
        originalRow: line,
        rowNumber,
        timeRange,
        format: 'format3',
        description: `${startTime.originalInput} → ${endTime.originalInput} (${duration}s)`,
      });

      result.summary.validEntries++;
    } catch (error) {
      result.errors.push(
        `Row ${rowNumber}: ${error instanceof Error ? error.message : 'Parse error'}`
      );
      result.summary.errorCount++;
    }
  }

  return result;
}

/**
 * Parse a single CSV row, handling quoted fields
 */
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < row.length) {
    const char = row[i];

    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());

  return result;
}

/**
 * Generate CSV format help text
 */
export function getCSVFormatHelp(): string {
  return `
📊 CSV Input Format Guide

The tool supports three CSV formats for timestamp input:

FORMAT 1: Single Column with Uniform Time Span
------------------------------------------
Required: --time-in-seconds parameter
CSV Content:
  2025-07-26T00:49:16Z
  2025-07-26T07:01:03Z
  1753490956

Usage: ip-query --file-in data.csv --time-in-seconds 5

FORMAT 2: DateTime and Individual Time Spans
------------------------------------------
CSV Content:
  2025-07-26T00:49:16Z,5
  2025-07-26T07:01:03Z,10
  1753490956,2

Column 1: Timestamp (any supported format)
Column 2: Time span in seconds (1-3600)

FORMAT 3: Start and End Times
---------------------------
CSV Content:
  2025-07-26T00:49:16Z,2025-07-26T00:49:21Z
  2025-07-26T07:01:03Z,2025-07-26T07:01:13Z
  1753490956,1753490966

Column 1: Start timestamp
Column 2: End timestamp
Maximum span: 1 hour (3600 seconds) per row

NOTES:
• Comments starting with # are ignored
• Quoted fields supported: "2025-07-26 00:49:16","5"
• Empty rows are ignored
• Time spans are centered around the timestamp (Format 1 & 2)
• All timestamp formats from the main tool are supported
`;
}

/**
 * Convert CSV entries to time ranges for analysis
 */
export function csvEntriesToTimeRanges(entries: CSVTimeEntry[]): TimeRange[] {
  return entries.map(entry => entry.timeRange);
}

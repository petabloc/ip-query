/**
 * Time parsing utilities for various time formats
 */

export interface ParsedTime {
  originalInput: string;
  parsedDate: Date;
  epochSeconds: number;
  format: string;
}

export interface TimeRange {
  startTime: number;
  endTime: number;
  duration: number;
}

/**
 * Parse various time input formats
 */
export function parseTimeInput(input: string): ParsedTime {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error('Time input cannot be empty');
  }

  // Try different parsing strategies
  const parsers = [
    parseISO8601,
    parseUnixTimestamp,
    parseSimpleDateTime,
    parseYearMonthDayHourMinute,
    parseEpochMilliseconds,
  ];

  for (const parser of parsers) {
    try {
      const result = parser(trimmed);
      if (result) {
        return result;
      }
    } catch {
      // Continue to next parser
    }
  }

  throw new Error(
    `Unable to parse time format: ${trimmed}. Supported formats: ISO 8601, Unix timestamp, YYYY-MM-DD HH:MM:SS, etc.`
  );
}

/**
 * Parse ISO 8601 format (e.g., 2025-07-26T00:49:16.2146161Z)
 */
function parseISO8601(input: string): ParsedTime | null {
  // Support both Z and timezone offset formats
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

  if (!isoRegex.test(input)) {
    return null;
  }

  const date = new Date(input);
  if (isNaN(date.getTime())) {
    return null;
  }

  return {
    originalInput: input,
    parsedDate: date,
    epochSeconds: Math.floor(date.getTime() / 1000),
    format: 'ISO 8601',
  };
}

/**
 * Parse Unix timestamp (seconds)
 */
function parseUnixTimestamp(input: string): ParsedTime | null {
  const num = parseFloat(input);

  // Check if it's a reasonable Unix timestamp (between 1970 and 2100)
  if (isNaN(num) || num < 0 || num > 4102444800) {
    return null;
  }

  // If it looks like seconds (reasonable range for current times)
  if (num > 946684800 && num < 4102444800) {
    // 2000-01-01 to 2100-01-01
    const date = new Date(num * 1000);
    return {
      originalInput: input,
      parsedDate: date,
      epochSeconds: Math.floor(num),
      format: 'Unix timestamp (seconds)',
    };
  }

  return null;
}

/**
 * Parse epoch milliseconds
 */
function parseEpochMilliseconds(input: string): ParsedTime | null {
  const num = parseFloat(input);

  // Check if it's a reasonable millisecond timestamp
  if (isNaN(num) || num < 946684800000 || num > 4102444800000) {
    return null;
  }

  const date = new Date(num);
  if (isNaN(date.getTime())) {
    return null;
  }

  return {
    originalInput: input,
    parsedDate: date,
    epochSeconds: Math.floor(date.getTime() / 1000),
    format: 'Unix timestamp (milliseconds)',
  };
}

/**
 * Parse simple date time format (e.g., 2025-07-26 00:49:16)
 */
function parseSimpleDateTime(input: string): ParsedTime | null {
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/,
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/,
    /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/,
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = input.match(pattern);
    if (match) {
      let year, month, day, hour, minute, second;

      // Patterns 4 and 5 (indices 4 and 5) are MM/DD/YYYY formats
      if (i >= 4) {
        // MM/DD/YYYY format
        [, month, day, year, hour, minute, second] = match;
      } else {
        // YYYY-MM-DD or YYYY/MM/DD format
        [, year, month, day, hour, minute, second] = match;
      }

      const date = new Date(
        parseInt(year),
        parseInt(month) - 1, // Month is 0-indexed
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second) || 0
      );

      if (
        isNaN(date.getTime()) ||
        parseInt(month) < 1 ||
        parseInt(month) > 12 ||
        parseInt(day) < 1 ||
        parseInt(day) > 31 ||
        parseInt(hour) < 0 ||
        parseInt(hour) > 23 ||
        parseInt(minute) < 0 ||
        parseInt(minute) > 59 ||
        parseInt(second || '0') < 0 ||
        parseInt(second || '0') > 59
      ) {
        continue;
      }

      // Validate that the parsed date matches the input (prevents silent date corruption)
      if (
        date.getFullYear() !== parseInt(year) ||
        date.getMonth() !== parseInt(month) - 1 ||
        date.getDate() !== parseInt(day) ||
        date.getHours() !== parseInt(hour) ||
        date.getMinutes() !== parseInt(minute) ||
        date.getSeconds() !== parseInt(second || '0')
      ) {
        continue; // Date was "corrected" by JavaScript, reject it
      }

      return {
        originalInput: input,
        parsedDate: date,
        epochSeconds: Math.floor(date.getTime() / 1000),
        format: 'Simple date time',
      };
    }
  }

  return null;
}

/**
 * Parse year-month-day-hour-minute format (minimum required)
 */
function parseYearMonthDayHourMinute(input: string): ParsedTime | null {
  const patterns = [
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = input.match(pattern);
    if (match) {
      let year, month, day, hour, minute;

      // Pattern 2 (index 2) is MM/DD/YYYY format
      if (i >= 2) {
        // MM/DD/YYYY format
        [, month, day, year, hour, minute] = match;
      } else {
        // YYYY-MM-DD or YYYY/MM/DD format
        [, year, month, day, hour, minute] = match;
      }

      const date = new Date(
        parseInt(year),
        parseInt(month) - 1, // Month is 0-indexed
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        0 // Seconds start at 0
      );

      if (isNaN(date.getTime())) {
        continue;
      }

      // Validate that the parsed date matches the input (prevents silent date corruption)
      if (
        date.getFullYear() !== parseInt(year) ||
        date.getMonth() !== parseInt(month) - 1 ||
        date.getDate() !== parseInt(day) ||
        date.getHours() !== parseInt(hour) ||
        date.getMinutes() !== parseInt(minute)
      ) {
        continue; // Date was "corrected" by JavaScript, reject it
      }

      return {
        originalInput: input,
        parsedDate: date,
        epochSeconds: Math.floor(date.getTime() / 1000),
        format: 'Year-month-day-hour-minute',
      };
    }
  }

  return null;
}

/**
 * Create a time range with proper validation
 */
export function createTimeRange(startTime: ParsedTime, endTime: ParsedTime): TimeRange {
  const duration = endTime.epochSeconds - startTime.epochSeconds;

  if (duration < 1) {
    throw new Error('Minimum time span is 1 second');
  }

  if (duration > 3600) {
    throw new Error('Maximum time span is 1 hour (3600 seconds)');
  }

  return {
    startTime: startTime.epochSeconds,
    endTime: endTime.epochSeconds,
    duration,
  };
}

/**
 * Split time around a center point (for single timestamp analysis)
 */
export function splitTimeAroundCenter(centerTime: ParsedTime, windowSeconds: number): TimeRange {
  const halfWindow = Math.floor(windowSeconds / 2);
  const startTime = centerTime.epochSeconds - halfWindow;
  const endTime = centerTime.epochSeconds + (windowSeconds - halfWindow);

  return {
    startTime,
    endTime,
    duration: windowSeconds,
  };
}

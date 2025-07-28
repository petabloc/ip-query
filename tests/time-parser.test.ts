import { describe, it, expect } from '@jest/globals';
import { parseTimeInput, createTimeRange, splitTimeAroundCenter } from '../src/time-parser';

describe('Time Parser Comprehensive Tests', () => {
  describe('ISO 8601 Format Tests', () => {
    it('should parse basic ISO 8601 with Z timezone', () => {
      const result = parseTimeInput('2025-07-26T00:49:16Z');
      expect(result.format).toBe('ISO 8601');
      expect(result.epochSeconds).toBe(1753490956);
      expect(result.originalInput).toBe('2025-07-26T00:49:16Z');
    });

    it('should parse ISO 8601 with milliseconds', () => {
      const result = parseTimeInput('2025-07-26T00:49:16.123Z');
      expect(result.format).toBe('ISO 8601');
      expect(result.epochSeconds).toBe(1753490956);
      expect(result.originalInput).toBe('2025-07-26T00:49:16.123Z');
    });

    it('should parse ISO 8601 with microseconds', () => {
      const result = parseTimeInput('2025-07-26T00:49:16.2146161Z');
      expect(result.format).toBe('ISO 8601');
      expect(result.epochSeconds).toBe(1753490956);
      expect(result.originalInput).toBe('2025-07-26T00:49:16.2146161Z');
    });

    it('should parse ISO 8601 with various fractional second precisions', () => {
      const testCases = [
        '2025-07-26T00:49:16.1Z', // 1 decimal place
        '2025-07-26T00:49:16.12Z', // 2 decimal places
        '2025-07-26T00:49:16.123Z', // 3 decimal places (milliseconds)
        '2025-07-26T00:49:16.1234Z', // 4 decimal places
        '2025-07-26T00:49:16.12345Z', // 5 decimal places
        '2025-07-26T00:49:16.123456Z', // 6 decimal places (microseconds)
        '2025-07-26T00:49:16.1234567Z', // 7 decimal places
      ];

      testCases.forEach(input => {
        const result = parseTimeInput(input);
        expect(result.format).toBe('ISO 8601');
        expect(result.epochSeconds).toBe(1753490956);
        expect(result.originalInput).toBe(input);
      });
    });

    it('should parse ISO 8601 without Z timezone indicator', () => {
      const result = parseTimeInput('2025-07-26T00:49:16');
      expect(result.format).toBe('ISO 8601');
      // Note: Without Z, this is treated as local time, so epoch will vary by timezone
      expect(result.originalInput).toBe('2025-07-26T00:49:16');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse ISO 8601 with fractional seconds but no Z', () => {
      const result = parseTimeInput('2025-07-26T00:49:16.123');
      expect(result.format).toBe('ISO 8601');
      // Note: Without Z, this is treated as local time, so epoch will vary by timezone
      expect(result.originalInput).toBe('2025-07-26T00:49:16.123');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });
  });

  describe('Unix Timestamp Tests', () => {
    it('should parse standard Unix timestamp (seconds)', () => {
      const result = parseTimeInput('1753490956');
      expect(result.format).toBe('Unix timestamp (seconds)');
      expect(result.epochSeconds).toBe(1753490956);
      expect(result.originalInput).toBe('1753490956');
    });

    it('should parse Unix timestamp with decimal point', () => {
      const result = parseTimeInput('1753490956.0');
      expect(result.format).toBe('Unix timestamp (seconds)');
      expect(result.epochSeconds).toBe(1753490956);
    });

    it('should parse Unix timestamp with fractional seconds', () => {
      const result = parseTimeInput('1753490956.123');
      expect(result.format).toBe('Unix timestamp (seconds)');
      expect(result.epochSeconds).toBe(1753490956);
    });

    it('should parse Unix timestamp in milliseconds', () => {
      const result = parseTimeInput('1753490956000');
      expect(result.format).toBe('Unix timestamp (milliseconds)');
      expect(result.epochSeconds).toBe(1753490956);
    });

    it('should parse Unix timestamp in milliseconds with precision', () => {
      const result = parseTimeInput('1753490956123');
      expect(result.format).toBe('Unix timestamp (milliseconds)');
      expect(result.epochSeconds).toBe(1753490956);
    });

    it('should reject timestamps outside reasonable range', () => {
      expect(() => parseTimeInput('123')).toThrow(); // Too small
      expect(() => parseTimeInput('9999999999')).toThrow(); // Too large
    });
  });

  describe('Simple Date-Time Format Tests', () => {
    it('should parse YYYY-MM-DD HH:MM:SS format', () => {
      const result = parseTimeInput('2025-07-26 00:49:16');
      expect(result.format).toBe('Simple date time');
      // Note: Simple formats are treated as local time, so epoch will vary by timezone
      expect(result.originalInput).toBe('2025-07-26 00:49:16');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse YYYY-MM-DD HH:MM:SS with fractional seconds', () => {
      const result = parseTimeInput('2025-07-26 00:49:16.123');
      expect(result.format).toBe('Simple date time');
      expect(result.originalInput).toBe('2025-07-26 00:49:16.123');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse YYYY/MM/DD HH:MM:SS format', () => {
      const result = parseTimeInput('2025/07/26 00:49:16');
      expect(result.format).toBe('Simple date time');
      expect(result.originalInput).toBe('2025/07/26 00:49:16');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse YYYY/MM/DD HH:MM:SS with fractional seconds', () => {
      const result = parseTimeInput('2025/07/26 00:49:16.123');
      expect(result.format).toBe('Simple date time');
      expect(result.originalInput).toBe('2025/07/26 00:49:16.123');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse MM/DD/YYYY HH:MM:SS format (US format)', () => {
      const result = parseTimeInput('07/26/2025 00:49:16');
      expect(result.format).toBe('Simple date time');
      expect(result.originalInput).toBe('07/26/2025 00:49:16');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse MM/DD/YYYY HH:MM:SS with fractional seconds', () => {
      const result = parseTimeInput('07/26/2025 00:49:16.123');
      expect(result.format).toBe('Simple date time');
      expect(result.originalInput).toBe('07/26/2025 00:49:16.123');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });
  });

  describe('Year-Month-Day-Hour-Minute Format Tests', () => {
    it('should parse YYYY-MM-DD HH:MM format (no seconds)', () => {
      const result = parseTimeInput('2025-07-26 00:49');
      expect(result.format).toBe('Year-month-day-hour-minute');
      expect(result.originalInput).toBe('2025-07-26 00:49');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse YYYY/MM/DD HH:MM format', () => {
      const result = parseTimeInput('2025/07/26 00:49');
      expect(result.format).toBe('Year-month-day-hour-minute');
      expect(result.originalInput).toBe('2025/07/26 00:49');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse MM/DD/YYYY HH:MM format (US)', () => {
      const result = parseTimeInput('07/26/2025 00:49');
      expect(result.format).toBe('Year-month-day-hour-minute');
      expect(result.originalInput).toBe('07/26/2025 00:49');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should throw error for empty input', () => {
      expect(() => parseTimeInput('')).toThrow('Time input cannot be empty');
    });

    it('should throw error for whitespace-only input', () => {
      expect(() => parseTimeInput('   ')).toThrow('Time input cannot be empty');
    });

    it('should throw error for completely invalid format', () => {
      expect(() => parseTimeInput('invalid-date-format')).toThrow(/Unable to parse time format/);
    });

    it('should throw error for partial date', () => {
      expect(() => parseTimeInput('2025-07')).toThrow();
    });

    it('should throw error for invalid date values', () => {
      expect(() => parseTimeInput('2025-13-45 25:70:90')).toThrow();
    });

    it('should handle leading/trailing whitespace', () => {
      const result = parseTimeInput('  2025-07-26T00:49:16Z  ');
      expect(result.format).toBe('ISO 8601');
      expect(result.epochSeconds).toBe(1753490956);
    });
  });

  describe('Mixed Format Compatibility', () => {
    it('should parse different valid formats consistently', () => {
      const testCases = [
        { input: '2025-07-26T00:49:16Z', expectedFormat: 'ISO 8601' },
        { input: '1753490956', expectedFormat: 'Unix timestamp (seconds)' },
        { input: '1753490956000', expectedFormat: 'Unix timestamp (milliseconds)' },
      ];

      testCases.forEach(({ input, expectedFormat }) => {
        const result = parseTimeInput(input);
        expect(result.format).toBe(expectedFormat);
        expect(result.originalInput).toBe(input);
        expect(result.parsedDate).toBeInstanceOf(Date);
        expect(typeof result.epochSeconds).toBe('number');
      });
    });
  });

  describe('Real-World Examples', () => {
    it('should parse Windows event log timestamp', () => {
      const result = parseTimeInput('2025-07-26T00:49:16.2146161Z');
      expect(result.format).toBe('ISO 8601');
      expect(result.epochSeconds).toBe(1753490956);
    });

    it('should parse syslog timestamp', () => {
      const result = parseTimeInput('2025-07-26 00:49:16');
      expect(result.format).toBe('Simple date time');
      // Note: Local time, so we just check it parses correctly
      expect(result.originalInput).toBe('2025-07-26 00:49:16');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });

    it('should parse application log timestamp', () => {
      const result = parseTimeInput('2025-07-26T00:49:16.123Z');
      expect(result.format).toBe('ISO 8601');
      expect(result.epochSeconds).toBe(1753490956);
    });

    it('should parse database datetime with microseconds', () => {
      const result = parseTimeInput('2025-07-26 00:49:16.123456');
      expect(result.format).toBe('Simple date time');
      // Note: Local time, so we just check it parses correctly
      expect(result.originalInput).toBe('2025-07-26 00:49:16.123456');
      expect(result.parsedDate).toBeInstanceOf(Date);
    });
  });
});

describe('Time Range Utilities', () => {
  describe('createTimeRange', () => {
    it('should create valid time range', () => {
      const startTime = parseTimeInput('2025-07-26T00:49:16Z');
      const endTime = parseTimeInput('2025-07-26T00:49:26Z');

      const timeRange = createTimeRange(startTime, endTime);

      expect(timeRange.startTime).toBe(1753490956);
      expect(timeRange.endTime).toBe(1753490966);
      expect(timeRange.duration).toBe(10);
    });

    it('should reject time range with negative duration', () => {
      const startTime = parseTimeInput('2025-07-26T00:49:26Z');
      const endTime = parseTimeInput('2025-07-26T00:49:16Z');

      expect(() => createTimeRange(startTime, endTime)).toThrow('Minimum time span is 1 second');
    });

    it('should reject time range longer than 1 hour', () => {
      const startTime = parseTimeInput('2025-07-26T00:49:16Z');
      const endTime = parseTimeInput('2025-07-26T02:49:17Z'); // > 1 hour

      expect(() => createTimeRange(startTime, endTime)).toThrow('Maximum time span is 1 hour');
    });
  });

  describe('splitTimeAroundCenter', () => {
    it('should create symmetric time range around center point', () => {
      const centerTime = parseTimeInput('2025-07-26T00:49:16Z');
      const timeRange = splitTimeAroundCenter(centerTime, 10);

      expect(timeRange.startTime).toBe(1753490951); // 5 seconds before
      expect(timeRange.endTime).toBe(1753490961); // 5 seconds after
      expect(timeRange.duration).toBe(10);
    });

    it('should handle odd window sizes correctly', () => {
      const centerTime = parseTimeInput('2025-07-26T00:49:16Z');
      const timeRange = splitTimeAroundCenter(centerTime, 11);

      expect(timeRange.startTime).toBe(1753490951); // 5 seconds before
      expect(timeRange.endTime).toBe(1753490962); // 6 seconds after
      expect(timeRange.duration).toBe(11);
    });
  });
});

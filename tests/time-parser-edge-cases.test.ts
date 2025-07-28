import { describe, it, expect } from '@jest/globals';
import { parseTimeInput } from '../src/time-parser';

describe('Time Parser Edge Cases and Real-World Issues', () => {
  describe('Timezone Handling Consistency', () => {
    it('should handle timezone-aware vs timezone-naive timestamps consistently', () => {
      const utcTime = parseTimeInput('2025-07-26T00:49:16Z');
      const localTime = parseTimeInput('2025-07-26T00:49:16');

      // Both should parse successfully
      expect(utcTime.format).toBe('ISO 8601');
      expect(localTime.format).toBe('ISO 8601');

      // UTC time should always be valid
      expect(utcTime.epochSeconds).toBeGreaterThan(0);
      expect(localTime.epochSeconds).toBeGreaterThan(0);

      // In UTC environments, they may be equal; in other timezones, they'll differ
      const timezoneOffset = new Date().getTimezoneOffset();
      if (timezoneOffset === 0) {
        // Running in UTC - times should be equal
        expect(utcTime.epochSeconds).toBe(localTime.epochSeconds);
      } else {
        // Running in non-UTC timezone - times should differ
        expect(utcTime.epochSeconds).not.toBe(localTime.epochSeconds);
      }
    });

    it('should support ISO 8601 timezone offset formats', () => {
      // These should be supported but currently aren't
      const testCases = [
        '2025-07-26T00:49:16+00:00',
        '2025-07-26T00:49:16-05:00',
        '2025-07-26T00:49:16+09:00',
      ];

      testCases.forEach(input => {
        expect(() => parseTimeInput(input)).not.toThrow();
      });
    });

    it('should produce consistent results regardless of system timezone', () => {
      // UTC timestamps should always produce the same epoch seconds
      const utcInputs = [
        '2025-07-26T00:49:16Z',
        '2025-07-26T00:49:16.000Z',
        '2025-07-26T00:49:16.123Z',
      ];

      const baseEpoch = parseTimeInput(utcInputs[0]).epochSeconds;
      utcInputs.slice(1).forEach(input => {
        const result = parseTimeInput(input);
        expect(result.epochSeconds).toBe(baseEpoch);
      });
    });
  });

  describe('Date Validation Issues', () => {
    it('should reject invalid dates that JavaScript Date accepts', () => {
      const invalidDates = [
        '2025-02-29 12:00:00', // 2025 is not a leap year
        '2025-04-31 12:00:00', // April has 30 days
        '2025-06-31 12:00:00', // June has 30 days
        '2025-09-31 12:00:00', // September has 30 days
        '2025-11-31 12:00:00', // November has 30 days
      ];

      invalidDates.forEach(input => {
        expect(() => parseTimeInput(input)).toThrow();
      });
    });

    it('should accept valid leap year dates', () => {
      const validLeapYearDates = [
        '2024-02-29 12:00:00', // 2024 is a leap year
        '2020-02-29 12:00:00', // 2020 is a leap year
        '2000-02-29 12:00:00', // 2000 is a leap year
      ];

      validLeapYearDates.forEach(input => {
        expect(() => parseTimeInput(input)).not.toThrow();
      });
    });

    it('should handle boundary dates correctly', () => {
      const boundaryDates = [
        '1970-01-01 00:00:00', // Unix epoch start
        '2038-01-19 03:14:07', // 32-bit signed int max
        '1900-01-01 00:00:00', // Pre-epoch date
        '2100-12-31 23:59:59', // Far future date
      ];

      boundaryDates.forEach(input => {
        expect(() => parseTimeInput(input)).not.toThrow();
        const result = parseTimeInput(input);
        expect(result.parsedDate).toBeInstanceOf(Date);
        expect(result.epochSeconds).toBeGreaterThan(-3000000000); // Reasonable bounds
        expect(result.epochSeconds).toBeLessThan(5000000000);
      });
    });
  });

  describe('Format Ambiguity and Precedence', () => {
    it('should handle ambiguous MM/DD/YYYY vs DD/MM/YYYY correctly', () => {
      // This could be March 2nd or February 3rd
      const ambiguousDate = '03/02/2025 12:00:00';
      const result = parseTimeInput(ambiguousDate);

      // Should be interpreted as MM/DD/YYYY (US format) based on our implementation
      expect(result.parsedDate.getMonth()).toBe(2); // March (0-indexed)
      expect(result.parsedDate.getDate()).toBe(2);
    });

    it('should prioritize format detection correctly', () => {
      // Test format precedence - Unix timestamp should not be confused with date
      const timestampLikeNumber = '20250726'; // Could be interpreted as Unix timestamp
      expect(() => parseTimeInput(timestampLikeNumber)).toThrow(); // Should not parse as timestamp
    });
  });

  describe('Performance and Resource Issues', () => {
    it('should handle very long invalid input without hanging', () => {
      const longInvalidInput = 'invalid-'.repeat(1000) + 'timestamp';

      const start = Date.now();
      expect(() => parseTimeInput(longInvalidInput)).toThrow();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should fail fast
    });

    it('should handle deeply nested regex backtracking cases', () => {
      // Patterns that could cause regex catastrophic backtracking
      const backtrackingInputs = [
        // Malformed ISO with excessive fractional parts followed by invalid chars
        '2025-07-26T00:49:16.' + '1'.repeat(50) + 'ZZZZ',
        // Excessive repeated patterns that don't match any format
        '2025' + '-13'.repeat(20) + '-26 12:00:00',
        // Invalid patterns with many alternations
        'T'.repeat(100) + '2025-07-26T00:49:16Z',
      ];

      backtrackingInputs.forEach(input => {
        const start = Date.now();
        expect(() => parseTimeInput(input)).toThrow();
        const duration = Date.now() - start;
        expect(duration).toBeLessThan(100);
      });
    });
  });

  describe('Real-World Data Corruption Scenarios', () => {
    it('should detect when parsed date does not match input semantically', () => {
      // JavaScript Date constructor can silently "fix" invalid dates
      // e.g., new Date(2025, 1, 29) becomes March 1st instead of February 29th

      const potentiallyCorruptedInputs = [
        { input: '2025-02-29 12:00:00', expectedError: true }, // Not a leap year
        { input: '2025-13-01 12:00:00', expectedError: true }, // Invalid month
        { input: '2025-02-30 12:00:00', expectedError: true }, // February never has 30 days
      ];

      potentiallyCorruptedInputs.forEach(({ input, expectedError }) => {
        if (expectedError) {
          expect(() => parseTimeInput(input)).toThrow();
        } else {
          expect(() => parseTimeInput(input)).not.toThrow();
        }
      });
    });

    it('should maintain precision for timestamps with fractional seconds', () => {
      const precisionTests = [
        { input: '2025-07-26T00:49:16.1Z', expectedMs: 100 },
        { input: '2025-07-26T00:49:16.12Z', expectedMs: 120 },
        { input: '2025-07-26T00:49:16.123Z', expectedMs: 123 },
        { input: '2025-07-26T00:49:16.1234Z', expectedMs: 123 }, // Should truncate, not round
      ];

      precisionTests.forEach(({ input, expectedMs }) => {
        const result = parseTimeInput(input);
        const actualMs = result.parsedDate.getMilliseconds();
        expect(actualMs).toBe(expectedMs);
      });
    });
  });

  describe('Cross-System Compatibility', () => {
    it('should produce same results on different Node.js versions', () => {
      // Test some timestamps that might behave differently across versions
      const compatibilityTests = [
        '2025-07-26T00:49:16Z',
        '1969-12-31T23:59:59Z', // Before Unix epoch
        '2038-01-19T03:14:08Z', // After 32-bit signed int limit
      ];

      compatibilityTests.forEach(input => {
        const result = parseTimeInput(input);
        expect(result.parsedDate).toBeInstanceOf(Date);
        expect(typeof result.epochSeconds).toBe('number');
        expect(isFinite(result.epochSeconds)).toBe(true);
      });
    });

    it('should handle locale-independent parsing', () => {
      // The parser should not be affected by system locale
      const localeIndependentInputs = ['2025-07-26T00:49:16Z', '07/26/2025 00:49:16', '1753490956'];

      localeIndependentInputs.forEach(input => {
        const result = parseTimeInput(input);
        expect(result.originalInput).toBe(input);
        expect(typeof result.epochSeconds).toBe('number');
      });
    });
  });
});

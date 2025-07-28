import { describe, it, expect } from '@jest/globals';
import { parseCSVTimestamps, getCSVFormatHelp, csvEntriesToTimeRanges } from '../src/csv-parser';

describe('CSV Parser Comprehensive Tests', () => {
  describe('Format 1: Single Column with Time Span Parameter', () => {
    it('should parse Format 1 with ISO 8601 timestamps', () => {
      const csvContent = `2025-07-26T00:49:16Z
2025-07-26T00:49:16.123Z
2025-07-26T00:49:16.2146161Z`;

      const result = parseCSVTimestamps(csvContent, 5);
      expect(result.detectedFormat).toBe('format1');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    it('should parse Format 1 with simple date-time formats', () => {
      const csvContent = `2025-07-26 00:49:16
2025/07/26 00:49:16
07/26/2025 00:49:16`;

      const result = parseCSVTimestamps(csvContent, 10);
      expect(result.detectedFormat).toBe('format1');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
    });

    it('should parse Format 1 with Unix timestamps', () => {
      const csvContent = `1753490956
1753490956000
1753490956.123`;

      const result = parseCSVTimestamps(csvContent, 5);
      expect(result.detectedFormat).toBe('format1');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
    });

    it('should parse Format 1 with mixed timestamp formats', () => {
      const csvContent = `2025-07-26T00:49:16.2146161Z
2025-07-26 00:49:16
1753490956
2025/07/26 00:49:16.123`;

      const result = parseCSVTimestamps(csvContent, 5);
      expect(result.detectedFormat).toBe('format1');
      expect(result.entries.length).toBe(4);
      expect(result.summary.validEntries).toBe(4);
    });

    it('should require timeSpanSeconds parameter for Format 1', () => {
      const csvContent = `2025-07-26T00:49:16Z`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format1');
      expect(result.errors).toContain('timeSpanSeconds is required for single-column CSV');
      expect(result.entries.length).toBe(0);
    });

    it('should handle comments and empty lines in Format 1', () => {
      const csvContent = `# This is a comment
2025-07-26T00:49:16Z

# Another comment
2025-07-26T00:50:16Z
`;

      const result = parseCSVTimestamps(csvContent, 5);
      expect(result.detectedFormat).toBe('format1');
      expect(result.entries.length).toBe(2);
      expect(result.summary.validEntries).toBe(2);
    });
  });

  describe('Format 2: Timestamp with Duration', () => {
    it('should parse Format 2 with ISO 8601 timestamps', () => {
      const csvContent = `2025-07-26T00:49:16Z,5
2025-07-26T00:49:16.123Z,10
2025-07-26T00:49:16.2146161Z,15`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format2');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);

      // Check that durations are correctly parsed
      expect(result.entries[0].timeRange.duration).toBe(5);
      expect(result.entries[1].timeRange.duration).toBe(10);
      expect(result.entries[2].timeRange.duration).toBe(15);
    });

    it('should parse Format 2 with simple date-time formats', () => {
      const csvContent = `2025-07-26 00:49:16,5
2025/07/26 00:49:16,10
07/26/2025 00:49:16,3`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format2');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
    });

    it('should parse Format 2 with Unix timestamps', () => {
      const csvContent = `1753490956,5
1753490956000,10
1753490956.123,7`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format2');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
    });

    it('should parse Format 2 with mixed timestamp formats', () => {
      const csvContent = `2025-07-26T00:49:16.2146161Z,5
2025-07-26 00:49:16,10
1753490956,3
2025/07/26 00:49:16.123,8`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format2');
      expect(result.entries.length).toBe(4);
      expect(result.summary.validEntries).toBe(4);
    });

    it('should handle fractional duration values', () => {
      const csvContent = `2025-07-26T00:49:16Z,5.5
2025-07-26T00:50:16Z,10.75`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format2');
      expect(result.entries.length).toBe(2);
      expect(result.entries[0].timeRange.duration).toBe(5.5);
      expect(result.entries[1].timeRange.duration).toBe(10.75);
    });

    it('should validate duration ranges', () => {
      const csvContent = `2025-07-26T00:49:16Z,0
2025-07-26T00:50:16Z,3601`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.summary.errorCount).toBe(2); // Both should be invalid
      expect(result.errors.some(err => err.includes('Unable to parse time format'))).toBe(true);
    });
  });

  describe('Format 3: Start and End Timestamps', () => {
    it('should parse Format 3 with ISO 8601 timestamps', () => {
      const csvContent = `2025-07-26T00:49:16Z,2025-07-26T00:49:21Z
2025-07-26T00:49:16.123Z,2025-07-26T00:49:26.123Z
2025-07-26T00:49:16.2146161Z,2025-07-26T00:49:31.2146161Z`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format3');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);

      // Check that durations are correctly calculated
      expect(result.entries[0].timeRange.duration).toBe(5);
      expect(result.entries[1].timeRange.duration).toBe(10);
      expect(result.entries[2].timeRange.duration).toBe(15);
    });

    it('should parse Format 3 with simple date-time formats', () => {
      const csvContent = `2025-07-26 00:49:16,2025-07-26 00:49:21
2025/07/26 00:49:16,2025/07/26 00:49:26
07/26/2025 00:49:16,07/26/2025 00:49:19`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format3');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
    });

    it('should parse Format 3 with Unix timestamps', () => {
      const csvContent = `1753490956,1753490961
1753490966000,1753490976000
1753490956.123,1753490966.123`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format3');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
    });

    it('should parse Format 3 with mixed timestamp formats', () => {
      const csvContent = `2025-07-26T00:49:16.2146161Z,2025-07-26T00:49:21.2146161Z
2025-07-26 00:49:16,2025-07-26 00:49:26
1753490956,1753490959
2025/07/26 00:49:16.123,2025/07/26 00:49:24.123`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format3');
      expect(result.entries.length).toBe(4);
      expect(result.summary.validEntries).toBe(4);
    });

    it('should validate time range constraints', () => {
      const csvContent = `2025-07-26T00:49:16Z,2025-07-26T00:49:16Z
2025-07-26T00:49:16Z,2025-07-26T02:49:17Z`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.summary.errorCount).toBe(2);
      expect(result.errors.some(err => err.includes('Minimum time span is 1 second'))).toBe(true);
      expect(result.errors.some(err => err.includes('Maximum time span is 1 hour'))).toBe(true);
    });

    it('should handle reversed time ranges', () => {
      const csvContent = `2025-07-26T00:49:26Z,2025-07-26T00:49:16Z`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.summary.errorCount).toBe(1);
      expect(result.errors[0]).toContain('Minimum time span is 1 second');
    });
  });

  describe('Format Detection and Error Handling', () => {
    it('should detect unknown format for invalid CSV', () => {
      const csvContent = `invalid,data,here
more,invalid,stuff`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('unknown');
      expect(result.entries.length).toBe(0);
      expect(result.summary.errorCount).toBeGreaterThan(0);
    });

    it('should handle empty CSV content', () => {
      const result = parseCSVTimestamps('');
      expect(result.detectedFormat).toBe('unknown');
      expect(result.entries.length).toBe(0);
      expect(result.summary.totalRows).toBe(0);
    });

    it('should handle CSV with only comments', () => {
      const csvContent = `# Comment 1
# Comment 2
# Comment 3`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('unknown');
      expect(result.entries.length).toBe(0);
    });

    it('should handle CSV with inconsistent column counts', () => {
      const csvContent = `2025-07-26T00:49:16Z
2025-07-26T00:49:26Z,5,extra-column`;

      const result = parseCSVTimestamps(csvContent, 5);
      expect(result.detectedFormat).toBe('unknown'); // Mixed formats should be unknown
      expect(result.summary.errorCount).toBe(2); // Unable to detect format
    });

    it('should provide detailed error messages', () => {
      const csvContent = `invalid-timestamp,5
2025-07-26T00:49:16Z,invalid-duration`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('Mixed or unsupported CSV format detected');
    });
  });

  describe('CSV to Time Ranges Conversion', () => {
    it('should convert CSV entries to time ranges correctly', () => {
      const csvContent = `2025-07-26T00:49:16Z,5
2025-07-26T00:50:16Z,10`;

      const parseResult = parseCSVTimestamps(csvContent);
      const timeRanges = csvEntriesToTimeRanges(parseResult.entries);

      expect(timeRanges.length).toBe(2);
      expect(timeRanges[0].startTime).toBe(1753490954); // splitTimeAroundCenter subtracts 2 seconds (5/2 rounded down)
      expect(timeRanges[0].duration).toBe(5);
      expect(timeRanges[1].startTime).toBe(1753491011); // splitTimeAroundCenter subtracts 5 seconds (10/2)
      expect(timeRanges[1].duration).toBe(10);
    });

    it('should handle empty entries array', () => {
      const timeRanges = csvEntriesToTimeRanges([]);
      expect(timeRanges).toEqual([]);
    });
  });

  describe('Format Help', () => {
    it('should provide comprehensive format help', () => {
      const help = getCSVFormatHelp();
      expect(help).toContain('FORMAT 1');
      expect(help).toContain('FORMAT 2');
      expect(help).toContain('FORMAT 3');
      expect(help).toContain('timestamp formats from the main tool');
    });
  });

  describe('Real-World CSV Examples', () => {
    it('should parse Windows event log export (ISO 8601 with microseconds)', () => {
      const csvContent = `2025-07-26T00:49:16.2146161Z,5
2025-07-26T00:49:21.3456789Z,3
2025-07-26T00:49:25.1234567Z,7`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format2');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
    });

    it('should parse security log analysis data', () => {
      const csvContent = `2025-07-26T00:49:16Z,2025-07-26T00:49:21Z
2025-07-26T00:50:30Z,2025-07-26T00:50:45Z
2025-07-26T00:52:15Z,2025-07-26T00:52:18Z`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format3');
      expect(result.entries.length).toBe(3);
      expect(result.summary.validEntries).toBe(3);
    });

    it('should parse network monitoring timestamps', () => {
      const csvContent = `1753490956
1753491016
1753491076
1753491136`;

      const result = parseCSVTimestamps(csvContent, 30);
      expect(result.detectedFormat).toBe('format1');
      expect(result.entries.length).toBe(4);
      expect(result.summary.validEntries).toBe(4);
    });

    it('should parse mixed enterprise log formats', () => {
      const csvContent = `2025-07-26T00:49:16.2146161Z,5
2025-07-26 00:50:30,10
1753491136,15
2025/07/26 00:52:45,3`;

      const result = parseCSVTimestamps(csvContent);
      expect(result.detectedFormat).toBe('format2');
      expect(result.entries.length).toBe(4);
      expect(result.summary.validEntries).toBe(4);
    });
  });
});

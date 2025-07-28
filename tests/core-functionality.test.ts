import { describe, it, expect } from '@jest/globals';
// import { parseTimeInput } from '../src/time-parser';
import { detectAWSEnvironment, validateRegion, getSupportedRegions } from '../src/aws-config';
import { parseCSVTimestamps } from '../src/csv-parser';

describe('Core Functionality Tests', () => {
  // Time Parser tests moved to time-parser.test.ts for comprehensive coverage

  describe('AWS Config', () => {
    it('should detect commercial AWS environment', () => {
      const result = detectAWSEnvironment('us-east-1');
      expect(result.type).toBe('commercial');
      expect(result.region).toBe('us-east-1');
      expect(result.arnPrefix).toBe('arn:aws');
    });

    it('should detect GovCloud environment', () => {
      const result = detectAWSEnvironment('us-gov-east-1');
      expect(result.type).toBe('govcloud');
      expect(result.region).toBe('us-gov-east-1');
      expect(result.arnPrefix).toBe('arn:aws-us-gov');
    });

    it('should validate valid regions', () => {
      const result = validateRegion('us-east-1');
      expect(result.isValid).toBe(true);
      expect(result.environment?.type).toBe('commercial');
    });

    it('should reject invalid regions', () => {
      const result = validateRegion('invalid-region');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid AWS region');
    });

    it('should return supported regions', () => {
      const regions = getSupportedRegions();
      expect(regions.commercial).toContain('us-east-1');
      expect(regions.govcloud).toContain('us-gov-east-1');
    });
  });

  // CSV Parser tests moved to csv-parser.test.ts for comprehensive coverage

  describe('Integration Tests', () => {
    it('should work with timestamp parsing and CSV parsing together', () => {
      const csvContent = `2025-07-26T00:49:16Z,5`;
      const result = parseCSVTimestamps(csvContent);

      expect(result.detectedFormat).toBe('format2');
      expect(result.entries.length).toBe(1);

      // Verify the time range was created correctly
      const entry = result.entries[0];
      expect(entry.timeRange.startTime).toBe(1753490954); // splitTimeAroundCenter subtracts 2 seconds (5/2 rounded down)
      expect(entry.timeRange.duration).toBe(5);
    });

    it('should handle mixed AWS environments correctly', () => {
      const commercialRegion = detectAWSEnvironment('us-east-1');
      const govCloudRegion = detectAWSEnvironment('us-gov-east-1');

      expect(commercialRegion.type).toBe('commercial');
      expect(govCloudRegion.type).toBe('govcloud');
      expect(commercialRegion.arnPrefix).not.toBe(govCloudRegion.arnPrefix);
    });
  });
});

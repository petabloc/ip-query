#!/usr/bin/env node

/**
 * IP Query Tool - CLI Interface
 *
 * Command line interface for VPC Flow Log analysis with threat intelligence
 */

import { parseArgs } from 'node:util';

import { IPQueryAnalyzer } from './analyzer.js';
import { parseTimeInput, TimeRange } from './time-parser.js';
import { detectAWSEnvironment, validateRegion, getSupportedRegions } from './aws-config.js';
import { parseCSVTimestamps, getCSVFormatHelp, csvEntriesToTimeRanges } from './csv-parser.js';

interface CLIArgs {
  'file-in'?: string;
  'time-in-seconds'?: string;
  'time-from'?: string;
  'time-to'?: string;
  region?: string;
  configure?: boolean;
  verbose?: boolean;
  help?: boolean;
}

/**
 * Load configuration from ~/.ip-query file
 */
async function loadConfiguration(): Promise<void> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    const configPath = path.join(os.homedir(), '.ip-query');

    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      configContent.split('\n').forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key] = valueParts.join('=');
          }
        }
      });
    }
  } catch {
    // Config file doesn't exist or can't be read, that's fine
  }
}

class IPQueryCLI {
  private analyzer?: IPQueryAnalyzer;

  constructor() {
    // Analyzer will be initialized with region when needed
  }

  /**
   * Main CLI entry point
   */
  async run(args: string[]): Promise<void> {
    try {
      // Load configuration first
      await loadConfiguration();

      const parsed = this.parseArguments(args);

      if (parsed.help) {
        this.showHelp();
        return;
      }

      if (parsed.configure) {
        await this.runConfigureMode();
        return;
      }

      // Check for required configuration and exit gracefully if missing
      if (!this.hasRequiredConfiguration()) {
        console.error('Configuration missing or incomplete.');
        console.error('');
        console.error('Required configuration values:');
        console.error('  • VPC_FLOW_LOG_GROUP_NAME');
        console.error('');
        console.error('To configure the tool, run:');
        console.error('  ip-query --configure');
        console.error('');
        console.error('Or create the configuration file manually:');
        console.error('  ~/.ip-query');
        process.exit(1);
      }

      await this.runCommandMode(parsed);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  /**
   * Parse command line arguments
   */
  private parseArguments(args: string[]): CLIArgs {
    try {
      const { values } = parseArgs({
        args,
        options: {
          'file-in': { type: 'string' },
          'time-in-seconds': { type: 'string' },
          'time-from': { type: 'string' },
          'time-to': { type: 'string' },
          region: { type: 'string' },
          configure: { type: 'boolean' },
          verbose: { type: 'boolean' },
          help: { type: 'boolean' },
        },
        allowPositionals: false,
      });

      return values as CLIArgs;
    } catch (error) {
      throw new Error(
        `Invalid arguments: ${error instanceof Error ? error.message : 'Parse error'}`
      );
    }
  }

  /**
   * Run in command line mode
   */
  private async runCommandMode(args: CLIArgs): Promise<void> {
    // Validate input mode - either file input or time range
    const hasFileInput = args['file-in'];
    const hasTimeRange = args['time-from'] && args['time-to'];

    if (!hasFileInput && !hasTimeRange) {
      throw new Error('Either --file-in or both --time-from and --time-to are required');
    }

    if (hasFileInput && hasTimeRange) {
      throw new Error('Cannot use both file input and time range modes simultaneously');
    }

    if (!args.verbose) {
      console.log('IP Query Tool - Analyzing...\n');
    } else {
      console.log('IP Query Tool - Command Line Mode\n');
    }

    // Validate and set up AWS region
    const region = await this.validateAndSetupRegion(args.region);
    this.analyzer = new IPQueryAnalyzer(region, { verbose: args.verbose || false });

    if (hasFileInput) {
      await this.runFileInputMode(args);
    } else {
      await this.runTimeRangeMode(args);
    }
  }

  /**
   * Run file input mode
   */
  private async runFileInputMode(args: CLIArgs): Promise<void> {
    if (!args['time-in-seconds']) {
      throw new Error('--time-in-seconds is required when using --file-in');
    }

    // Parse time window
    const timeWindow = parseInt(args['time-in-seconds']);
    if (isNaN(timeWindow) || timeWindow < 1 || timeWindow > 3600) {
      throw new Error('--time-in-seconds must be between 1 and 3600 (1 hour)');
    }

    // Read input file
    const timestamps = await this.readTimestampFile(args['file-in']!, timeWindow);

    // Run analysis
    if (
      Array.isArray(timestamps) &&
      timestamps.length > 0 &&
      typeof timestamps[0] === 'object' &&
      'startTime' in timestamps[0]
    ) {
      // CSV format returned TimeRange[]
      const results = await this.analyzer!.analyzeTimeRanges(timestamps as TimeRange[]);
      await this.outputResults(results);
    } else {
      // Plain text format returned string[]
      const results = await this.analyzer!.analyzeFromFile(timestamps as string[], timeWindow);
      await this.outputResults(results);
    }
  }

  /**
   * Run time range mode
   */
  private async runTimeRangeMode(args: CLIArgs): Promise<void> {
    const startTime = parseTimeInput(args['time-from']!);
    const endTime = parseTimeInput(args['time-to']!);

    // Validate time range
    const timeDiff = endTime.epochSeconds - startTime.epochSeconds;
    if (timeDiff < 1) {
      throw new Error('Minimum time span is 1 second');
    }
    if (timeDiff > 3600) {
      throw new Error('Maximum time span is 1 hour (3600 seconds)');
    }

    const timeRange: TimeRange = {
      startTime: startTime.epochSeconds,
      endTime: endTime.epochSeconds,
      duration: timeDiff,
    };

    console.log(`Analyzing time range: ${args['time-from']} to ${args['time-to']} (${timeDiff}s)`);
    const results = await this.analyzer!.analyzeTimeRange(timeRange);
    await this.outputResults(results);
  }

  /**
   * Validate and setup AWS region
   */
  private async validateAndSetupRegion(region?: string): Promise<string | undefined> {
    if (!region) {
      // Auto-detect from environment
      const environment = detectAWSEnvironment();
      const environmentName = environment.type === 'govcloud' ? 'AWS Gov Cloud' : 'AWS Commercial';
      console.log(`Auto-detected AWS region: ${environment.region} (${environmentName})`);
      return environment.region;
    }

    const validation = validateRegion(region);
    if (validation.isValid && validation.environment) {
      const environmentName =
        validation.environment.type === 'govcloud' ? 'AWS Gov Cloud' : 'AWS Commercial';
      console.log(`Using AWS region: ${region} (${environmentName})`);
      return region;
    } else {
      console.error(`${validation.error}`);

      if (validation.suggestions && validation.suggestions.length > 0) {
        console.log(`Did you mean one of these?`);
        validation.suggestions.forEach(suggestion => {
          console.log(`   • ${suggestion}`);
        });
      }

      const supportedRegions = getSupportedRegions();
      console.log(`\nSupported regions:`);
      console.log(
        `   Commercial AWS: ${supportedRegions.commercial.slice(0, 5).join(', ')} (and ${supportedRegions.commercial.length - 5} more)`
      );
      console.log(`   GovCloud: ${supportedRegions.govcloud.join(', ')}`);

      throw new Error(`Invalid region: ${region}`);
    }
  }

  /**
   * Read timestamps from file (supports both plain text and CSV formats)
   */
  private async readTimestampFile(
    filePath: string,
    timeSpanSeconds?: number
  ): Promise<string[] | TimeRange[]> {
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');

      // Check if file appears to be CSV format
      if (this.isCSVFormat(content, filePath)) {
        return this.parseCSVFile(content, timeSpanSeconds);
      } else {
        return this.parseTextFile(content);
      }
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if file appears to be CSV format
   */
  private isCSVFormat(content: string, filePath: string): boolean {
    // Check file extension
    if (filePath.toLowerCase().endsWith('.csv')) {
      return true;
    }

    // Check content patterns
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .slice(0, 3); // Check first 3 lines

    if (lines.length === 0) {
      return false;
    }

    // Look for comma-separated values
    const hasCommas = lines.some(line => line.includes(','));

    // Look for consistent column structure
    const columnCounts = lines.map(line => line.split(',').length);
    const consistentColumns = columnCounts.every(count => count === columnCounts[0] && count > 1);

    return hasCommas && consistentColumns;
  }

  /**
   * Parse CSV file format
   */
  private parseCSVFile(content: string, timeSpanSeconds?: number): TimeRange[] {
    const parseResult = parseCSVTimestamps(content, timeSpanSeconds);

    // Only show errors if there are issues
    if (parseResult.errors.length > 0) {
      if (parseResult.detectedFormat === 'unknown') {
        console.log('\nInvalid CSV format detected.');
        console.log(getCSVFormatHelp());
        throw new Error('Unsupported CSV format');
      }

      // Show first few errors as warnings
      const maxErrorsToShow = 3;
      parseResult.errors.slice(0, maxErrorsToShow).forEach(error => {
        console.warn(`   ${error}`);
      });

      if (parseResult.errors.length > maxErrorsToShow) {
        console.warn(`   ... and ${parseResult.errors.length - maxErrorsToShow} more errors`);
      }
    }

    if (parseResult.entries.length === 0) {
      throw new Error('No valid timestamp entries found in CSV file');
    }

    return csvEntriesToTimeRanges(parseResult.entries);
  }

  /**
   * Parse plain text file format
   */
  private parseTextFile(content: string): string[] {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    if (lines.length === 0) {
      throw new Error('No valid timestamps found in file');
    }

    return lines;
  }

  /**
   * Output analysis results
   */
  private async outputResults(results: any): Promise<void> {
    // Always output to console
    console.log('\n' + '='.repeat(50));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(50));

    if (results.wafBlocklist && results.wafBlocklist.allFormatted.length > 0) {
      console.log(`Found ${results.wafBlocklist.allFormatted.length} malicious IPs for blocking`);
    }

    // Note: Files are automatically generated by the analyzer
    // The analyzer will display the file location when files are created
  }

  /**
   * Show command line help
   */
  private showHelp(): void {
    console.log(`
🔍 IP Query Tool - VPC Flow Log Analysis with Threat Intelligence

USAGE:
    ip-query [OPTIONS]

MODES:
    File Input Mode:
        --file-in <FILE> --time-in-seconds <NUM> [OPTIONS]
    
    Time Range Mode:
        --time-from <TIME> --time-to <TIME> [OPTIONS]

OPTIONS:
    --file-in <FILE>           Input file containing timestamps
    --time-in-seconds <NUM>    Time window in seconds (1-3600, required with --file-in)
    --time-from <TIME>         Start time for analysis
    --time-to <TIME>           End time for analysis
    --region <REGION>          AWS region (optional, auto-detects from environment)
    --configure                Setup configuration interactively
    --verbose                  Show detailed analysis progress
    --help                     Show this help message

EXAMPLES:
    # Setup configuration
    ip-query --configure
    
    # File input mode
    ip-query --file-in timestamps.txt --time-in-seconds 5
    ip-query --file-in data.csv --time-in-seconds 10
    
    # Time range mode
    ip-query --time-from "2025-07-26 10:00:00" --time-to "2025-07-26 10:05:00"
    ip-query --time-from 1753490956 --time-to 1753491256 --region us-gov-east-1

TIME FORMATS SUPPORTED:
    • YYYY-MM-DD HH:MM:SS
    • YYYY-MM-DDTHH:MM:SS.sssZ (ISO 8601)
    • Unix timestamp (seconds or milliseconds)
    • Epoch time

INPUT FILE FORMATS:
    
    Plain Text (one timestamp per line):
    • ISO 8601: 2025-07-26T00:49:16.2146161Z
    • Simple format: 2025-07-26 00:49:16
    • Unix timestamps: 1753490956
    • Lines starting with # are ignored (comments)
    
    CSV Formats:
    • Format 1: Single column + --time-in-seconds parameter
    • Format 2: timestamp,span_seconds
    • Format 3: start_timestamp,end_timestamp
    
    Use --help with invalid CSV to see detailed format guide.

CONFIGURATION:
    Configuration is stored in ~/.ip-query in your home directory.
    Run 'ip-query --configure' to set up or modify configuration.

CONSTRAINTS:
    • Minimum time span: 1 second
    • Maximum time span: 1 hour (3600 seconds)
`);
  }

  /**
   * Run configuration mode
   */
  private async runConfigureMode(): Promise<void> {
    console.log('IP Query Tool Configuration Setup\n');

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const prompt = (question: string): Promise<string> => {
      return new Promise(resolve => {
        rl.question(question, resolve);
      });
    };

    try {
      // Check if config file already exists
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const configPath = path.join(os.homedir(), '.ip-query');

      if (fs.existsSync(configPath)) {
        console.log(`Configuration file already exists: ${configPath}`);
        const overwrite = await prompt('Do you want to overwrite it? (y/N): ');
        if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
          console.log('Configuration setup cancelled.');
          rl.close();
          return;
        }
        console.log('');
      }

      console.log('Please provide the following configuration values:\n');

      // AWS Configuration
      console.log('AWS Configuration:');
      const awsRegion = await prompt('AWS Region (e.g., us-east-1, us-gov-east-1): ');
      const awsProfile = await prompt('AWS Profile (optional, press Enter to skip): ');

      console.log('');

      // VPC Flow Log Configuration
      console.log('VPC Flow Log Configuration:');
      const vpcLogGroup = await prompt('VPC Flow Log Group Name (e.g., /vpc/flowlogs/all): ');

      console.log('');

      // Optional API Keys
      console.log('🔐 Threat Intelligence API Keys (optional):');
      const abuseIPDBKey = await prompt('AbuseIPDB API Key (press Enter to skip): ');
      const virusTotalKey = await prompt('VirusTotal API Key (press Enter to skip): ');

      // Validate required fields
      if (!awsRegion?.trim()) {
        console.log('\nError: AWS Region is required.');
        rl.close();
        process.exit(1);
      }

      if (!vpcLogGroup?.trim()) {
        console.log('\nError: VPC Flow Log Group Name is required.');
        rl.close();
        process.exit(1);
      }

      // Generate configuration content
      let configContent = '';
      configContent += '# IP Query Tool Configuration\n';
      configContent += `# Generated on ${new Date().toISOString()}\n`;
      configContent += '\n';
      configContent += '# AWS Configuration\n';
      configContent += `AWS_REGION=${awsRegion.trim()}\n`;

      if (awsProfile?.trim()) {
        configContent += `AWS_PROFILE=${awsProfile.trim()}\n`;
      } else {
        configContent += '# AWS_PROFILE=default\n';
      }

      configContent += '\n';
      configContent += '# VPC Flow Log Configuration\n';
      configContent += `VPC_FLOW_LOG_GROUP_NAME=${vpcLogGroup.trim()}\n`;
      configContent += '\n';
      configContent += '# Threat Intelligence API Keys (Optional)\n';

      if (abuseIPDBKey?.trim()) {
        configContent += `ABUSEIPDB_API_KEY=${abuseIPDBKey.trim()}\n`;
      } else {
        configContent += '# ABUSEIPDB_API_KEY=your-api-key\n';
      }

      if (virusTotalKey?.trim()) {
        configContent += `VIRUSTOTAL_API_KEY=${virusTotalKey.trim()}\n`;
      } else {
        configContent += '# VIRUSTOTAL_API_KEY=your-api-key\n';
      }

      // Write configuration file
      try {
        fs.writeFileSync(configPath, configContent, 'utf-8');
        console.log(`\nConfiguration saved successfully to: ${configPath}`);
        console.log('');
        console.log('Setup complete! You can now use ip-query with your configuration.');
        console.log('');
        console.log('Example usage:');
        console.log('  ip-query --time-from "2025-01-01 12:00:00" --time-to "2025-01-01 12:00:10"');
      } catch (error) {
        console.log(
          `\nError writing configuration file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        process.exit(1);
      }
    } catch (error) {
      console.log(
        `\nConfiguration setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      process.exit(1);
    } finally {
      rl.close();
    }
  }

  /**
   * Check if required configuration exists
   */
  private hasRequiredConfiguration(): boolean {
    // Check if required environment variables are set (they should be loaded by loadConfiguration)
    const requiredVars = ['VPC_FLOW_LOG_GROUP_NAME'];
    return requiredVars.every(varName => {
      const value = process.env[varName];
      return value && value.trim().length > 0;
    });
  }
}

// CLI entry point - run when this module is executed directly or via shebang
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith('cli.js') ||
  process.argv[1].endsWith('ip-query')
) {
  const cli = new IPQueryCLI();
  cli.run(process.argv.slice(2)).catch(error => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}

export { IPQueryCLI };

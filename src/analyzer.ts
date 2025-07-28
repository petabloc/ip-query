/**
 * Main analyzer class that integrates VPC Flow Log analysis with threat intelligence
 */

import { VPCFlowLogAnalyzer } from './vpc-flow-logs.js';
import { ThreatIntelligenceChecker } from './threat-intel.js';
import {
  extractUniqueIPs,
  filterPublicIPs,
  filterPrivateIPs,
  findCommonIPs,
  countIPOccurrences,
} from './ip-utils.js';
import { parseTimeInput, splitTimeAroundCenter, TimeRange } from './time-parser.js';

export interface AnalysisResults {
  summary: {
    analysisDate: string;
    totalTimeRanges: number;
    totalRecords: number;
    uniquePublicIPs: number;
    uniquePrivateIPs: number;
    maliciousIPsFound: number;
  };
  ipAnalysis: {
    publicIPs: string[];
    privateIPs: string[];
    commonPublicIPs: string[];
    commonPrivateIPs: string[];
    frequentPublicIPs: Array<{ ip: string; occurrences: number }>;
    frequentPrivateIPs: Array<{ ip: string; occurrences: number }>;
  };
  threatIntelligence: {
    checkedIPs: number;
    maliciousCount: number;
    cleanCount: number;
    detectionRate: number;
    sources: Record<string, number>;
  };
  wafBlocklist: {
    highConfidence: string[];
    mediumConfidence: string[];
    lowConfidence: string[];
    allFormatted: string[];
    copyPasteReady: string;
  };
  rawData: {
    timeRangeResults: Record<string, any>;
    threatResults: Record<string, any>;
  };
}

export interface AnalyzerOptions {
  verbose?: boolean;
}

export class IPQueryAnalyzer {
  private vpcAnalyzer: VPCFlowLogAnalyzer;
  private threatChecker: ThreatIntelligenceChecker;
  private verbose: boolean;

  constructor(region?: string, options: AnalyzerOptions = {}) {
    this.verbose = options.verbose || false;
    // Let AWS config detection handle region defaulting
    this.vpcAnalyzer = new VPCFlowLogAnalyzer(region, { verbose: this.verbose });
    this.threatChecker = new ThreatIntelligenceChecker({ verbose: this.verbose });
  }

  /**
   * Analyze timestamps from file input
   */
  async analyzeFromFile(timestamps: string[], timeWindowSeconds: number): Promise<AnalysisResults> {
    if (this.verbose) {
      console.log(
        `Analyzing ${timestamps.length} timestamps with ${timeWindowSeconds}s windows...\n`
      );
    }

    // Parse timestamps and create time ranges
    const timeRanges: TimeRange[] = [];
    const parseErrors: string[] = [];

    for (const timestamp of timestamps) {
      try {
        const parsed = parseTimeInput(timestamp);
        const timeRange = splitTimeAroundCenter(parsed, timeWindowSeconds);
        timeRanges.push(timeRange);
      } catch (error) {
        parseErrors.push(`${timestamp}: ${error instanceof Error ? error.message : 'Parse error'}`);
      }
    }

    if (parseErrors.length > 0) {
      console.warn(`Warning: ${parseErrors.length} timestamps could not be parsed:`);
      parseErrors.forEach(error => console.warn(`   • ${error}`));
      console.log('');
    }

    if (timeRanges.length === 0) {
      throw new Error('No valid timestamps could be parsed');
    }

    if (this.verbose) {
      console.log(`Parsed ${timeRanges.length} valid time ranges`);
      console.log(`   • Time window: ${timeWindowSeconds} seconds per timestamp`);
      console.log(
        `   • Total time span: ${Math.min(...timeRanges.map(r => r.startTime))} to ${Math.max(...timeRanges.map(r => r.endTime))}\n`
      );
    }

    return await this.performAnalysis(timeRanges);
  }

  /**
   * Analyze a specific time range
   */
  async analyzeTimeRange(timeRange: TimeRange): Promise<AnalysisResults> {
    if (this.verbose) {
      console.log(
        `Analyzing time range: ${new Date(timeRange.startTime * 1000).toISOString()} to ${new Date(timeRange.endTime * 1000).toISOString()}`
      );
      console.log(`   • Duration: ${timeRange.duration} seconds\n`);
    }

    return await this.performAnalysis([timeRange]);
  }

  /**
   * Analyze multiple time ranges (for CSV input)
   */
  async analyzeTimeRanges(timeRanges: TimeRange[]): Promise<AnalysisResults> {
    if (this.verbose) {
      console.log(`Analyzing ${timeRanges.length} time ranges from CSV input...`);

      const totalDuration = timeRanges.reduce((sum, range) => sum + range.duration, 0);
      const minStart = Math.min(...timeRanges.map(r => r.startTime));
      const maxEnd = Math.max(...timeRanges.map(r => r.endTime));

      console.log(`   • Total ranges: ${timeRanges.length}`);
      console.log(`   • Combined duration: ${totalDuration} seconds`);
      console.log(
        `   • Overall time span: ${new Date(minStart * 1000).toISOString()} to ${new Date(maxEnd * 1000).toISOString()}\n`
      );
    }

    return await this.performAnalysis(timeRanges);
  }

  /**
   * Perform the core analysis workflow
   */
  private async performAnalysis(timeRanges: TimeRange[]): Promise<AnalysisResults> {
    // Step 1: Initialize VPC Flow Log analyzer
    console.log('Initializing AWS VPC Flow Log analyzer...');
    const logGroups = await this.vpcAnalyzer.discoverFlowLogs();
    console.log(`   • Found ${logGroups.length} VPC Flow Log groups`);

    if (logGroups.length === 0) {
      throw new Error(
        'No VPC Flow Log groups found. Ensure VPC Flow Logs are enabled and accessible.'
      );
    }

    console.log(`   • Using log group: ${logGroups[0]}\n`);

    // Step 2: Query VPC Flow Logs
    console.log('Querying VPC Flow Logs...');
    const queries = timeRanges.map(range => ({
      startTime: range.startTime,
      endTime: range.endTime,
      logGroupName: logGroups[0],
    }));

    const flowLogResults = await this.vpcAnalyzer.queryMultipleTimeRanges(queries);
    console.log(`   • Completed ${flowLogResults.size} queries\n`);

    // Step 3: Process IP data
    console.log('Processing flow log data...');
    const allPublicIPSets: string[][] = [];
    const allPrivateIPSets: string[][] = [];
    const timeRangeResults = new Map();
    let totalRecords = 0;

    for (const [timeRange, records] of flowLogResults.entries()) {
      const uniqueIPs = extractUniqueIPs(records);
      const publicIPs = filterPublicIPs(uniqueIPs);
      const privateIPs = filterPrivateIPs(uniqueIPs);

      allPublicIPSets.push(publicIPs);
      allPrivateIPSets.push(privateIPs);
      timeRangeResults.set(timeRange, {
        records: records.length,
        uniqueIPs: uniqueIPs.length,
        publicIPs,
        privateIPs,
      });

      totalRecords += records.length;
      console.log(
        `   • ${timeRange}: ${records.length} records, ${uniqueIPs.length} unique IPs, ${publicIPs.length} public IPs, ${privateIPs.length} private IPs`
      );
    }

    // Step 4: Analyze IP patterns
    console.log('\nAnalyzing IP patterns...');
    const allPublicIPs = [...new Set(allPublicIPSets.flat())];
    const allPrivateIPs = [...new Set(allPrivateIPSets.flat())];
    const commonPublicIPs = findCommonIPs(allPublicIPSets);
    const commonPrivateIPs = findCommonIPs(allPrivateIPSets);
    const publicIPCounts = countIPOccurrences(allPublicIPSets);
    const privateIPCounts = countIPOccurrences(allPrivateIPSets);

    const frequentPublicIPs = Array.from(publicIPCounts.entries())
      .map(([ip, count]) => ({ ip, occurrences: count }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    const frequentPrivateIPs = Array.from(privateIPCounts.entries())
      .map(([ip, count]) => ({ ip, occurrences: count }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    console.log(`   • Found ${allPublicIPs.length} unique public IPs`);
    console.log(`   • Found ${allPrivateIPs.length} unique private IPs`);

    // Step 5: Threat Intelligence Analysis
    console.log('\nRunning threat intelligence analysis...');
    const threatResults = await this.threatChecker.checkIPs(allPublicIPs);
    const threatStats = this.threatChecker.getSummaryStats(threatResults);
    const wafBlocklist = this.threatChecker.generateAWSWAFBlocklist(threatResults);

    console.log(`   • Checked ${threatStats.totalChecked} public IPs`);
    console.log(`   • Found ${threatStats.maliciousCount} malicious IPs`);
    console.log(
      `   • Detection rate: ${((threatStats.maliciousCount / threatStats.totalChecked) * 100).toFixed(1)}%`
    );

    // Step 6: Save results to files
    await this.saveResultsToFiles(wafBlocklist);

    // Compile final results
    const results: AnalysisResults = {
      summary: {
        analysisDate: new Date().toISOString(),
        totalTimeRanges: timeRanges.length,
        totalRecords,
        uniquePublicIPs: allPublicIPs.length,
        uniquePrivateIPs: allPrivateIPs.length,
        maliciousIPsFound: threatStats.maliciousCount,
      },
      ipAnalysis: {
        publicIPs: allPublicIPs,
        privateIPs: allPrivateIPs,
        commonPublicIPs,
        commonPrivateIPs,
        frequentPublicIPs,
        frequentPrivateIPs,
      },
      threatIntelligence: {
        checkedIPs: threatStats.totalChecked,
        maliciousCount: threatStats.maliciousCount,
        cleanCount: threatStats.cleanCount,
        detectionRate: (threatStats.maliciousCount / threatStats.totalChecked) * 100,
        sources: Object.fromEntries(threatStats.topSources),
      },
      wafBlocklist,
      rawData: {
        timeRangeResults: Object.fromEntries(timeRangeResults),
        threatResults: Object.fromEntries(threatResults),
      },
    };

    this.displayResults(results);
    return results;
  }

  /**
   * Display analysis results to console
   */
  private displayResults(results: AnalysisResults): void {
    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS RESULTS');
    console.log('='.repeat(60));

    console.log(`\nSummary:`);
    console.log(`   • Analysis completed: ${results.summary.analysisDate}`);
    console.log(`   • Time ranges analyzed: ${results.summary.totalTimeRanges}`);
    console.log(`   • Total flow log records: ${results.summary.totalRecords}`);
    console.log(`   • Unique public IPs: ${results.summary.uniquePublicIPs}`);
    console.log(`   • Unique private IPs: ${results.summary.uniquePrivateIPs}`);

    console.log(`\nThreat Intelligence:`);
    console.log(`   • Malicious IPs detected: ${results.threatIntelligence.maliciousCount}`);
    console.log(`   • Detection rate: ${results.threatIntelligence.detectionRate.toFixed(1)}%`);

    if (results.threatIntelligence.maliciousCount > 0) {
      console.log(`\nAWS WAF BLOCKLIST:`);
      console.log('='.repeat(40));

      if (results.wafBlocklist.highConfidence.length > 0) {
        console.log(`\nHIGH CONFIDENCE (${results.wafBlocklist.highConfidence.length} IPs):`);
        results.wafBlocklist.highConfidence.forEach(ip => console.log(`   ${ip}`));
      }

      if (results.wafBlocklist.mediumConfidence.length > 0) {
        console.log(`\nMEDIUM CONFIDENCE (${results.wafBlocklist.mediumConfidence.length} IPs):`);
        results.wafBlocklist.mediumConfidence.forEach(ip => console.log(`   ${ip}`));
      }
    }
  }

  /**
   * Save results to files
   */
  private async saveResultsToFiles(wafBlocklist: any): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

      // Save WAF blocklist
      const txtFilename = `aws-waf-blocklist-${timestamp}.txt`;
      await fs.writeFile(txtFilename, wafBlocklist.copyPasteReady);

      console.log(`\nBlocklist saved to: ${txtFilename}`);
    } catch (error) {
      console.warn(
        `Warning: Could not save files: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

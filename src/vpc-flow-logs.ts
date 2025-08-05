/**
 * AWS VPC Flow Logs query functionality
 */

import { EC2Client, DescribeFlowLogsCommand } from '@aws-sdk/client-ec2';
import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import {
  detectAWSEnvironment,
  getAWSSDKConfig,
  displayEnvironmentInfo,
  isValidARNForEnvironment,
  extractLogGroupFromARN,
  AWSEnvironment,
} from './aws-config.js';

export interface FlowLogRecord {
  timestamp: string;
  srcaddr: string;
  dstaddr: string;
  srcport: string;
  dstport: string;
  protocol: string;
  action: string;
  [key: string]: any;
}

export interface VPCFlowLogQuery {
  startTime: number;
  endTime: number;
  logGroupName?: string;
  region?: string;
}

export interface VPCAnalyzerOptions {
  verbose?: boolean;
  targetIP?: string;
}

export class VPCFlowLogAnalyzer {
  private ec2Client: EC2Client;
  private logsClient: CloudWatchLogsClient;
  private environment: AWSEnvironment;
  private verbose: boolean;
  private targetIP?: string;

  constructor(region?: string, options: VPCAnalyzerOptions = {}) {
    this.verbose = options.verbose || false;
    this.targetIP = options.targetIP;

    // Detect AWS environment (commercial or GovCloud)
    this.environment = detectAWSEnvironment(region);

    // Display environment information only in verbose mode
    if (this.verbose) {
      displayEnvironmentInfo(this.environment);
    }

    // Get AWS SDK configuration for the detected environment
    const config = getAWSSDKConfig(this.environment);

    this.ec2Client = new EC2Client(config);
    this.logsClient = new CloudWatchLogsClient(config);
  }

  /**
   * Discover VPC Flow Log groups
   */
  async discoverFlowLogs(): Promise<string[]> {
    try {
      const command = new DescribeFlowLogsCommand({});
      const response = await this.ec2Client.send(command);

      const logGroups = response.FlowLogs?.map(fl => fl.LogDestination)
        .filter(dest => dest && isValidARNForEnvironment(dest, this.environment))
        .map(dest => extractLogGroupFromARN(dest!))
        .filter(Boolean) as string[];

      return [...new Set(logGroups)]; // Remove duplicates
    } catch (error) {
      console.error('Error discovering flow logs:', error);
      return [];
    }
  }

  /**
   * Query VPC Flow Logs for a specific time range with pagination support
   */
  async queryFlowLogs(query: VPCFlowLogQuery): Promise<FlowLogRecord[]> {
    // For IP searches with very large time ranges, break into smaller chunks to avoid limits
    // Only paginate for queries > 24 hours to allow normal multi-hour queries to work
    if (this.targetIP && (query.endTime - query.startTime) > 86400) {
      return await this.queryFlowLogsWithPagination(query);
    } else {
      return await this.querySingleTimeRange(query);
    }
  }

  /**
   * Query a single time range (original implementation)
   */
  private async querySingleTimeRange(query: VPCFlowLogQuery): Promise<FlowLogRecord[]> {
    const logGroupName = query.logGroupName || (await this.getDefaultLogGroup());

    if (!logGroupName) {
      console.warn('No log group specified and none found automatically');
      return [];
    }

    try {
      // CloudWatch Logs Insights query for VPC Flow Logs
      // VPC Flow Logs have fields like: version, account-id, interface-id, srcaddr, dstaddr, srcport, dstport, protocol, packets, bytes, windowstart, windowend, action, flowlogstatus
      // For IP searches, filter directly in the query for better performance and get more results
      let insights_query;
      
      if (this.targetIP) {
        // IP-specific query with higher limit - client-side filtering will handle IP matching
        insights_query = `
          fields @timestamp, @message
          | filter @timestamp >= ${query.startTime * 1000} and @timestamp < ${query.endTime * 1000}
          | sort @timestamp desc
          | limit 10000
        `.trim();
      } else {
        // General query with standard limit
        insights_query = `
          fields @timestamp, @message
          | filter @timestamp >= ${query.startTime * 1000} and @timestamp < ${query.endTime * 1000}
          | sort @timestamp desc
          | limit 1000
        `.trim();
      }

      if (this.verbose) {
        console.log(`   • Using query: ${insights_query}`);
        console.log(
          `   • Time range: ${query.startTime} to ${query.endTime} (${new Date(query.startTime * 1000).toISOString()} to ${new Date(query.endTime * 1000).toISOString()}) - 2-second window`
        );
        console.log(`   • Environment: ${this.environment.description}`);
      }

      const startCommand = new StartQueryCommand({
        logGroupName,
        startTime: query.startTime,
        endTime: query.endTime,
        queryString: insights_query,
      });

      const startResponse = await this.logsClient.send(startCommand);
      const queryId = startResponse.queryId;

      if (!queryId) {
        throw new Error('Failed to start query');
      }

      // Poll for results
      let results;
      let attempts = 0;
      const maxAttempts = 30; // Wait up to 60 seconds

      do {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const getResultsCommand = new GetQueryResultsCommand({ queryId });
        results = await this.logsClient.send(getResultsCommand);
        attempts++;
      } while (results.status === 'Running' && attempts < maxAttempts);

      if (results.status !== 'Complete') {
        throw new Error(`Query did not complete. Status: ${results.status}`);
      }

      // Parse results
      if (this.verbose) {
        console.log(
          `   • Query results for ${query.startTime}-${query.endTime}: ${results.results?.length || 0} records found`
        );

        // Debug: Log first result structure if available
        if (results.results && results.results.length > 0) {
          console.log(`   • Sample result structure:`, JSON.stringify(results.results[0], null, 2));
        }
      }

      const allRecords = this.parseQueryResults(results.results || []);
      
      // Apply client-side IP filtering if targetIP is specified
      if (this.targetIP) {
        const filteredRecords = allRecords.filter(record => 
          record.srcaddr === this.targetIP || record.dstaddr === this.targetIP
        );
        
        if (this.verbose) {
          console.log(`   • IP filtering: ${filteredRecords.length} records containing IP ${this.targetIP} (out of ${allRecords.length} total)`);
        }
        
        return filteredRecords;
      }
      
      return allRecords;
    } catch (error) {
      console.error(
        `Error querying flow logs for time range ${query.startTime}-${query.endTime}:`,
        error
      );
      return [];
    }
  }

  /**
   * Query VPC Flow Logs with pagination for large time ranges
   */
  private async queryFlowLogsWithPagination(query: VPCFlowLogQuery): Promise<FlowLogRecord[]> {
    const allResults: FlowLogRecord[] = [];
    const chunkSize = 3600; // 1 hour chunks
    const totalDuration = query.endTime - query.startTime;
    const numChunks = Math.ceil(totalDuration / chunkSize);
    
    if (this.verbose) {
      console.log(`   • Large time range detected (${totalDuration}s)`);
      console.log(`   • Breaking into ${numChunks} chunks of ${chunkSize}s each`);
    }

    for (let i = 0; i < numChunks; i++) {
      const chunkStart = query.startTime + (i * chunkSize);
      const chunkEnd = Math.min(query.startTime + ((i + 1) * chunkSize), query.endTime);
      
      const chunkQuery: VPCFlowLogQuery = {
        ...query,
        startTime: chunkStart,
        endTime: chunkEnd
      };

      if (this.verbose) {
        console.log(`   • Processing chunk ${i + 1}/${numChunks}: ${new Date(chunkStart * 1000).toISOString()} to ${new Date(chunkEnd * 1000).toISOString()}`);
      }

      const chunkResults = await this.querySingleTimeRange(chunkQuery);
      allResults.push(...chunkResults);

      if (this.verbose) {
        console.log(`   • Chunk ${i + 1} returned ${chunkResults.length} records (total so far: ${allResults.length})`);
      }

      // Small delay between queries to avoid rate limiting
      if (i < numChunks - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (this.verbose) {
      console.log(`   • Pagination complete: ${allResults.length} total records across ${numChunks} chunks`);
    }

    return allResults;
  }

  /**
   * Get default log group (first available)
   */
  private async getDefaultLogGroup(): Promise<string | null> {
    // Check if log group is specified in environment variable
    const envLogGroup = process.env.VPC_FLOW_LOG_GROUP_NAME;
    if (envLogGroup) {
      if (this.verbose) {
        console.log(`Using log group from environment: ${envLogGroup}`);
      }
      return envLogGroup;
    }

    // Fall back to auto-discovery
    const logGroups = await this.discoverFlowLogs();
    return logGroups.length > 0 ? logGroups[0] : null;
  }

  /**
   * Parse CloudWatch Logs Insights query results
   */
  private parseQueryResults(results: any[]): FlowLogRecord[] {
    return results.map((result, index) => {
      const record: FlowLogRecord = {
        timestamp: '',
        srcaddr: '',
        dstaddr: '',
        srcport: '',
        dstport: '',
        protocol: '',
        action: '',
      };

      let message = '';

      // Parse field-value pairs
      for (const field of result) {
        if (field.field && field.value) {
          const fieldName = field.field.replace('@', '');
          record[fieldName] = field.value;

          if (fieldName === 'message') {
            message = field.value;
          }
        }
      }

      // If we have a message field, parse the VPC Flow Log format
      // VPC Flow Log format: version account-id interface-id srcaddr dstaddr srcport dstport protocol packets bytes windowstart windowend action flowlogstatus
      if (message) {
        const parts = message.split(' ');
        if (parts.length >= 14) {
          record.srcaddr = parts[3] || '';
          record.dstaddr = parts[4] || '';
          record.srcport = parts[5] || '';
          record.dstport = parts[6] || '';
          record.protocol = parts[7] || '';
          record.action = parts[12] || '';
        }
      }

      // Debug: Log parsed record for first few results
      if (this.verbose && index < 3) {
        console.log(`   • Raw message: "${message}"`);
        console.log(`   • Parsed record ${index + 1}:`, {
          timestamp: record.timestamp,
          srcaddr: record.srcaddr,
          dstaddr: record.dstaddr,
          srcport: record.srcport,
          dstport: record.dstport,
          protocol: record.protocol,
          action: record.action,
        });
      }

      return record;
    });
  }

  /**
   * Query multiple time ranges in parallel
   */
  async queryMultipleTimeRanges(queries: VPCFlowLogQuery[]): Promise<Map<string, FlowLogRecord[]>> {
    const results = new Map<string, FlowLogRecord[]>();

    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);

      const batchPromises = batch.map(async query => {
        const records = await this.queryFlowLogs(query);
        const key = `${query.startTime}-${query.endTime}`;
        results.set(key, records);
        return { key, records };
      });

      await Promise.all(batchPromises);

      // Add delay between batches
      if (i + batchSize < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

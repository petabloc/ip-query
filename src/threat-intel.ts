/**
 * Threat Intelligence module for checking IPs against malicious sources
 */

export interface ThreatIntelResult {
  ip: string;
  isMalicious: boolean;
  sources: string[];
  details: ThreatDetails[];
}

export interface ThreatDetails {
  source: string;
  category: string;
  confidence: string;
  lastSeen?: string;
  description?: string;
}

export interface ThreatIntelOptions {
  verbose?: boolean;
}

export class ThreatIntelligenceChecker {
  private cache = new Map<string, ThreatIntelResult>();
  private readonly rateLimitDelay = 1000; // 1 second between requests
  private verbose: boolean;

  constructor(options: ThreatIntelOptions = {}) {
    this.verbose = options.verbose || false;
  }

  /**
   * Check multiple IPs against threat intelligence sources
   */
  async checkIPs(ips: string[]): Promise<Map<string, ThreatIntelResult>> {
    const results = new Map<string, ThreatIntelResult>();

    if (this.verbose) {
      console.log(`Checking ${ips.length} public IPs against threat intelligence sources...`);
    }

    // Process IPs in batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);

      const batchPromises = batch.map(async ip => {
        const result = await this.checkSingleIP(ip);
        results.set(ip, result);
        return result;
      });

      await Promise.all(batchPromises);

      // Rate limiting delay between batches
      if (i + batchSize < ips.length) {
        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
      }
    }

    return results;
  }

  /**
   * Check a single IP against multiple threat intelligence sources
   */
  private async checkSingleIP(ip: string): Promise<ThreatIntelResult> {
    // Check cache first
    if (this.cache.has(ip)) {
      return this.cache.get(ip)!;
    }

    const result: ThreatIntelResult = {
      ip,
      isMalicious: false,
      sources: [],
      details: [],
    };

    try {
      // Check multiple sources
      const checks = await Promise.allSettled([
        this.checkAbuseIPDB(ip),
        this.checkVirusTotal(ip),
        this.checkThreatFox(ip),
        this.checkMalwareWorldIP(ip),
        this.checkFireHOLBlocklists(ip),
      ]);

      // Process results from all sources
      checks.forEach(check => {
        if (check.status === 'fulfilled' && check.value) {
          result.details.push(check.value);
          result.sources.push(check.value.source);
          if (check.value.category !== 'clean') {
            result.isMalicious = true;
          }
        }
      });

      // Cache the result
      this.cache.set(ip, result);
    } catch (error) {
      console.warn(`   • Warning: Error checking IP ${ip}:`, error);
    }

    return result;
  }

  /**
   * Check IP against AbuseIPDB (requires API key)
   */
  private async checkAbuseIPDB(ip: string): Promise<ThreatDetails | null> {
    const apiKey = process.env.ABUSEIPDB_API_KEY;
    if (!apiKey) {
      return null; // Skip if no API key
    }

    try {
      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90&verbose`,
        {
          headers: {
            Key: apiKey,
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const abuseConfidence = data.data?.abuseConfidencePercentage || 0;

      return {
        source: 'AbuseIPDB',
        category: abuseConfidence > 25 ? 'malicious' : 'clean',
        confidence: `${abuseConfidence}%`,
        lastSeen: data.data?.lastReportedAt,
        description: abuseConfidence > 25 ? `Abuse confidence: ${abuseConfidence}%` : 'Clean',
      };
    } catch {
      return null;
    }
  }

  /**
   * Check IP against VirusTotal (requires API key)
   */
  private async checkVirusTotal(ip: string): Promise<ThreatDetails | null> {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
      return null; // Skip if no API key
    }

    try {
      const response = await fetch(
        `https://www.virustotal.com/vtapi/v2/ip-address/report?apikey=${apiKey}&ip=${ip}`,
        {
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const detectedUrls = data.detected_urls?.length || 0;
      const detectedSamples = data.detected_communicating_samples?.length || 0;

      const isMalicious = detectedUrls > 0 || detectedSamples > 0;

      return {
        source: 'VirusTotal',
        category: isMalicious ? 'malicious' : 'clean',
        confidence: isMalicious ? 'high' : 'low',
        description: isMalicious
          ? `${detectedUrls} malicious URLs, ${detectedSamples} malicious samples`
          : 'Clean',
      };
    } catch {
      return null;
    }
  }

  /**
   * Check IP against ThreatFox (free API)
   */
  private async checkThreatFox(ip: string): Promise<ThreatDetails | null> {
    try {
      const response = await fetch('https://threatfox-api.abuse.ch/api/v1/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'search_ioc',
          search_term: ip,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const isMalicious = data.query_status === 'ok' && data.data?.length > 0;

      return {
        source: 'ThreatFox',
        category: isMalicious ? 'malicious' : 'clean',
        confidence: isMalicious ? 'high' : 'low',
        lastSeen: isMalicious ? data.data[0]?.first_seen : undefined,
        description: isMalicious ? `Malware family: ${data.data[0]?.malware}` : 'Clean',
      };
    } catch {
      return null;
    }
  }

  /**
   * Check IP against MalwareWorld IP blacklist (free)
   */
  private async checkMalwareWorldIP(ip: string): Promise<ThreatDetails | null> {
    try {
      // This is a simple check against known malicious IP patterns
      // In a real implementation, you would fetch and cache blacklists
      const response = await fetch(`https://malware-world.com/textlists/suspiciousIPs.txt`);

      if (!response.ok) {
        return null;
      }

      const blacklist = await response.text();
      const isMalicious = blacklist.includes(ip);

      return {
        source: 'MalwareWorld',
        category: isMalicious ? 'malicious' : 'clean',
        confidence: isMalicious ? 'medium' : 'low',
        description: isMalicious ? 'Listed in suspicious IPs' : 'Clean',
      };
    } catch {
      return null;
    }
  }

  /**
   * Check IP against FireHOL IP blacklists (free)
   */
  private async checkFireHOLBlocklists(ip: string): Promise<ThreatDetails | null> {
    try {
      // Check against a few key FireHOL lists
      const lists = [
        'firehol_level1.netset', // High confidence malicious IPs
        'firehol_level2.netset', // Medium confidence malicious IPs
      ];

      for (const list of lists) {
        try {
          const response = await fetch(
            `https://raw.githubusercontent.com/firehol/blocklist-ipsets/master/${list}`
          );

          if (response.ok) {
            const content = await response.text();
            if (this.checkIPInCIDRList(ip, content)) {
              return {
                source: 'FireHOL',
                category: 'malicious',
                confidence: list.includes('level1') ? 'high' : 'medium',
                description: `Listed in ${list}`,
              };
            }
          }
        } catch {
          // Continue to next list
        }
      }

      return {
        source: 'FireHOL',
        category: 'clean',
        confidence: 'low',
        description: 'Not found in FireHOL blocklists',
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if IP is in CIDR list (simplified implementation)
   */
  private checkIPInCIDRList(ip: string, cidrList: string): boolean {
    const lines = cidrList.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        if (trimmed === ip || (trimmed.includes('/') && this.isIPInCIDR(ip, trimmed))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Simple CIDR check (basic implementation)
   */
  private isIPInCIDR(ip: string, cidr: string): boolean {
    try {
      const [network, prefixLength] = cidr.split('/');
      if (!prefixLength) {
        return ip === network;
      }

      const ipParts = ip.split('.').map(Number);
      const networkParts = network.split('.').map(Number);
      const prefix = parseInt(prefixLength);

      // Convert to binary and compare
      const ipBinary = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
      const networkBinary =
        (networkParts[0] << 24) +
        (networkParts[1] << 16) +
        (networkParts[2] << 8) +
        networkParts[3];
      const mask = 0xffffffff << (32 - prefix);

      return (ipBinary & mask) === (networkBinary & mask);
    } catch {
      return false;
    }
  }

  /**
   * Get summary statistics of threat intelligence results
   */
  getSummaryStats(results: Map<string, ThreatIntelResult>): {
    totalChecked: number;
    maliciousCount: number;
    cleanCount: number;
    maliciousIPs: string[];
    topSources: Map<string, number>;
  } {
    const maliciousIPs: string[] = [];
    const sourceCount = new Map<string, number>();

    let maliciousCount = 0;
    let cleanCount = 0;

    for (const [ip, result] of results.entries()) {
      if (result.isMalicious) {
        maliciousCount++;
        maliciousIPs.push(ip);

        // Count sources that flagged this IP
        result.sources.forEach(source => {
          sourceCount.set(source, (sourceCount.get(source) || 0) + 1);
        });
      } else {
        cleanCount++;
      }
    }

    return {
      totalChecked: results.size,
      maliciousCount,
      cleanCount,
      maliciousIPs,
      topSources: sourceCount,
    };
  }

  /**
   * Generate AWS WAF ready blocklist with /32 CIDR notation
   * Sorted by confidence level (high, medium, low)
   */
  generateAWSWAFBlocklist(results: Map<string, ThreatIntelResult>): {
    highConfidence: string[];
    mediumConfidence: string[];
    lowConfidence: string[];
    allFormatted: string[];
    copyPasteReady: string;
  } {
    const highConfidence: string[] = [];
    const mediumConfidence: string[] = [];
    const lowConfidence: string[] = [];

    for (const [ip, result] of results.entries()) {
      if (result.isMalicious) {
        const cidrIP = `${ip}/32`;

        // Determine highest confidence level from all sources
        const hasHighConfidence = result.details.some(
          detail =>
            detail.confidence === 'high' ||
            (typeof detail.confidence === 'string' &&
              parseFloat(detail.confidence.replace('%', '')) >= 75)
        );

        const hasMediumConfidence = result.details.some(
          detail =>
            detail.confidence === 'medium' ||
            (typeof detail.confidence === 'string' &&
              parseFloat(detail.confidence.replace('%', '')) >= 25)
        );

        if (hasHighConfidence) {
          highConfidence.push(cidrIP);
        } else if (hasMediumConfidence) {
          mediumConfidence.push(cidrIP);
        } else {
          lowConfidence.push(cidrIP);
        }
      }
    }

    // Sort each category alphabetically for consistency
    highConfidence.sort();
    mediumConfidence.sort();
    lowConfidence.sort();

    const allFormatted = [...highConfidence, ...mediumConfidence, ...lowConfidence];

    // Create copy-paste ready format with comments
    const copyPasteReady = this.formatWAFBlocklistForCopyPaste(
      highConfidence,
      mediumConfidence,
      lowConfidence
    );

    return {
      highConfidence,
      mediumConfidence,
      lowConfidence,
      allFormatted,
      copyPasteReady,
    };
  }

  /**
   * Format blocklist for easy copy-paste into AWS WAF
   */
  private formatWAFBlocklistForCopyPaste(high: string[], medium: string[], low: string[]): string {
    const lines: string[] = [];

    lines.push('# AWS WAF IP Blocklist - Generated by IP Query Tool');
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push('# Format: IP/32 CIDR notation for AWS WAF');
    lines.push('');

    if (high.length > 0) {
      lines.push('# HIGH CONFIDENCE MALICIOUS IPs');
      lines.push(`# ${high.length} IP(s) - Recommended for immediate blocking`);
      high.forEach(ip => lines.push(ip));
      lines.push('');
    }

    if (medium.length > 0) {
      lines.push('# MEDIUM CONFIDENCE MALICIOUS IPs');
      lines.push(`# ${medium.length} IP(s) - Consider blocking after review`);
      medium.forEach(ip => lines.push(ip));
      lines.push('');
    }

    if (low.length > 0) {
      lines.push('# LOW CONFIDENCE MALICIOUS IPs');
      lines.push(`# ${low.length} IP(s) - Monitor or whitelist if legitimate`);
      low.forEach(ip => lines.push(ip));
      lines.push('');
    }

    if (high.length === 0 && medium.length === 0 && low.length === 0) {
      lines.push('# No malicious IPs detected');
    }

    return lines.join('\n');
  }
}

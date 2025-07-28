/**
 * Utility functions for IP address analysis
 */

/**
 * Check if an IP address is public (not private/reserved)
 */
export function isPublicIP(ip: string): boolean {
  // Parse IP address
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => isNaN(part) || part < 0 || part > 255)) {
    return false; // Invalid IP
  }

  const [a, b] = parts;

  // Private IP ranges (RFC 1918)
  if (a === 10) {
    return false;
  } // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) {
    return false;
  } // 172.16.0.0/12
  if (a === 192 && b === 168) {
    return false;
  } // 192.168.0.0/16

  // Loopback
  if (a === 127) {
    return false;
  } // 127.0.0.0/8

  // Link-local
  if (a === 169 && b === 254) {
    return false;
  } // 169.254.0.0/16

  // Multicast and reserved
  if (a >= 224) {
    return false;
  } // 224.0.0.0/4 and above

  // Broadcast
  if (ip === '255.255.255.255') {
    return false;
  }

  return true;
}

/**
 * Extract unique IPs from a set of records
 */
export function extractUniqueIPs(records: Record<string, unknown>[]): string[] {
  const ips = new Set<string>();

  for (const record of records) {
    // VPC Flow Log fields: srcaddr and dstaddr
    if (record.srcaddr && typeof record.srcaddr === 'string') {
      ips.add(record.srcaddr);
    }
    if (record.dstaddr && typeof record.dstaddr === 'string') {
      ips.add(record.dstaddr);
    }
  }

  return Array.from(ips);
}

/**
 * Filter for public IPs only
 */
export function filterPublicIPs(ips: string[]): string[] {
  return ips.filter(isPublicIP);
}

/**
 * Filter for private IPs only
 */
export function filterPrivateIPs(ips: string[]): string[] {
  return ips.filter(ip => !isPublicIP(ip));
}

/**
 * Find common IPs across multiple IP sets
 */
export function findCommonIPs(ipSets: string[][]): string[] {
  if (ipSets.length === 0) {
    return [];
  }
  if (ipSets.length === 1) {
    return ipSets[0];
  }

  // Start with the first set
  let common = new Set(ipSets[0]);

  // Intersect with each subsequent set
  for (let i = 1; i < ipSets.length; i++) {
    const currentSet = new Set(ipSets[i]);
    common = new Set([...common].filter(ip => currentSet.has(ip)));
  }

  return Array.from(common);
}

/**
 * Count IP occurrences across all sets
 */
export function countIPOccurrences(ipSets: string[][]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const ipSet of ipSets) {
    const uniqueInSet = new Set(ipSet);
    for (const ip of uniqueInSet) {
      counts.set(ip, (counts.get(ip) || 0) + 1);
    }
  }

  return counts;
}

/**
 * Get IPs that appear in at least N sets
 */
export function getIPsWithMinOccurrences(ipSets: string[][], minOccurrences: number): string[] {
  const counts = countIPOccurrences(ipSets);
  return Array.from(counts.entries())
    .filter(([, count]) => count >= minOccurrences)
    .map(([ip]) => ip)
    .sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0)); // Sort by occurrence count desc
}

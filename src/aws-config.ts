/**
 * AWS Configuration utilities for both commercial and GovCloud environments
 */

export interface AWSEnvironment {
  type: 'commercial' | 'govcloud';
  region: string;
  endpoints: {
    ec2: string;
    logs: string;
  };
  arnPrefix: string;
  description: string;
}

/**
 * Detect AWS environment type based on region
 */
export function detectAWSEnvironment(region?: string): AWSEnvironment {
  const awsRegion = region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

  if (!awsRegion) {
    // Default to commercial AWS us-east-1 if no region specified
    return getCommercialEnvironment('us-east-1');
  }

  if (awsRegion.startsWith('us-gov-')) {
    return getGovCloudEnvironment(awsRegion);
  } else {
    return getCommercialEnvironment(awsRegion);
  }
}

/**
 * Get commercial AWS environment configuration
 */
function getCommercialEnvironment(region: string): AWSEnvironment {
  return {
    type: 'commercial',
    region,
    endpoints: {
      ec2: `https://ec2.${region}.amazonaws.com`,
      logs: `https://logs.${region}.amazonaws.com`,
    },
    arnPrefix: 'arn:aws',
    description: `Commercial AWS - ${region}`,
  };
}

/**
 * Get GovCloud environment configuration
 */
function getGovCloudEnvironment(region: string): AWSEnvironment {
  // Validate GovCloud regions
  const validGovCloudRegions = ['us-gov-east-1', 'us-gov-west-1'];

  if (!validGovCloudRegions.includes(region)) {
    console.warn(
      `Warning: ${region} is not a recognized GovCloud region. Valid regions: ${validGovCloudRegions.join(', ')}`
    );
    console.warn(`   Proceeding with configuration, but you may encounter connection issues.`);
  }

  return {
    type: 'govcloud',
    region,
    endpoints: {
      ec2: `https://ec2.${region}.amazonaws.com`,
      logs: `https://logs.${region}.amazonaws.com`,
    },
    arnPrefix: 'arn:aws-us-gov',
    description: `AWS GovCloud - ${region}`,
  };
}

/**
 * Get all supported regions for each environment type
 */
export function getSupportedRegions(): {
  commercial: string[];
  govcloud: string[];
} {
  return {
    commercial: [
      // US Regions
      'us-east-1',
      'us-east-2',
      'us-west-1',
      'us-west-2',
      // Europe
      'eu-central-1',
      'eu-west-1',
      'eu-west-2',
      'eu-west-3',
      'eu-north-1',
      // Asia Pacific
      'ap-northeast-1',
      'ap-northeast-2',
      'ap-southeast-1',
      'ap-southeast-2',
      'ap-south-1',
      'ap-east-1',
      // Canada
      'ca-central-1',
      // South America
      'sa-east-1',
      // Africa & Middle East
      'af-south-1',
      'me-south-1',
    ],
    govcloud: ['us-gov-east-1', 'us-gov-west-1'],
  };
}

/**
 * Validate region and provide suggestions if invalid
 */
export function validateRegion(region: string): {
  isValid: boolean;
  environment?: AWSEnvironment;
  suggestions?: string[];
  error?: string;
} {
  const supportedRegions = getSupportedRegions();
  const allRegions = [...supportedRegions.commercial, ...supportedRegions.govcloud];

  if (allRegions.includes(region)) {
    return {
      isValid: true,
      environment: detectAWSEnvironment(region),
    };
  }

  // Find similar regions (for typos)
  const suggestions = allRegions
    .filter(r => r.includes(region.substring(0, 3)) || region.includes(r.substring(0, 3)))
    .slice(0, 3);

  return {
    isValid: false,
    suggestions,
    error: `Invalid AWS region: ${region}`,
  };
}

/**
 * Check if ARN matches the environment type
 */
export function isValidARNForEnvironment(arn: string, environment: AWSEnvironment): boolean {
  if (!arn || !arn.startsWith('arn:')) {
    return false;
  }

  return arn.startsWith(environment.arnPrefix);
}

/**
 * Convert ARN to log group name, handling both commercial and GovCloud formats
 */
export function extractLogGroupFromARN(arn: string): string | null {
  // Example ARNs:
  // Commercial: arn:aws:logs:us-east-1:123456789012:log-group:/vpc/flowlogs/all:*
  // GovCloud:   arn:aws-us-gov:logs:us-gov-east-1:123456789012:log-group:/vpc/flowlogs/all:*

  const arnRegex = /^arn:(aws|aws-us-gov):logs:[^:]+:[^:]+:log-group:([^:]+)/;
  const match = arn.match(arnRegex);

  if (match && match[2]) {
    return match[2]; // Return the log group name part
  }

  return null;
}

/**
 * Get AWS SDK configuration for the detected environment
 */
export function getAWSSDKConfig(environment: AWSEnvironment): any {
  const config: any = {
    region: environment.region,
  };

  // AWS SDK automatically handles GovCloud endpoints when region starts with 'us-gov-'
  // No need to manually set endpoints as the SDK detects this

  return config;
}

/**
 * Display environment information
 */
export function displayEnvironmentInfo(environment: AWSEnvironment): void {
  console.log(`AWS Environment: ${environment.description}`);

  if (environment.type === 'govcloud') {
    console.log(`   • GovCloud region: ${environment.region}`);
    console.log(`   • ARN format: ${environment.arnPrefix}:*`);
    console.log(`   • Security: Enhanced compliance and isolation`);
  } else {
    console.log(`   • Commercial region: ${environment.region}`);
    console.log(`   • ARN format: ${environment.arnPrefix}:*`);
    console.log(`   • Environment: Standard AWS Commercial Cloud`);
  }
}

# IP Query Tool

A  CLI tool to analyze VPC Flow Logs with threat intelligence integration for both AWS Commercial and GovCloud environments. Takes in time stamp and sets a period around that time to query vpc flow logs.

Useful if you suspect you are being scanned and want to identify if it's a bad actor.

## Features

🔍 **VPC Flow Log Analysis**: Query AWS CloudWatch Logs for VPC Flow Log data  
🛡️ **Threat Intelligence**: Check public IPs against multiple malicious sources  
📊 **IP Pattern Analysis**: Identify common and frequent IPs across time periods  
🚨 **AWS WAF Integration**: Generate ready-to-use blocklists with /32 CIDR notation  
⚡ **Flexible Time Parsing**: Support multiple timestamp formats and time ranges  
🖥️ **CLI Interface**: Streamlined command-line interface with two distinct modes  
🌍 **Dual Environment**: Supports both AWS Commercial and GovCloud seamlessly  

## Quick Start

```bash
# Install dependencies
npm install

# File input mode (supports both .txt and .csv files)
ip-query --file-in timestamps.txt --time-in-seconds 5
ip-query --file-in data.csv --time-in-seconds 5

# Time range mode (ISO 8601, Unix timestamps, simple date-time)
ip-query --time-from "2025-01-01 12:00:00" --time-to "2025-01-01 12:00:10"
ip-query --time-from "2025-07-26T00:49:16.2146161Z" --time-to "2025-07-26T00:49:26.2146161Z"

# Specify region  
ip-query --file-in data.csv --time-in-seconds 5 --region us-gov-east-1

# Show detailed analysis progress
ip-query --verbose --time-from "2025-01-01 12:00:00" --time-to "2025-01-01 12:00:10"
```

> 📝 **Note**: See [Supported Time Formats](#supported-time-formats) for complete list of accepted timestamp formats including ISO 8601 with microseconds, Unix timestamps, and various date-time formats.

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Install globally (optional)
# may require sudo privileges.
npm run install-global
```

## Command Line Options

The tool supports two modes:

### File Input Mode
```bash
ip-query --file-in <FILE> --time-in-seconds <NUM> [OPTIONS]
```

### Time Range Mode  
```bash
ip-query --time-from <TIME> --time-to <TIME> [OPTIONS]
```

### Options

| Option | Description |
|--------|-------------|
| `--file-in <FILE>` | Input file containing timestamps (required for file mode) |
| `--time-in-seconds <NUM>` | Time window in seconds 1-3600 (required with --file-in) |
| `--time-from <TIME>` | Start time for analysis (required for time range mode) |
| `--time-to <TIME>` | End time for analysis (required for time range mode) |
| `--region <REGION>` | AWS region (optional, auto-detects from environment) |
| `--configure` | Setup configuration interactively |
| `--verbose` | Show detailed analysis progress |
| `--help` | Show help message |

## Environment Support

The tool automatically detects and configures for:

### Commercial AWS
- All standard AWS regions (us-east-1, eu-west-1, ap-southeast-1, etc.)
- Standard ARN format: `arn:aws:*`
- Commercial endpoints

### GovCloud
- us-gov-east-1, us-gov-west-1
- GovCloud ARN format: `arn:aws-us-gov:*`
- Isolated GovCloud endpoints

## Configuration

### Automatic Setup (Recommended)

Run the configuration wizard to create your `~/.ip-query` configuration file:

```bash
ip-query --configure
```

This will display a configuration template that you can copy to `~/.ip-query`.

### Manual Setup

Alternatively, create a `~/.ip-query` file manually in your home directory:

```bash
# Commercial AWS
# AWS_REGION=us-east-1
# AWS_PROFILE=commercial-profile

# GovCloud (default in example)
AWS_REGION=us-gov-east-1
AWS_PROFILE=govcloud-profile

# VPC Flow Log Configuration
VPC_FLOW_LOG_GROUP_NAME=/vpc/flowlogs/all

# Threat Intelligence API Keys (Optional)
ABUSEIPDB_API_KEY=your-api-key
VIRUSTOTAL_API_KEY=your-api-key
```

## Examples

```bash
# Setup configuration (first time)
ip-query --configure

# Plain text file (.txt)
ip-query --file-in timestamps.txt --time-in-seconds 5

# CSV file (.csv) - Format 1 (single column + time span)
ip-query --file-in data.csv --time-in-seconds 5

# CSV with embedded time spans (Format 2 & 3)
ip-query --file-in data.csv

# Specify region
ip-query --file-in data.csv --region us-gov-east-1

# Time range mode examples  
ip-query --time-from "2025-01-01 12:00:00" --time-to "2025-01-01 12:00:10"
ip-query --time-from 1753490956 --time-to 1753491256 --region us-gov-east-1
ip-query --time-from "2025-01-01T12:00:00Z" --time-to "2025-01-01T12:01:00Z"

# Show detailed progress with verbose mode
ip-query --verbose --time-from "2025-07-26T00:49:16.2146161Z" --time-to "2025-07-26T00:49:26.2146161Z"
```

## Input Formats

### Plain Text
```
2025-07-26T00:49:16Z
2025-07-26 07:01:03
1753490956
```

### CSV Format 1 (Single Column + --time-in-seconds)
```csv
2025-07-26T00:49:16Z
2025-07-26 07:01:03
1753490956
```

### CSV Format 2 (Timestamp, Span)
```csv
2025-07-26T00:49:16Z,5
2025-07-26 07:01:03,10
1753490956,2
```

### CSV Format 3 (Start, End)
```csv
2025-07-26T00:49:16Z,2025-07-26T00:49:21Z
2025-07-26 07:01:03,2025-07-26 07:01:13
1753490956,1753490966
```

## Supported Time Formats

The IP Query Tool supports multiple timestamp formats for maximum flexibility:

### ISO 8601 Formats
```
2025-07-26T00:49:16Z                    # Basic ISO 8601 with Z timezone
2025-07-26T00:49:16.123Z                # With milliseconds  
2025-07-26T00:49:16.2146161Z            # With microseconds
2025-07-26T00:49:16+00:00               # With timezone offset
2025-07-26T00:49:16.000-05:00           # With timezone and milliseconds
```

### Simple Date-Time Formats
```
2025-07-26 00:49:16                     # Space-separated date and time
2025-07-26 00:49:16.123                 # With fractional seconds
2025/07/26 00:49:16                     # Forward slash date separator
07/26/2025 00:49:16                     # US format (MM/DD/YYYY)
2025-07-26 00:49                        # Date with hour:minute only
```

### Unix Timestamps
```
1753490956                              # Unix timestamp (seconds)
1753490956123                           # Unix timestamp (milliseconds)
1753490956.123                          # Unix timestamp with fractional seconds
```

### Usage Examples

**Time Range Mode:**
```bash
# ISO 8601 formats
ip-query --time-from "2025-07-26T00:49:16.2146161Z" --time-to "2025-07-26T00:49:26.2146161Z"
ip-query --time-from "2025-07-26T00:49:16Z" --time-to "2025-07-26T00:49:26Z"

# Simple date-time formats  
ip-query --time-from "2025-07-26 00:49:16" --time-to "2025-07-26 00:49:26"
ip-query --time-from "2025/07/26 00:49:16" --time-to "2025/07/26 00:49:26"

# Unix timestamps
ip-query --time-from "1753490956" --time-to "1753490966"
ip-query --time-from "1753490956123" --time-to "1753490966123"
```

**File Input Mode (accepts all above formats in files):**
```bash
# Plain text file (.txt) with mixed formats
ip-query --file-in timestamps.txt --time-in-seconds 10

# CSV file (.csv) with timestamp columns
ip-query --file-in data.csv --time-in-seconds 5
```

### Notes on Time Format Detection

- The tool automatically detects the time format - no need to specify which format you're using
- Mixed formats are supported within the same file or CSV
- All times are internally converted to UTC for consistent analysis
- Timezone information is preserved when provided (ISO 8601 formats)
- Fractional seconds of any precision are supported (milliseconds, microseconds, nanoseconds)

For comprehensive examples and detailed format specifications, see [TIME_FORMATS.md](TIME_FORMATS.md).

## Requirements

- Node.js 18+ with TypeScript support
- AWS CLI configured with appropriate profile
- Access to VPC Flow Logs in your AWS environment
- Appropriate security clearance (for GovCloud)
- IAM permissions (see below)

## Required AWS IAM Permissions

The tool requires specific AWS IAM permissions to function properly. Create an IAM policy with the following permissions:

### Minimal Required Policy

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VPCFlowLogDiscovery",
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeFlowLogs"
            ],
            "Resource": "*"
        },
        {
            "Sid": "CloudWatchLogsQuery",
            "Effect": "Allow",
            "Action": [
                "logs:DescribeLogGroups",
                "logs:StartQuery",
                "logs:GetQueryResults",
                "logs:StopQuery"
            ],
            "Resource": "*"
        }
    ]
}
```

### Resource-Specific Policy (More Secure)

For enhanced security, you can restrict access to specific resources:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VPCFlowLogDiscovery",
            "Effect": "Allow",
            "Action": [
                "ec2:DescribeFlowLogs"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "aws:RequestedRegion": ["us-east-1", "us-gov-east-1"]
                }
            }
        },
        {
            "Sid": "CloudWatchLogsQuery",
            "Effect": "Allow",
            "Action": [
                "logs:DescribeLogGroups"
            ],
            "Resource": [
                "arn:aws:logs:us-east-1:ACCOUNT-ID:log-group:*",
                "arn:aws-us-gov:logs:us-gov-east-1:ACCOUNT-ID:log-group:*"
            ]
        },
        {
            "Sid": "CloudWatchLogsInsights",
            "Effect": "Allow",
            "Action": [
                "logs:StartQuery",
                "logs:GetQueryResults",
                "logs:StopQuery"
            ],
            "Resource": [
                "arn:aws:logs:us-east-1:ACCOUNT-ID:log-group:/vpc/flowlogs/*",
                "arn:aws-us-gov:logs:us-gov-east-1:ACCOUNT-ID:log-group:/vpc/flowlogs/*"
            ]
        }
    ]
}
```

### Permission Details

| Permission | Purpose | Scope |
|------------|---------|-------|
| `ec2:DescribeFlowLogs` | Discover VPC Flow Log configurations | Account-wide |
| `logs:DescribeLogGroups` | List available CloudWatch log groups | Region-specific |
| `logs:StartQuery` | Initiate CloudWatch Logs Insights queries | Log group-specific |
| `logs:GetQueryResults` | Retrieve query results | Query-specific |
| `logs:StopQuery` | Cancel running queries (cleanup) | Query-specific |

### Environment-Specific Considerations

#### Commercial AWS
- Standard ARN format: `arn:aws:logs:region:account:log-group:name`
- All commercial regions supported
- Use standard AWS endpoints

#### GovCloud
- GovCloud ARN format: `arn:aws-us-gov:logs:region:account:log-group:name`
- Limited to `us-gov-east-1` and `us-gov-west-1`
- Requires separate GovCloud credentials

### IAM User Setup

1. **Create IAM User or Role**:
   ```bash
   aws iam create-user --user-name ip-query-user
   ```

2. **Create and Attach Policy**:
   ```bash
   # Save the policy JSON to ip-query-policy.json
   aws iam create-policy \
     --policy-name IPQueryToolPolicy \
     --policy-document file://ip-query-policy.json
   
   aws iam attach-user-policy \
     --user-name ip-query-user \
     --policy-arn arn:aws:iam::ACCOUNT-ID:policy/IPQueryToolPolicy
   ```

3. **Create Access Keys**:
   ```bash
   aws iam create-access-key --user-name ip-query-user
   ```

4. **Configure AWS CLI Profile**:
   ```bash
   aws configure --profile ip-query
   ```

### Troubleshooting Permissions

#### Common Permission Errors

**Error**: `AccessDenied: User is not authorized to perform: ec2:DescribeFlowLogs`
- **Solution**: Add `ec2:DescribeFlowLogs` permission
- **Scope**: Can be restricted by region using conditions

**Error**: `AccessDenied: User is not authorized to perform: logs:StartQuery`
- **Solution**: Add CloudWatch Logs Insights permissions
- **Scope**: Can be restricted to specific log groups

**Error**: `ResourceNotFoundException: The specified log group does not exist`
- **Solution**: Verify VPC Flow Logs are enabled and configured correctly
- **Check**: Log group names match the expected format (`/vpc/flowlogs/all`)

#### Permission Testing

Test your permissions before running the full analysis:

```bash
# Test VPC Flow Log access
aws ec2 describe-flow-logs --region us-east-1

# Test CloudWatch Logs access
aws logs describe-log-groups --region us-east-1 --log-group-name-prefix "/vpc"

# Test Logs Insights query capability
aws logs start-query \
  --region us-east-1 \
  --log-group-name "/vpc/flowlogs/all" \
  --start-time 1753490956 \
  --end-time 1753490966 \
  --query-string "fields @timestamp | limit 1"
```


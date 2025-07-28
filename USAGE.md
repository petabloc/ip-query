# IP Query Tool - Detailed Usage Guide

## Time Formats & Parsing

The tool supports flexible time input parsing with automatic format detection:

### Supported Formats

| Format | Example | Notes |
|--------|---------|-------|
| ISO 8601 | `2025-07-26T00:49:16.2146161Z` | Microseconds supported |
| Simple DateTime | `2025-07-26 00:49:16` | Space-separated |
| US Format | `07/26/2025 00:49:16` | MM/DD/YYYY format |
| Unix Timestamp | `1753490956` | Seconds since epoch |
| Epoch Milliseconds | `1753490956000` | Milliseconds since epoch |
| Partial Precision | `2025-07-26 07:01` | Minimum: year, month, day, hour, minute |

### Time Window Behavior

- **Single Timestamp**: Creates a window centered on the timestamp
  - `--time-in-seconds 4` → 2 seconds before + 2 seconds after
  - `--time-in-seconds 5` → 2 seconds before + 3 seconds after (uneven split)
- **Time Range**: Direct start/end specification in interactive mode
- **Constraints**: 1 second minimum, 3600 seconds (1 hour) maximum

## Input File Formats

### Basic Format
```bash
# Comments start with # and are ignored
2025-07-26T00:49:16.2146161Z
2025-07-26T00:55:08.4769206Z
1753490956
```

### Mixed Format Example
```bash
# Mixed timestamp formats - all valid
2025-07-26T00:49:16.2146161Z  # ISO 8601 with microseconds
2025-07-26 07:01:03           # Simple datetime
07/26/2025 07:02:18           # US format
1753490956                    # Unix timestamp
1753491308000                 # Epoch milliseconds
```

## Command Line Usage Patterns

### Basic Analysis
```bash
# Minimum required arguments
ip-query --file-in timestamps.txt --time-in-seconds 5

# With region specification
ip-query --file-in data.txt --time-in-seconds 10 --region us-east-1

# Save results to file
ip-query --file-in data.txt --time-in-seconds 5 --file-out analysis.json
```

### Environment-Specific Examples

#### Commercial AWS
```bash
# US East
ip-query --file-in data.txt --time-in-seconds 5 --region us-east-1

# Europe
ip-query --file-in data.txt --time-in-seconds 10 --region eu-west-1

# Asia Pacific
ip-query --file-in data.txt --time-in-seconds 5 --region ap-southeast-1
```

#### GovCloud
```bash
# GovCloud East
ip-query --file-in data.txt --time-in-seconds 5 --region us-gov-east-1

# GovCloud West
ip-query --file-in data.txt --time-in-seconds 10 --region us-gov-west-1
```

## Interactive Mode Workflows

### File Analysis Workflow
```
ip-query> analyze
📁 Select analysis type:
1. File input (analyze timestamps from file)
2. Time range (analyze specific time window)
Choose option (1-2): 1

Enter timestamp file path: /path/to/timestamps.txt
Enter time window in seconds (1-3600): 5
Enter AWS region (optional, press Enter for auto-detect): us-gov-east-1
Enter output file (optional, press Enter to skip): results.json
```

### Time Range Analysis Workflow
```
ip-query> time-range
📅 Enter time range for analysis:
Enter start time: 2025-07-26 00:49:00
Enter end time: 2025-07-26 00:52:00
Enter AWS region (optional, press Enter for auto-detect): 
Enter output file (optional, press Enter to skip): 
```

## Output Analysis

### Console Output Structure
1. **Environment Detection**: Shows detected AWS environment and region
2. **Timestamp Analysis**: Parsing results and time window information
3. **VPC Flow Log Discovery**: Available log groups
4. **Query Execution**: Real-time progress of CloudWatch queries
5. **IP Analysis**: Public/private IP counts and patterns
6. **Threat Intelligence**: Malicious IP detection results
7. **AWS WAF Blocklist**: Ready-to-use CIDR format blocklist

### File Outputs
- **Text Format**: `aws-waf-blocklist-YYYY-MM-DDTHH-MM-SS.txt`
  - Human-readable with comments and confidence levels
  - Direct copy-paste into AWS WAF
- **JSON Format**: `results.json` (if --file-out specified)
  - Complete analysis data for programmatic use

## AWS WAF Integration

### High Confidence IPs (Immediate Blocking)
```
# HIGH CONFIDENCE MALICIOUS IPs
# 3 IP(s) - Recommended for immediate blocking
198.51.100.42/32
203.0.113.15/32
192.0.2.123/32
```

### Medium Confidence IPs (Review Before Blocking)
```
# MEDIUM CONFIDENCE MALICIOUS IPs
# 2 IP(s) - Consider blocking after review
203.0.113.50/32
198.51.100.99/32
```

### Using in AWS WAF
1. Copy the generated IP list from the text file
2. Create or update an AWS WAF IP Set
3. Paste the /32 CIDR entries
4. Associate with WAF rules

## Troubleshooting

### Common Issues

#### No VPC Flow Log Groups Found
- Ensure VPC Flow Logs are enabled on your VPCs
- Verify logs are sent to CloudWatch Logs (not S3)
- Check AWS credentials have proper permissions

#### Region/Endpoint Errors
- Verify region name is correct (us-gov-east-1, not us-gov-east)
- Ensure AWS profile matches target environment
- Check network connectivity to AWS endpoints

#### Permission Errors
Required permissions:
- `ec2:DescribeFlowLogs`
- `logs:DescribeLogGroups`
- `logs:StartQuery`
- `logs:GetQueryResults`
- `logs:StopQuery`

#### Time Parsing Errors
- Ensure timestamps include at least year, month, day, hour, minute
- Check for valid date ranges (1970-2100)
- Use consistent format within input files

### Environment Variables Debug
```bash
# Check current AWS configuration
aws sts get-caller-identity

# Verify region setting
echo $AWS_REGION

# Test VPC Flow Logs access
aws ec2 describe-flow-logs --region us-gov-east-1
```

## Performance Considerations

- **Query Batching**: Tool processes 5 concurrent queries with rate limiting
- **Time Window Size**: Larger windows capture more data but take longer
- **Threat Intelligence**: API rate limits may slow analysis for many IPs
- **Log Group Size**: Large log groups may require longer query times

## Security Notes

- **GovCloud Data**: Ensure analysis results stay within GovCloud boundaries
- **API Keys**: Store threat intelligence API keys securely
- **Logging**: Tool logs do not contain sensitive IP information
- **Output Files**: Generated blocklists may contain sensitive network information
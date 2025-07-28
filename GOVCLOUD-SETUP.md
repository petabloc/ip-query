# AWS GovCloud Specific Setup

This guide covers GovCloud-specific setup considerations. For general usage, see [README.md](README.md) and [USAGE.md](USAGE.md).

## GovCloud Prerequisites

- **Security Clearance**: Appropriate clearance level for GovCloud access
- **GovCloud Account**: Separate from commercial AWS accounts
- **Network Access**: Ability to reach GovCloud endpoints
- **Compliance**: Adherence to government data handling requirements

## AWS CLI Configuration for GovCloud

### 1. Create GovCloud Profile

```bash
# Configure a new profile specifically for GovCloud
aws configure --profile govcloud

# When prompted, enter:
# AWS Access Key ID: [Your GovCloud Access Key]
# AWS Secret Access Key: [Your GovCloud Secret Key]  
# Default region name: us-gov-east-1
# Default output format: json
```

### 2. Verify GovCloud Access

```bash
# Test the configuration
aws sts get-caller-identity --profile govcloud

# Expected output format:
# {
#     "UserId": "AIDACKCEVSQ6C2EXAMPLE",
#     "Account": "123456789012",
#     "Arn": "arn:aws-us-gov:iam::123456789012:user/username"
# }

# Note the "aws-us-gov" ARN prefix (different from commercial "aws")
```

### 3. Test VPC Flow Logs Access

```bash
# List available flow logs
aws ec2 describe-flow-logs --profile govcloud --region us-gov-east-1

# Check CloudWatch log groups
aws logs describe-log-groups --profile govcloud --region us-gov-east-1
```

## Environment Configuration

### .env for GovCloud

```bash
# GovCloud Configuration
AWS_REGION=us-gov-east-1
AWS_PROFILE=govcloud

# VPC Flow Log Configuration  
VPC_FLOW_LOG_GROUP_NAME=/vpc/flowlogs/all

# Threat Intelligence (External APIs - review compliance)
# ABUSEIPDB_API_KEY=your-key
# VIRUSTOTAL_API_KEY=your-key
```

### Key Differences from Commercial AWS

| Aspect | Commercial AWS | GovCloud |
|--------|----------------|----------|
| Regions | us-east-1, eu-west-1, etc. | us-gov-east-1, us-gov-west-1 |
| ARN Format | `arn:aws:service:...` | `arn:aws-us-gov:service:...` |
| Endpoints | `service.region.amazonaws.com` | `service.region.amazonaws.com` |
| Account Separation | Can share with commercial | Isolated from commercial |

## Common GovCloud Issues

### Endpoint Connection Errors

**Error**: `Could not connect to the endpoint URL: 'https://ec2.us-gov-east.amazonaws.com/'`

**Solution**: Region name is incorrect
```bash
# Wrong (missing '-1')
aws configure set region us-gov-east --profile govcloud

# Correct
aws configure set region us-gov-east-1 --profile govcloud
```

### ARN Format Issues

GovCloud resources use different ARN prefixes:
- **Flow Log ARN**: `arn:aws-us-gov:logs:us-gov-east-1:123456789012:log-group:/vpc/flowlogs/all:*`
- **Tool**: Automatically detects and handles both formats

### Cross-Environment Confusion

**Issue**: Using commercial AWS credentials with GovCloud regions
```bash
# Check which environment you're in
aws sts get-caller-identity --profile govcloud | grep Arn

# GovCloud ARN contains "aws-us-gov"
# Commercial ARN contains "aws" (not "aws-us-gov")
```

## Security Considerations

### Data Handling
- **Isolation**: GovCloud data must remain within GovCloud boundaries
- **Export Restrictions**: Generated blocklists may be subject to export controls
- **Logging**: Ensure local logs don't contain classified information

### Threat Intelligence APIs
- **External Services**: Review compliance requirements for external API usage
- **Data Sharing**: Some threat intel services may not be approved for GovCloud data
- **Alternative Sources**: Consider using only free/local threat intelligence sources

### Network Configuration
- **Proxy Settings**: GovCloud environments may require proxy configuration
- **Firewall Rules**: Ensure outbound access to AWS GovCloud endpoints
- **VPN Requirements**: Some environments require VPN for GovCloud access

## Compliance Notes

- **FedRAMP**: Tool operates within FedRAMP boundaries when used in GovCloud
- **Data Residency**: All processing occurs within GovCloud infrastructure
- **Audit Logging**: AWS CloudTrail logs all API calls for compliance tracking
- **Encryption**: All data encrypted in transit and at rest within GovCloud

## Validation Commands

```bash
# Verify GovCloud environment detection
ip-query --region us-gov-east-1 --help

# Test with minimal input
echo "2025-07-26T00:49:16Z" > test-timestamps.txt
ip-query --file-in test-timestamps.txt --time-in-seconds 5 --region us-gov-east-1

# Expected output should show:
# 🏛️ AWS Environment: AWS GovCloud - us-gov-east-1
```

## Migration from Commercial AWS

If migrating from commercial AWS:

1. **Separate Profiles**: Create distinct AWS CLI profiles
2. **Update Regions**: Change from commercial regions to GovCloud regions  
3. **Verify ARNs**: Confirm VPC Flow Log ARNs use `aws-us-gov` prefix
4. **Test Access**: Validate connectivity before production use
5. **Update Scripts**: Modify any hardcoded region references

The IP Query tool handles the technical differences automatically once proper credentials and regions are configured.
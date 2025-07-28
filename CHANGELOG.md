# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of IP Query Tool
- VPC Flow Log analysis with threat intelligence integration
- Support for AWS Commercial and GovCloud environments
- Multiple timestamp format support (ISO 8601, Unix timestamps, simple date-time)
- CSV and plain text file input formats
- Interactive configuration setup via `--configure` command
- AWS WAF blocklist generation with confidence levels
- Comprehensive command-line interface with help system
- Automatic region detection
- Verbose logging mode
- Multiple threat intelligence sources integration
- Comprehensive unit test suite with security edge case testing
- Linting and code formatting with ESLint and Prettier
- GitHub Actions CI/CD pipeline

### Features
- **Multi-Environment Support**: Works with both AWS Commercial and GovCloud
- **Flexible Input**: Supports multiple timestamp formats and CSV/text files
- **Threat Intelligence**: Integrates with multiple threat intelligence sources
- **Security Focus**: Generates AWS WAF-ready blocklists with confidence ratings
- **User-Friendly**: Interactive configuration and comprehensive help system
- **Developer-Ready**: Full TypeScript support with comprehensive testing

### Security
- Input validation for all timestamp formats
- Protection against date corruption vulnerabilities
- Secure handling of AWS credentials and API keys
- Rate limiting for threat intelligence API calls

### Documentation
- Comprehensive README with usage examples
- Detailed timestamp format documentation
- Configuration guide for both AWS environments
- IAM permissions documentation
- Troubleshooting guide
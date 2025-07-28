# Supported Time Formats - IP Query Tool

This document provides comprehensive examples of all supported timestamp formats for the IP Query Tool.

## Overview

The IP Query Tool automatically detects and parses multiple timestamp formats without requiring format specification. All formats are converted internally to UTC for consistent analysis.

## Supported Formats

### 1. ISO 8601 Formats

**Basic ISO 8601:**
```
2025-07-26T00:49:16Z
2025-07-26T00:49:16+00:00
2025-07-26T00:49:16-05:00
```

**With Fractional Seconds:**
```
2025-07-26T00:49:16.1Z                  # 1 decimal place
2025-07-26T00:49:16.12Z                 # 2 decimal places  
2025-07-26T00:49:16.123Z                # 3 decimal places (milliseconds)
2025-07-26T00:49:16.1234Z               # 4 decimal places
2025-07-26T00:49:16.12345Z              # 5 decimal places
2025-07-26T00:49:16.123456Z             # 6 decimal places (microseconds)
2025-07-26T00:49:16.1234567Z            # 7 decimal places
2025-07-26T00:49:16.2146161Z            # Real-world example with microseconds
```

**With Timezone Offsets:**
```
2025-07-26T00:49:16.123+00:00           # UTC with milliseconds
2025-07-26T00:49:16.123-05:00           # EST with milliseconds
2025-07-26T00:49:16.123+09:00           # JST with milliseconds
```

### 2. Simple Date-Time Formats

**Space-Separated (YYYY-MM-DD HH:MM:SS):**
```
2025-07-26 00:49:16                     # Basic format
2025-07-26 00:49:16.123                 # With fractional seconds
2025-07-26 00:49                        # Hour:minute only (seconds = 0)
```

**Forward Slash Date Separators:**
```
2025/07/26 00:49:16                     # YYYY/MM/DD format
2025/07/26 00:49:16.123                 # With fractional seconds
```

**US Format (MM/DD/YYYY):**
```
07/26/2025 00:49:16                     # US date format
07/26/2025 00:49:16.123                 # With fractional seconds
```

### 3. Unix Timestamps

**Seconds Since Epoch:**
```
1753490956                              # Standard Unix timestamp
1753490956.0                            # With decimal point
1753490956.123                          # With fractional seconds
```

**Milliseconds Since Epoch:**
```
1753490956000                           # Millisecond timestamp
1753490956123                           # With millisecond precision
```

## Format Detection Logic

The tool uses the following detection strategy:

1. **ISO 8601 Pattern**: Matches `YYYY-MM-DDTHH:MM:SS` with optional fractional seconds and timezone
2. **Unix Timestamp**: Numeric values in reasonable timestamp ranges
3. **Simple Date-Time**: Various date separators with time components
4. **Fallback**: Error if no pattern matches

## Usage Examples

### Command Line Examples

**ISO 8601 Formats:**
```bash
# Basic ISO 8601
ip-query --time-from "2025-07-26T00:49:16Z" --time-to "2025-07-26T00:49:26Z"

# With microseconds (real-world Windows timestamp)
ip-query --time-from "2025-07-26T00:49:16.2146161Z" --time-to "2025-07-26T00:49:26.2146161Z"

# With timezone offset
ip-query --time-from "2025-07-26T00:49:16-05:00" --time-to "2025-07-26T00:49:26-05:00"
```

**Simple Date-Time Formats:**
```bash
# Space-separated
ip-query --time-from "2025-07-26 00:49:16" --time-to "2025-07-26 00:49:26"

# Forward slash separators
ip-query --time-from "2025/07/26 00:49:16" --time-to "2025/07/26 00:49:26"

# US format
ip-query --time-from "07/26/2025 00:49:16" --time-to "07/26/2025 00:49:26"
```

**Unix Timestamps:**
```bash
# Seconds
ip-query --time-from "1753490956" --time-to "1753490966"

# Milliseconds
ip-query --time-from "1753490956000" --time-to "1753490966000"

# With fractional seconds
ip-query --time-from "1753490956.123" --time-to "1753490966.123"
```

### File Input Examples

**Plain Text File (timestamps.txt):**
```
2025-07-26T00:49:16.2146161Z
2025-07-26 00:50:30
1753490956
2025/07/26 00:51:45.123
07/26/2025 00:52:00
```

**CSV Files:**

*Format 1 - Single Column:*
```csv
2025-07-26T00:49:16.2146161Z
2025-07-26 00:50:30
1753490956
```

*Format 2 - Timestamp + Duration:*
```csv
2025-07-26T00:49:16.2146161Z,5
2025-07-26 00:50:30,10
1753490956,3
```

*Format 3 - Start + End Times:*
```csv
2025-07-26T00:49:16.2146161Z,2025-07-26T00:49:21.2146161Z
2025-07-26 00:50:30,2025-07-26 00:50:40
1753490956,1753490966
```

## Time Zone Handling

- **ISO 8601 with timezone**: Timezone information is preserved and converted to UTC
- **ISO 8601 with Z**: Treated as UTC
- **Simple formats**: Treated as local system time, then converted to UTC
- **Unix timestamps**: Always treated as UTC (by definition)

## Precision Support

- **Seconds**: Standard precision for most formats
- **Milliseconds**: Supported in all formats (3 decimal places)
- **Microseconds**: Supported in all formats (6 decimal places)
- **Nanoseconds**: Technically supported but limited by JavaScript Date precision

## Error Handling

If a timestamp cannot be parsed, the tool will:

1. Show a clear error message indicating the problematic timestamp
2. List all supported formats
3. Continue processing other valid timestamps in the same file
4. Provide a summary of parsing errors

## Best Practices

1. **Consistency**: Use the same format throughout a file when possible
2. **Precision**: Include fractional seconds when precision is important
3. **Timezone**: Specify timezone information for ISO 8601 formats when dealing with different time zones
4. **Testing**: Use the `--verbose` flag to see how timestamps are being parsed

## Real-World Examples

**Windows Event Logs:**
```
2025-07-26T00:49:16.2146161Z    # Typical Windows timestamp format
```

**Linux System Logs:**
```
2025-07-26 00:49:16             # Syslog format
1753490956                      # Unix timestamp
```

**Application Logs:**
```
2025-07-26T00:49:16.123Z        # JSON log timestamp
2025/07/26 00:49:16.123         # Custom application format
```

**Database Exports:**
```
2025-07-26 00:49:16.123456      # Database datetime with microseconds
```
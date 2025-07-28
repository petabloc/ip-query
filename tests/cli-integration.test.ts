// import { jest } from '@jest/globals';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('CLI Integration Tests', () => {
  let tempDir: string;
  let configFile: string;
  let testTimestampFile: string;

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ip-query-test-'));
    configFile = path.join(tempDir, '.ip-query');
    testTimestampFile = path.join(tempDir, 'timestamps.txt');
  });

  afterAll(async () => {
    // Cleanup temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup temp directory:', error);
    }
  });

  beforeEach(async () => {
    // Create a valid config file for each test
    await fs.writeFile(configFile, 'VPC_FLOW_LOG_GROUP_NAME=/test/logs\nAWS_REGION=us-east-1\n');
  });

  /**
   * Helper function to run CLI commands
   */
  async function runCLI(
    args: string[],
    options: {
      configPath?: string;
      timeout?: number;
      expectError?: boolean;
      expectTimeout?: boolean;
    } = {}
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (options.configPath) {
        env.HOME = path.dirname(options.configPath);
      } else {
        env.HOME = tempDir;
      }

      const child = spawn('node', ['dist/cli.js', ...args], {
        cwd: process.cwd(),
        env,
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', data => {
        stdout += data.toString();
      });

      child.stderr?.on('data', data => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        // For interactive commands, timeout is expected - return the output we got
        if (options.expectTimeout) {
          resolve({
            stdout,
            stderr,
            exitCode: null,
          });
        } else {
          reject(new Error('CLI command timed out'));
        }
      }, options.timeout || 5000);

      child.on('close', code => {
        clearTimeout(timeout);
        resolve({
          stdout,
          stderr,
          exitCode: code,
        });
      });

      child.on('error', error => {
        clearTimeout(timeout);
        if (options.expectError) {
          resolve({
            stdout,
            stderr: error.message,
            exitCode: 1,
          });
        } else {
          reject(error);
        }
      });
    });
  }

  describe('Help Command', () => {
    it('should display help information', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('IP Query Tool - VPC Flow Log Analysis');
      expect(result.stdout).toContain('File Input Mode');
      expect(result.stdout).toContain('Time Range Mode');
      expect(result.stdout).toContain('--time-from');
      expect(result.stdout).toContain('--time-to');
      expect(result.stdout).toContain('--file-in');
      expect(result.stdout).toContain('--time-in-seconds');
    });
  });

  describe('Configuration Mode', () => {
    it('should start interactive configuration setup', async () => {
      // Since configuration is now interactive, we expect it to start but not complete
      // This test verifies the configuration mode starts correctly
      const result = await runCLI(['--configure'], { timeout: 2000, expectTimeout: true });

      // The process should start configuration setup (it times out waiting for input, which is expected)
      expect(result.stdout).toContain('IP Query Tool Configuration Setup');
    }, 10000);
  });

  describe('Missing Configuration', () => {
    it('should exit gracefully when config is missing', async () => {
      // Use a directory without config file
      const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'empty-'));

      try {
        const result = await runCLI(
          ['--time-from', '2025-01-01 12:00:00', '--time-to', '2025-01-01 12:00:10'],
          {
            configPath: path.join(emptyDir, '.ip-query'),
          }
        );

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Configuration missing or incomplete');
        expect(result.stderr).toContain('VPC_FLOW_LOG_GROUP_NAME');
        expect(result.stderr).toContain('ip-query --configure');
      } finally {
        await fs.rm(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe('Argument Validation', () => {
    it('should require either file input or time range', async () => {
      const result = await runCLI([]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Either --file-in or both --time-from and --time-to are required'
      );
    });

    it('should not allow both file and time range modes', async () => {
      await fs.writeFile(testTimestampFile, '2025-01-01 12:00:00\n');

      const result = await runCLI([
        '--file-in',
        testTimestampFile,
        '--time-in-seconds',
        '5',
        '--time-from',
        '2025-01-01 12:00:00',
        '--time-to',
        '2025-01-01 12:00:10',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Cannot use both file input and time range modes simultaneously'
      );
    });

    it('should require --time-in-seconds with --file-in', async () => {
      await fs.writeFile(testTimestampFile, '2025-01-01 12:00:00\n');

      const result = await runCLI(['--file-in', testTimestampFile]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--time-in-seconds is required when using --file-in');
    });

    it('should validate time-in-seconds range', async () => {
      await fs.writeFile(testTimestampFile, '2025-01-01 12:00:00\n');

      const result = await runCLI(['--file-in', testTimestampFile, '--time-in-seconds', '3700']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('--time-in-seconds must be between 1 and 3600');
    });

    it('should require both --time-from and --time-to', async () => {
      const result = await runCLI(['--time-from', '2025-01-01 12:00:00']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        'Either --file-in or both --time-from and --time-to are required'
      );
    });
  });

  describe('File Input Mode', () => {
    it('should process plain text timestamp file', async () => {
      await fs.writeFile(testTimestampFile, '2025-01-01 12:00:00\n2025-01-01 12:01:00\n');

      const result = await runCLI(['--file-in', testTimestampFile, '--time-in-seconds', '5'], {
        timeout: 10000,
      });

      // Should start processing (will fail at AWS level, but that's expected)
      expect(result.stdout).toContain('IP Query Tool - Analyzing');
      expect(result.stdout).toContain('Auto-detected AWS region');
    });

    it('should detect and process CSV format', async () => {
      await fs.writeFile(testTimestampFile, '2025-01-01 12:00:00,5\n2025-01-01 12:01:00,10\n');

      const result = await runCLI(['--file-in', testTimestampFile, '--time-in-seconds', '5'], {
        timeout: 10000,
      });

      // Check that it starts processing (the CSV parsing happens internally)
      expect(result.stdout).toContain('IP Query Tool - Analyzing');
      expect(result.stdout).toContain('Auto-detected AWS region');
    });

    it('should handle non-existent file', async () => {
      const result = await runCLI(['--file-in', '/nonexistent/file.txt', '--time-in-seconds', '5']);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Failed to read file');
    });
  });

  describe('Time Range Mode', () => {
    it('should process time range with ISO format', async () => {
      const result = await runCLI(
        ['--time-from', '2025-01-01T12:00:00Z', '--time-to', '2025-01-01T12:00:10Z'],
        {
          timeout: 10000,
        }
      );

      expect(result.stdout).toContain('IP Query Tool - Analyzing');
      expect(result.stdout).toContain('Auto-detected AWS region');
      // The CLI should start processing (will fail at AWS level without credentials)
    });

    it('should process time range with simple format', async () => {
      const result = await runCLI(
        ['--time-from', '2025-01-01 12:00:00', '--time-to', '2025-01-01 12:00:05'],
        {
          timeout: 10000,
        }
      );

      expect(result.stdout).toContain('IP Query Tool - Analyzing');
      expect(result.stdout).toContain('Auto-detected AWS region');
    });

    it('should validate minimum time span', async () => {
      const result = await runCLI([
        '--time-from',
        '2025-01-01 12:00:00',
        '--time-to',
        '2025-01-01 12:00:00',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Minimum time span is 1 second');
    });

    it('should validate maximum time span', async () => {
      const result = await runCLI([
        '--time-from',
        '2025-01-01 12:00:00',
        '--time-to',
        '2025-01-01 14:00:01', // > 1 hour
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Maximum time span is 1 hour');
    });

    it('should handle invalid time format', async () => {
      const result = await runCLI([
        '--time-from',
        'invalid-time',
        '--time-to',
        '2025-01-01 12:00:10',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Error:');
    });
  });

  describe('Region Options', () => {
    it('should accept custom region', async () => {
      const result = await runCLI(
        [
          '--time-from',
          '2025-01-01 12:00:00',
          '--time-to',
          '2025-01-01 12:00:05',
          '--region',
          'us-gov-east-1',
        ],
        {
          timeout: 10000,
        }
      );

      expect(result.stdout).toContain('Using AWS region: us-gov-east-1');
    });

    it('should validate invalid regions', async () => {
      const result = await runCLI([
        '--time-from',
        '2025-01-01 12:00:00',
        '--time-to',
        '2025-01-01 12:00:05',
        '--region',
        'invalid-region',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid region');
    });
  });
});

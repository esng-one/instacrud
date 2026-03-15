#!/usr/bin/env ts-node
/**
 * Test runner that runs all *_test.ts files in the test directory.
 *
 * Similar to backend's run_all_test.py but for frontend Jest tests.
 *
 * Usage:
 *   npm test
 *   npm run test:live
 *   npm run test:pentest
 *
 * This file serves as a marker for running all tests.
 * The actual test discovery is handled by Jest configuration.
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Find all test files in the test directory
 */
function getTestFiles(): string[] {
  const testDir = __dirname;
  const files = fs.readdirSync(testDir);

  return files
    .filter(file => file.endsWith('_test.ts') && file !== 'run_all_test.ts')
    .map(file => path.join(testDir, file))
    .sort();
}

/**
 * Main function
 */
function main() {
  const testFiles = getTestFiles();

  if (testFiles.length === 0) {
    console.log('No test files found matching *_test.ts');
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} test file(s):`);
  testFiles.forEach(file => {
    console.log(`  - ${path.basename(file)}`);
  });
  console.log('');

  console.log('Run tests with:');
  console.log('  npm test              # Run all tests');
  console.log('  npm run test:live     # Run tests against live server');
  console.log('  npm run test:pentest  # Run security tests');
  console.log('');

  // This script is mainly for documentation and discovery
  // Actual test execution is handled by Jest via package.json scripts
}

if (require.main === module) {
  main();
}

export { getTestFiles };

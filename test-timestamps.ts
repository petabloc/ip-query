#!/usr/bin/env node

/**
 * Test script to verify timestamp parsing and conversion
 */

import { INPUT_TIMESTAMPS, analyzeTimestamps, groupTimestampsBySecond } from './src/timestamps.js';

console.log('🧪 Testing timestamp parsing...\n');

const analyses = analyzeTimestamps(INPUT_TIMESTAMPS);
const grouped = groupTimestampsBySecond(analyses);

console.log('📅 Timestamp Analysis Results:');
console.log('='.repeat(80));

analyses.forEach((analysis, index) => {
  console.log(`${index + 1}. ${analysis.originalTimestamp}`);
  console.log(`   └─> Parsed: ${analysis.parsedDate.toISOString()}`);
  console.log(`   └─> Epoch: ${analysis.epochSeconds}`);
  console.log(`   └─> Query Range: ${analysis.queryStartTime} - ${analysis.queryEndTime}`);
  console.log(`   └─> Human Readable: ${new Date(analysis.queryStartTime * 1000).toISOString()}`);
  console.log('');
});

console.log(`📊 Summary:`);
console.log(`   • Total timestamps: ${INPUT_TIMESTAMPS.length}`);
console.log(`   • Unique seconds: ${grouped.size}`);
console.log(`   • Duplicate seconds: ${INPUT_TIMESTAMPS.length - grouped.size}`);

console.log(`\n🕒 Grouped by second:`);
grouped.forEach((timestampsInSecond, epochSecond) => {
  if (timestampsInSecond.length > 1) {
    console.log(`   • ${new Date(epochSecond * 1000).toISOString()}: ${timestampsInSecond.length} timestamps`);
    timestampsInSecond.forEach(ts => {
      console.log(`     - ${ts.originalTimestamp}`);
    });
  }
});

console.log('\n✅ Timestamp parsing test complete!');
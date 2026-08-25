// diagnostic.ts - Run this to verify your setup
import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 AI Email Infrastructure Backend Diagnostics\n');

// Check if key files exist
const filesToCheck = [
  'src/services/imapSync.service.ts',
  'src/services/elasticsearch.service.ts',
  'dist/services/imapSync.service.js',
  'dist/services/elasticsearch.service.js',
  'dist/server.js'
];

console.log('📁 Checking files:\n');
filesToCheck.forEach(file => {
  const exists = fs.existsSync(file);
  const icon = exists ? '✅' : '❌';
  console.log(`${icon} ${file}`);
  
  if (exists) {
    const stats = fs.statSync(file);
    console.log(`   Modified: ${stats.mtime.toLocaleString()}`);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB\n`);
  } else {
    console.log(`   File not found!\n`);
  }
});

// Check if extractFromAddress exists in the TypeScript file
const tsFile = 'src/services/imapSync.service.ts';
if (fs.existsSync(tsFile)) {
  const content = fs.readFileSync(tsFile, 'utf8');
  const hasExtractFrom = content.includes('extractFromAddress');
  const hasNormalize = content.includes('normalizeAddresses');
  
  console.log('🔧 Code Check (TypeScript):\n');
  console.log(`${hasExtractFrom ? '✅' : '❌'} extractFromAddress method exists`);
  console.log(`${hasNormalize ? '✅' : '❌'} normalizeAddresses method exists\n`);
  
  if (hasExtractFrom) {
    const match = content.match(/private extractFromAddress\(.*?\): \{[^}]+\}/s);
    if (match) {
      console.log('Found extractFromAddress:');
      console.log(match[0].substring(0, 150) + '...\n');
    }
  }
}

// Check if extractFromAddress exists in the compiled JavaScript file
const jsFile = 'dist/services/imapSync.service.js';
if (fs.existsSync(jsFile)) {
  const content = fs.readFileSync(jsFile, 'utf8');
  const hasExtractFrom = content.includes('extractFromAddress');
  const hasNormalize = content.includes('normalizeAddresses');
  
  console.log('🔧 Code Check (Compiled JavaScript):\n');
  console.log(`${hasExtractFrom ? '✅' : '❌'} extractFromAddress method exists`);
  console.log(`${hasNormalize ? '✅' : '❌'} normalizeAddresses method exists\n`);
  
  if (!hasExtractFrom || !hasNormalize) {
    console.log('⚠️  WARNING: Your compiled JavaScript is outdated!');
    console.log('   Run: npm run build\n');
  }
}

// Check package.json scripts
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
console.log('📦 NPM Scripts:\n');
console.log(`   Build: ${packageJson.scripts.build}`);
console.log(`   Start: ${packageJson.scripts.start}`);
console.log(`   Dev: ${packageJson.scripts.dev}\n`);

// Check environment variables
console.log('🔐 Environment Variables:\n');
const envVars = [
  'EMAIL_ACCOUNT_1',
  'EMAIL_PASSWORD_1',
  'EMAIL_ACCOUNT_2',
  'EMAIL_PASSWORD_2',
  'ELASTICSEARCH_URL',
  'GEMINI_API_KEY'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  const exists = !!value;
  const icon = exists ? '✅' : '❌';
  const display = exists ? `${value.substring(0, 20)}...` : 'Not set';
  console.log(`${icon} ${varName}: ${display}`);
});

console.log('\n' + '='.repeat(60));
console.log('\n💡 Recommendations:\n');

if (!fs.existsSync('dist/services/imapSync.service.js')) {
  console.log('1. Run: npm run build');
}

const jsFile2 = 'dist/services/imapSync.service.js';
if (fs.existsSync(jsFile2)) {
  const content = fs.readFileSync(jsFile2, 'utf8');
  if (!content.includes('extractFromAddress')) {
    console.log('2. Your compiled code is outdated. Delete dist/ and rebuild:');
    console.log('   rmdir /s /q dist');
    console.log('   npm run build');
  }
}

console.log('3. After rebuilding, delete the Elasticsearch index:');
console.log('   curl -X DELETE http://localhost:9200/emails');
console.log('\n4. Start the server:');
console.log('   npm start');
console.log('\nOR use development mode (no build needed):');
console.log('   npm run dev');
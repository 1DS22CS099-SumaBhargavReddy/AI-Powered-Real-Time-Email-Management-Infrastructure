// scripts/check-services.ts
// Run with: npx tsx scripts/check-services.ts

import 'dotenv/config';
import { Client } from '@elastic/elasticsearch';
import { QdrantClient } from '@qdrant/js-client-rest';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function checkElasticsearch() {
  const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
  console.log(`\n${colors.blue}Checking Elasticsearch at ${esUrl}...${colors.reset}`);
  
  try {
    const client = new Client({ node: esUrl, requestTimeout: 5000 });
    
    // Test connection
    const ping = await client.ping();
    if (!ping) {
      throw new Error('Ping failed');
    }
    console.log(`${colors.green}✓ Connection successful${colors.reset}`);
    
    // Get cluster health
    const health = await client.cluster.health();
    console.log(`${colors.green}✓ Cluster status: ${health.status}${colors.reset}`);
    
    // Check if index exists
    const indexExists = await client.indices.exists({ index: 'emails' });
    if (indexExists) {
      const stats = await client.indices.stats({ index: 'emails' });
      const count = stats._all?.primaries?.docs?.count || 0;
      console.log(`${colors.green}✓ Index 'emails' exists with ${count} documents${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Index 'emails' does not exist (will be created)${colors.reset}`);
    }
    
    return true;
  } catch (error: any) {
    console.log(`${colors.red}✗ Elasticsearch check failed${colors.reset}`);
    console.log(`${colors.red}  Error: ${error.message}${colors.reset}`);
    
    if (error.message?.includes('ECONNREFUSED')) {
      console.log(`${colors.yellow}  → Is Elasticsearch running? Try: docker-compose up -d elasticsearch${colors.reset}`);
    }
    
    return false;
  }
}

async function checkQdrant() {
  const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  console.log(`\n${colors.blue}Checking Qdrant at ${qdrantUrl}...${colors.reset}`);
  
  try {
    const client = new QdrantClient({ url: qdrantUrl });
    
    // Get collections
    const collections = await client.getCollections();
    console.log(`${colors.green}✓ Connection successful${colors.reset}`);
    console.log(`${colors.green}✓ Found ${collections.collections.length} collections${colors.reset}`);
    
    const contextCollection = collections.collections.find(c => c.name === 'product_context');
    if (contextCollection) {
      console.log(`${colors.green}✓ Collection 'product_context' exists${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠ Collection 'product_context' does not exist (will be created)${colors.reset}`);
    }
    
    return true;
  } catch (error: any) {
    console.log(`${colors.red}✗ Qdrant check failed${colors.reset}`);
    console.log(`${colors.red}  Error: ${error.message}${colors.reset}`);
    
    if (error.message?.includes('ECONNREFUSED')) {
      console.log(`${colors.yellow}  → Is Qdrant running? Try: docker-compose up -d qdrant${colors.reset}`);
    }
    
    return false;
  }
}

async function checkGeminiAPI() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log(`\n${colors.blue}Checking Gemini API...${colors.reset}`);
  
  if (!apiKey) {
    console.log(`${colors.red}✗ GEMINI_API_KEY not set in .env${colors.reset}`);
    return false;
  }
  
  console.log(`${colors.green}✓ API key configured${colors.reset}`);
  
  try {
    // Simple test request
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    
    if (response.ok) {
      console.log(`${colors.green}✓ API key is valid${colors.reset}`);
      return true;
    } else {
      console.log(`${colors.red}✗ API key validation failed: ${response.status}${colors.reset}`);
      return false;
    }
  } catch (error: any) {
    console.log(`${colors.red}✗ Failed to validate API key${colors.reset}`);
    console.log(`${colors.red}  Error: ${error.message}${colors.reset}`);
    return false;
  }
}

async function checkIMAPConfig() {
  console.log(`\n${colors.blue}Checking IMAP Configuration...${colors.reset}`);
  
  const account1 = process.env.EMAIL_ACCOUNT_1;
  const password1 = process.env.EMAIL_PASSWORD_1;
  const account2 = process.env.EMAIL_ACCOUNT_2;
  const password2 = process.env.EMAIL_PASSWORD_2;
  
  let hasErrors = false;
  
  if (!account1 || !password1) {
    console.log(`${colors.red}✗ EMAIL_ACCOUNT_1 or EMAIL_PASSWORD_1 not set${colors.reset}`);
    hasErrors = true;
  } else {
    console.log(`${colors.green}✓ Account 1: ${account1}${colors.reset}`);
  }
  
  if (!account2 || !password2) {
    console.log(`${colors.red}✗ EMAIL_ACCOUNT_2 or EMAIL_PASSWORD_2 not set${colors.reset}`);
    hasErrors = true;
  } else {
    console.log(`${colors.green}✓ Account 2: ${account2}${colors.reset}`);
  }
  
  return !hasErrors;
}

async function checkWebhooks() {
  console.log(`\n${colors.blue}Checking Webhook Configuration...${colors.reset}`);
  
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  const genericUrl = process.env.WEBHOOK_SITE_URL;
  
  if (slackUrl) {
    console.log(`${colors.green}✓ Slack webhook configured${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ Slack webhook not configured (optional)${colors.reset}`);
  }
  
  if (genericUrl) {
    console.log(`${colors.green}✓ Generic webhook configured${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠ Generic webhook not configured (optional)${colors.reset}`);
  }
  
  return true;
}

async function main() {
  console.log(`
${colors.blue}╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🔍 AI Email Infrastructure Service Diagnostic Check ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝${colors.reset}
  `);
  
  const results = {
    elasticsearch: await checkElasticsearch(),
    qdrant: await checkQdrant(),
    gemini: await checkGeminiAPI(),
    imap: await checkIMAPConfig(),
    webhooks: await checkWebhooks()
  };
  
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Summary:${colors.reset}`);
  console.log(`  Elasticsearch: ${results.elasticsearch ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`  Qdrant:        ${results.qdrant ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`  Gemini API:    ${results.gemini ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`  IMAP Config:   ${results.imap ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`  Webhooks:      ${results.webhooks ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  
  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    console.log(`\n${colors.green}✓ All checks passed! You're ready to start the server.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}✗ Some checks failed. Please fix the issues above.${colors.reset}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
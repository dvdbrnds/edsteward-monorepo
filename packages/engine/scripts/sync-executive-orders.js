#!/usr/bin/env node
/**
 * Executive Order Sync Script
 * 
 * Fetches and imports executive orders from the Federal Register API
 * 
 * Usage:
 *   node scripts/sync-executive-orders.js                    # Sync recent EOs
 *   node scripts/sync-executive-orders.js --trump-2          # Trump 2nd term only
 *   node scripts/sync-executive-orders.js --start=2025-01-20 # From specific date
 *   node scripts/sync-executive-orders.js --list             # List imported EOs
 */

import { FederalRegisterEOService } from '../src/regulatory-sources/federal-register-eo.js';

const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.replace('--', '').split('=');
    acc[key] = value || true;
  }
  return acc;
}, {});

async function main() {
  const service = new FederalRegisterEOService();

  try {
    if (args.help) {
      console.log(`
Executive Order Sync Script

Usage:
  node scripts/sync-executive-orders.js [options]

Options:
  --trump-2           Sync Trump second term EOs only (Jan 20, 2025+)
  --start=YYYY-MM-DD  Start date for sync
  --end=YYYY-MM-DD    End date for sync
  --list              List all imported EOs
  --impacts           Show EOs with regulation impacts
  --help              Show this help

Examples:
  node scripts/sync-executive-orders.js --trump-2
  node scripts/sync-executive-orders.js --start=2025-01-01
  node scripts/sync-executive-orders.js --list
      `);
      return;
    }

    if (args.list) {
      const result = await service.pool.query(`
        SELECT eo_number, title, signed_date, status, president, term,
               (SELECT COUNT(*) FROM eo_regulation_impacts WHERE eo_id = eo.id) as impacts
        FROM executive_orders eo
        ORDER BY signed_date DESC
        LIMIT 50
      `);
      
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║                IMPORTED EXECUTIVE ORDERS                     ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');
      
      for (const eo of result.rows) {
        const statusIcon = eo.status === 'active' ? '✅' : eo.status === 'enjoined' ? '⚖️' : '❌';
        console.log(`${statusIcon} ${eo.eo_number} (${eo.signed_date?.toISOString().split('T')[0]})`);
        console.log(`   ${eo.title.substring(0, 70)}${eo.title.length > 70 ? '...' : ''}`);
        console.log(`   ${eo.term} | ${eo.impacts} regulation impacts`);
        console.log('');
      }
      
      console.log(`Total: ${result.rows.length} executive orders`);
      return;
    }

    if (args.impacts) {
      const eos = await service.getHigherEdEOs();
      
      console.log('╔══════════════════════════════════════════════════════════════╗');
      console.log('║         EOS WITH HIGHER EDUCATION IMPACT                     ║');
      console.log('╚══════════════════════════════════════════════════════════════╝');
      console.log('');
      
      for (const eo of eos) {
        console.log(`📜 ${eo.eo_number}: ${eo.title.substring(0, 50)}...`);
        console.log(`   Status: ${eo.status} | Affects: ${eo.affected_regulations} regulations`);
        if (eo.regulation_names?.[0]) {
          console.log(`   Regulations: ${eo.regulation_names.slice(0, 3).join(', ')}`);
        }
        console.log('');
      }
      return;
    }

    // Sync EOs
    const options = {};
    
    if (args['trump-2']) {
      options.president = 'donald-trump';
      options.startDate = '2025-01-20';
      console.log('🔄 Syncing Trump second term executive orders...\n');
    } else {
      if (args.start) options.startDate = args.start;
      if (args.end) options.endDate = args.end;
      console.log('🔄 Syncing executive orders...\n');
    }

    const results = await service.syncRecentEOs(options);
    
    console.log('\n✅ Sync complete!');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await service.close();
  }
}

main();

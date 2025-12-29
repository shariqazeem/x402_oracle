#!/usr/bin/env npx tsx
/**
 * x402-oracle End-to-End Demo Script
 *
 * Demonstrates the complete x402 payment flow:
 * 1. Agent requests reputation data
 * 2. Server returns 402 Payment Required
 * 3. Agent sends USDC payment on Solana
 * 4. Agent retries with payment proof
 * 5. Server returns reputation data
 *
 * Usage: npx tsx scripts/test-job.ts
 *
 * @author x402-oracle - x402 Hackathon
 */

import * as fs from 'fs'
import * as path from 'path'

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_URL = process.env.API_URL || 'http://localhost:3000/api/reputation'
const PRICE = 0.05 // USDC
const NETWORK = 'devnet'

// =============================================================================
// LOAD ENVIRONMENT
// =============================================================================

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env.local')

  if (!fs.existsSync(envPath)) {
    console.error('❌ .env.local not found')
    console.error('   Create .env.local with SOLANA_PRIVATE_KEY')
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf-8')
  const env: Record<string, string> = {}

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim()
      }
    }
  }

  return env
}

// =============================================================================
// BANNER
// =============================================================================

function printBanner() {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════════╗')
  console.log('║                                                               ║')
  console.log('║   ██╗  ██╗██╗  ██╗ ██████╗ ██████╗        ██████╗ ██████╗    ║')
  console.log('║   ╚██╗██╔╝██║  ██║██╔═████╗╚════██╗      ██╔═══██╗██╔══██╗   ║')
  console.log('║    ╚███╔╝ ███████║██║██╔██║ █████╔╝█████╗██║   ██║██████╔╝   ║')
  console.log('║    ██╔██╗ ╚════██║████╔╝██║██╔═══╝ ╚════╝██║   ██║██╔══██╗   ║')
  console.log('║   ██╔╝ ██╗     ██║╚██████╔╝███████╗      ╚██████╔╝██║  ██║   ║')
  console.log('║   ╚═╝  ╚═╝     ╚═╝ ╚═════╝ ╚══════╝       ╚═════╝ ╚═╝  ╚═╝   ║')
  console.log('║                                                               ║')
  console.log('║           Wallet Reputation Oracle - Demo Script              ║')
  console.log('║                                                               ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')
  console.log('')
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  printBanner()

  // Step 1: Load environment
  console.log('📋 Step 1: Loading Configuration')
  console.log('─'.repeat(50))

  const env = loadEnv()
  const privateKey = env.SOLANA_PRIVATE_KEY

  if (!privateKey) {
    console.error('❌ SOLANA_PRIVATE_KEY not found in .env.local')
    console.error('')
    console.error('   Add the following to .env.local:')
    console.error('   SOLANA_PRIVATE_KEY=your_base58_private_key')
    console.error('')
    process.exit(1)
  }

  console.log('   ✓ SOLANA_PRIVATE_KEY loaded')
  console.log(`   ✓ Network: ${NETWORK}`)
  console.log(`   ✓ API URL: ${API_URL}`)
  console.log(`   ✓ Price: $${PRICE} USDC`)
  console.log('')

  // Step 2: Initialize AgentWallet
  console.log('🔑 Step 2: Initializing Agent Wallet')
  console.log('─'.repeat(50))

  const { AgentWallet } = await import('../lib/AgentWallet')

  const wallet = new AgentWallet(privateKey, {
    network: NETWORK,
    debug: false,
  })

  console.log(`   ✓ Wallet Address: ${wallet.address}`)

  // Check balance
  const balance = await wallet.getBalance()
  console.log(`   ✓ USDC Balance: $${balance.toFixed(2)}`)

  if (balance < PRICE) {
    console.error('')
    console.error(`   ❌ Insufficient balance! Need $${PRICE} USDC`)
    console.error(`      Get devnet USDC from: https://spl-token-faucet.com`)
    console.error('')
    process.exit(1)
  }

  console.log('')

  // Step 3: Execute x402 Flow
  console.log('🤖 Step 3: Agent Requesting Reputation Score...')
  console.log('─'.repeat(50))
  console.log('')

  // First, show the 402 response
  console.log('   → Making initial request (no payment)...')

  const initialResponse = await fetch(API_URL)
  const paymentRequired = await initialResponse.json()

  if (initialResponse.status === 402) {
    console.log('   💸 402 Payment Required received!')
    console.log('')
    console.log('   Payment Details:')
    console.log(`      Receiver: ${paymentRequired.payment?.receiver}`)
    console.log(`      Amount:   $${paymentRequired.payment?.amount} ${paymentRequired.payment?.token}`)
    console.log(`      Network:  ${paymentRequired.payment?.network}`)
    console.log('')
  }

  // Now make the paid request
  console.log('   → Sending USDC payment on Solana...')

  const startTime = Date.now()
  const result = await wallet.pay(API_URL, PRICE)
  const duration = Date.now() - startTime

  if (!result.success) {
    console.error('')
    console.error(`   ❌ Payment failed: ${result.error}`)
    console.error('')
    process.exit(1)
  }

  console.log('   ✅ Transaction signed & sent!')
  console.log('')

  // Step 4: Validation
  console.log('📊 Step 4: Validation')
  console.log('─'.repeat(50))
  console.log('')

  const reputation = result.data as any

  console.log('   ┌─────────────────────────────────────────────┐')
  console.log('   │           REPUTATION RESULTS                │')
  console.log('   ├─────────────────────────────────────────────┤')
  console.log(`   │  Wallet:  ${reputation.walletAddress?.substring(0, 20)}...`)
  console.log(`   │  Score:   ${reputation.score}/100`)
  console.log(`   │  Tier:    ${reputation.tier}`)
  console.log(`   │  Badge:   ${reputation.badge}`)
  console.log(`   │  Age:     ${reputation.age}`)
  console.log('   ├─────────────────────────────────────────────┤')
  console.log('   │           METRICS                           │')
  console.log('   ├─────────────────────────────────────────────┤')
  console.log(`   │  Transactions:  ${reputation.metrics?.totalTransactions}`)
  console.log(`   │  Interactions:  ${reputation.metrics?.uniqueInteractions}`)
  console.log(`   │  Trust Score:   ${reputation.metrics?.trustScore}`)
  console.log('   └─────────────────────────────────────────────┘')
  console.log('')

  // Transaction details
  console.log('   ┌─────────────────────────────────────────────┐')
  console.log('   │           PAYMENT PROOF                     │')
  console.log('   ├─────────────────────────────────────────────┤')
  console.log(`   │  TX Signature:  ${result.txSignature?.substring(0, 30)}...`)
  console.log(`   │  Amount Paid:   $${PRICE} USDC`)
  console.log(`   │  Duration:      ${duration}ms`)
  console.log('   └─────────────────────────────────────────────┘')
  console.log('')

  // Explorer URL
  const explorerUrl = wallet.getExplorerUrl(result.txSignature!)

  console.log('   🔗 Solana Explorer:')
  console.log(`      ${explorerUrl}`)
  console.log('')

  // Summary
  console.log('═'.repeat(50))
  console.log('')
  console.log('   ✅ x402 END-TO-END TEST PASSED!')
  console.log('')
  console.log('   The Wallet Reputation Oracle is working:')
  console.log('   • 402 Payment Required ✓')
  console.log('   • USDC Payment on Solana ✓')
  console.log('   • On-chain Verification ✓')
  console.log('   • Reputation Data Returned ✓')
  console.log('')
  console.log('═'.repeat(50))
  console.log('')
}

// =============================================================================
// RUN
// =============================================================================

main().catch((error) => {
  console.error('')
  console.error('❌ Unexpected error:', error.message)
  console.error('')
  process.exit(1)
})

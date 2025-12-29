/**
 * Wallet Reputation API - x402 Payment Protected
 *
 * This endpoint implements the x402 Server Standard for the Wallet Reputation service.
 * It requires a valid Solana USDC payment before returning reputation data.
 *
 * x402 Flow:
 * 1. Client sends request without payment -> Returns 402 Payment Required
 * 2. Client makes USDC payment on Solana
 * 3. Client retries with `Authorization: <tx-signature>` header
 * 4. Server verifies payment on-chain
 * 5. Server returns reputation data
 *
 * @author x402-oracle - x402 Hackathon
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyPayment, PaymentVerification } from '@/lib/verify-payment'

// =============================================================================
// CONFIGURATION
// =============================================================================

// Receiver wallet address - replace with your actual wallet
const RECEIVER_WALLET = process.env.REPUTATION_RECEIVER_WALLET
  || process.env.SOLANA_WALLET_ADDRESS
  || 'GiDRjzYbFvzBxyhkCjrYj9kPHti9Gz3rYKtNmKwPiqEA'

// Price in USDC
const PRICE_USDC = 0.05

// Network configuration
const NETWORK = (process.env.X402_NETWORK?.replace('solana-', '') || 'devnet') as 'devnet' | 'mainnet-beta'

// =============================================================================
// TYPES
// =============================================================================

interface PaymentRequiredResponse {
  status: 402
  message: string
  payment: {
    receiver: string
    amount: number
    token: string
    network: string
    instructions: string
  }
}

interface ReputationData {
  walletAddress: string
  score: number
  badge: string
  tier: string
  age: string
  metrics: {
    totalTransactions: number
    uniqueInteractions: number
    avgTransactionValue: number
    trustScore: number
  }
  badges: string[]
  lastUpdated: string
  paymentVerification: {
    txSignature: string
    paidAmount: number
    verifiedAt: string
  }
}

// =============================================================================
// MOCK REPUTATION LOGIC
// =============================================================================

/**
 * Generate mock reputation data for a wallet
 * In production, this would query on-chain data, analyze transaction history, etc.
 */
function generateReputationData(
  walletAddress: string,
  paymentVerification: PaymentVerification
): ReputationData {
  // Mock scoring logic - generates consistent scores based on wallet address
  const addressHash = walletAddress.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

  const score = 50 + (addressHash % 50) // Score between 50-99
  const tier = score >= 90 ? 'Platinum' : score >= 75 ? 'Gold' : score >= 60 ? 'Silver' : 'Bronze'

  const badges = [
    'Diamond Hands',
    'Early Adopter',
    'DeFi Degen',
    'NFT Collector',
    'DAO Voter',
    'Staking Pro',
    'Bridge Builder',
    'Airdrop Hunter',
  ]

  // Select badges based on wallet address for consistency
  const selectedBadges = badges.filter((_, i) => (addressHash + i) % 3 === 0)

  const ageOptions = ['< 1 month', '1-3 months', '3-6 months', '6-12 months', '1-2 years', '2+ years']
  const age = ageOptions[addressHash % ageOptions.length]

  const mainBadge = selectedBadges[0] || 'Newcomer'

  return {
    walletAddress,
    score,
    badge: mainBadge,
    tier,
    age,
    metrics: {
      totalTransactions: 100 + (addressHash % 5000),
      uniqueInteractions: 10 + (addressHash % 200),
      avgTransactionValue: parseFloat((0.1 + (addressHash % 100) / 10).toFixed(2)),
      trustScore: parseFloat((0.5 + (addressHash % 50) / 100).toFixed(2)),
    },
    badges: selectedBadges,
    lastUpdated: new Date().toISOString(),
    paymentVerification: {
      txSignature: paymentVerification.sender ? `Verified from ${paymentVerification.sender}` : 'Verified',
      paidAmount: paymentVerification.amount || PRICE_USDC,
      verifiedAt: new Date().toISOString(),
    },
  }
}

// =============================================================================
// 402 PAYMENT REQUIRED RESPONSE
// =============================================================================

function createPaymentRequiredResponse(): NextResponse<PaymentRequiredResponse> {
  const response: PaymentRequiredResponse = {
    status: 402,
    message: 'Payment Required - Send USDC to access wallet reputation data',
    payment: {
      receiver: RECEIVER_WALLET,
      amount: PRICE_USDC,
      token: 'USDC',
      network: NETWORK === 'devnet' ? 'Solana Devnet' : 'Solana Mainnet',
      instructions: `Send ${PRICE_USDC} USDC to ${RECEIVER_WALLET} on Solana ${NETWORK}. Include the transaction signature in the Authorization header.`,
    },
  }

  return NextResponse.json(response, {
    status: 402,
    headers: {
      'X-Payment-Required': 'true',
      'X-Payment-Receiver': RECEIVER_WALLET,
      'X-Payment-Amount': PRICE_USDC.toString(),
      'X-Payment-Token': 'USDC',
      'X-Payment-Network': NETWORK,
    },
  })
}

// =============================================================================
// API HANDLERS
// =============================================================================

/**
 * GET /api/reputation
 *
 * Query wallet reputation data. Requires x402 payment.
 *
 * Query params:
 * - wallet: The wallet address to query (optional, defaults to payer wallet)
 *
 * Headers:
 * - Authorization: <solana-tx-signature> - Required payment proof
 */
export async function GET(request: NextRequest) {
  console.log('\n=== [REPUTATION API] GET Request ===')

  // Extract authorization header
  const authHeader = request.headers.get('authorization')

  // No payment signature provided -> Return 402
  if (!authHeader) {
    console.log('  No Authorization header - returning 402')
    return createPaymentRequiredResponse()
  }

  // Extract signature (support "Bearer <sig>" or just "<sig>")
  const signature = authHeader.replace(/^bearer\s+/i, '').trim()

  if (!signature || signature.length < 80) {
    console.log('  Invalid signature format')
    return NextResponse.json(
      { error: 'Invalid authorization format. Expected Solana transaction signature.' },
      { status: 400 }
    )
  }

  console.log(`  Signature: ${signature.substring(0, 20)}...`)

  // Verify payment on-chain
  console.log('  Verifying payment on-chain...')
  const verification = await verifyPayment(
    signature,
    PRICE_USDC,
    RECEIVER_WALLET,
    NETWORK
  )

  if (!verification.valid) {
    console.log(`  Payment verification failed: ${verification.error}`)
    return NextResponse.json(
      {
        error: 'Payment verification failed',
        details: verification.error,
        required: {
          receiver: RECEIVER_WALLET,
          amount: PRICE_USDC,
          token: 'USDC',
          network: NETWORK,
        },
      },
      { status: 402 }
    )
  }

  console.log('  Payment verified!')
  console.log(`    Sender: ${verification.sender}`)
  console.log(`    Amount: ${verification.amount} USDC`)

  // Get wallet to query (from query params or use payer wallet)
  const searchParams = request.nextUrl.searchParams
  const queryWallet = searchParams.get('wallet') || verification.sender

  if (!queryWallet) {
    return NextResponse.json(
      { error: 'No wallet address provided and could not determine payer wallet' },
      { status: 400 }
    )
  }

  // Generate reputation data
  const reputationData = generateReputationData(queryWallet, verification)

  console.log(`  Returning reputation for: ${queryWallet}`)
  console.log(`    Score: ${reputationData.score}`)
  console.log(`    Tier: ${reputationData.tier}`)

  return NextResponse.json(reputationData, {
    status: 200,
    headers: {
      'X-Payment-Verified': 'true',
      'X-Payment-Signature': signature,
    },
  })
}

/**
 * POST /api/reputation
 *
 * Same as GET but accepts wallet in request body.
 *
 * Body:
 * - wallet: The wallet address to query
 *
 * Headers:
 * - Authorization: <solana-tx-signature> - Required payment proof
 */
export async function POST(request: NextRequest) {
  console.log('\n=== [REPUTATION API] POST Request ===')

  // Extract authorization header
  const authHeader = request.headers.get('authorization')

  // No payment signature provided -> Return 402
  if (!authHeader) {
    console.log('  No Authorization header - returning 402')
    return createPaymentRequiredResponse()
  }

  // Extract signature
  const signature = authHeader.replace(/^bearer\s+/i, '').trim()

  if (!signature || signature.length < 80) {
    console.log('  Invalid signature format')
    return NextResponse.json(
      { error: 'Invalid authorization format. Expected Solana transaction signature.' },
      { status: 400 }
    )
  }

  console.log(`  Signature: ${signature.substring(0, 20)}...`)

  // Verify payment on-chain
  console.log('  Verifying payment on-chain...')
  const verification = await verifyPayment(
    signature,
    PRICE_USDC,
    RECEIVER_WALLET,
    NETWORK
  )

  if (!verification.valid) {
    console.log(`  Payment verification failed: ${verification.error}`)
    return NextResponse.json(
      {
        error: 'Payment verification failed',
        details: verification.error,
        required: {
          receiver: RECEIVER_WALLET,
          amount: PRICE_USDC,
          token: 'USDC',
          network: NETWORK,
        },
      },
      { status: 402 }
    )
  }

  console.log('  Payment verified!')

  // Parse body for wallet address
  let queryWallet: string | undefined

  try {
    const body = await request.json()
    queryWallet = body.wallet || verification.sender
  } catch {
    queryWallet = verification.sender
  }

  if (!queryWallet) {
    return NextResponse.json(
      { error: 'No wallet address provided' },
      { status: 400 }
    )
  }

  // Generate reputation data
  const reputationData = generateReputationData(queryWallet, verification)

  console.log(`  Returning reputation for: ${queryWallet}`)

  return NextResponse.json(reputationData, {
    status: 200,
    headers: {
      'X-Payment-Verified': 'true',
      'X-Payment-Signature': signature,
    },
  })
}

/**
 * OPTIONS /api/reputation
 *
 * Returns API documentation and payment requirements
 */
export async function OPTIONS() {
  return NextResponse.json({
    endpoint: '/api/reputation',
    description: 'Wallet Reputation API with x402 Solana micropayments',
    version: '1.0.0',
    payment: {
      required: true,
      receiver: RECEIVER_WALLET,
      amount: PRICE_USDC,
      token: 'USDC',
      network: NETWORK,
      protocol: 'x402',
    },
    methods: {
      GET: {
        description: 'Get wallet reputation data',
        headers: {
          'Authorization': 'Solana transaction signature (required)',
        },
        queryParams: {
          wallet: 'Wallet address to query (optional, defaults to payer)',
        },
      },
      POST: {
        description: 'Get wallet reputation data',
        headers: {
          'Authorization': 'Solana transaction signature (required)',
        },
        body: {
          wallet: 'Wallet address to query (optional)',
        },
      },
    },
    response: {
      score: 'Reputation score (0-100)',
      badge: 'Primary badge earned',
      tier: 'Reputation tier (Bronze/Silver/Gold/Platinum)',
      age: 'Wallet age estimation',
      metrics: 'Detailed reputation metrics',
      badges: 'List of earned badges',
    },
    example: {
      curl: `curl -H "Authorization: <tx-signature>" "${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/reputation?wallet=<wallet-address>"`,
    },
  })
}

/**
 * On-Chain Payment Verification for x402 Protocol
 *
 * Verifies that a Solana transaction signature represents a valid
 * USDC payment to the specified receiver address.
 */

import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
} from '@solana/web3.js'

export interface PaymentVerification {
  valid: boolean
  error?: string
  sender?: string
  receiver?: string
  amount?: number
  timestamp?: number
  slot?: number
}

// USDC mint addresses by network
const USDC_MINTS: Record<string, string> = {
  'devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}

// Maximum age for a transaction to be considered valid (in seconds)
// Prevents replay attacks by rejecting old transactions
const MAX_TX_AGE_SECONDS = 300 // 5 minutes

// Cache of used signatures to prevent replay attacks within session
const usedSignatures = new Set<string>()

/**
 * Verify a Solana payment transaction
 *
 * @param signature - The transaction signature to verify
 * @param expectedAmount - Expected USDC amount (e.g., 0.05 for $0.05)
 * @param expectedReceiver - The wallet address that should receive the payment
 * @param network - 'devnet' or 'mainnet-beta'
 * @returns Verification result with payment details
 */
export async function verifyPayment(
  signature: string,
  expectedAmount: number,
  expectedReceiver: string,
  network: 'devnet' | 'mainnet-beta' = 'devnet'
): Promise<PaymentVerification> {
  // Check for replay attack (signature already used)
  if (usedSignatures.has(signature)) {
    return {
      valid: false,
      error: 'Transaction signature already used (replay attack prevented)',
    }
  }

  const rpcUrl = network === 'devnet'
    ? process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'
    : process.env.SOLANA_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com'

  const connection = new Connection(rpcUrl, 'confirmed')
  const usdcMint = USDC_MINTS[network]

  if (!usdcMint) {
    return {
      valid: false,
      error: `Unknown network: ${network}`,
    }
  }

  try {
    // Fetch the parsed transaction
    const tx = await connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })

    if (!tx) {
      return {
        valid: false,
        error: 'Transaction not found',
      }
    }

    if (tx.meta?.err) {
      return {
        valid: false,
        error: `Transaction failed: ${JSON.stringify(tx.meta.err)}`,
      }
    }

    // Check transaction age to prevent replay attacks
    const txTimestamp = tx.blockTime
    if (txTimestamp) {
      const now = Math.floor(Date.now() / 1000)
      const age = now - txTimestamp

      if (age > MAX_TX_AGE_SECONDS) {
        return {
          valid: false,
          error: `Transaction too old (${age}s > ${MAX_TX_AGE_SECONDS}s max)`,
          timestamp: txTimestamp,
        }
      }

      // Also reject transactions from the future (clock skew protection)
      if (age < -60) {
        return {
          valid: false,
          error: 'Transaction timestamp is in the future',
          timestamp: txTimestamp,
        }
      }
    }

    // Find USDC transfer instruction
    const transferResult = findUSDCTransfer(tx, usdcMint, expectedReceiver)

    if (!transferResult.found) {
      return {
        valid: false,
        error: transferResult.error || 'No valid USDC transfer found',
      }
    }

    // Verify amount (USDC has 6 decimals)
    const expectedAmountRaw = expectedAmount * 1_000_000
    const tolerance = 1000 // Allow 0.001 USDC tolerance for rounding

    if (Math.abs(transferResult.amount! - expectedAmountRaw) > tolerance) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmount} USDC, got ${transferResult.amount! / 1_000_000} USDC`,
        amount: transferResult.amount! / 1_000_000,
      }
    }

    // Mark signature as used to prevent replay
    usedSignatures.add(signature)

    // Clean up old signatures periodically (keep last 10000)
    if (usedSignatures.size > 10000) {
      const entries = Array.from(usedSignatures)
      entries.slice(0, 5000).forEach(sig => usedSignatures.delete(sig))
    }

    return {
      valid: true,
      sender: transferResult.sender,
      receiver: transferResult.receiver,
      amount: transferResult.amount! / 1_000_000,
      timestamp: txTimestamp ?? undefined,
      slot: tx.slot,
    }
  } catch (error) {
    return {
      valid: false,
      error: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

interface TransferSearchResult {
  found: boolean
  error?: string
  sender?: string
  receiver?: string
  amount?: number
}

/**
 * Find a USDC transfer in the parsed transaction
 */
function findUSDCTransfer(
  tx: ParsedTransactionWithMeta,
  usdcMint: string,
  expectedReceiver: string
): TransferSearchResult {
  const instructions = tx.transaction.message.instructions

  for (const ix of instructions) {
    // Check for parsed SPL Token instructions
    if ('parsed' in ix && ix.program === 'spl-token') {
      const parsed = ix.parsed

      // Handle different transfer instruction types
      if (parsed.type === 'transfer' || parsed.type === 'transferChecked') {
        const info = parsed.info

        // For transferChecked, the mint is directly available
        if (parsed.type === 'transferChecked') {
          if (info.mint !== usdcMint) {
            continue // Wrong token
          }
        }

        // Get destination - need to resolve token account to owner
        const destination = info.destination

        // Check if this is a transfer to the expected receiver
        // The destination might be a token account, so we need to check pre/post token balances
        const preBalances = tx.meta?.preTokenBalances || []
        const postBalances = tx.meta?.postTokenBalances || []

        // Find the receiver's token account
        for (const post of postBalances) {
          if (post.mint === usdcMint && post.owner === expectedReceiver) {
            // Found a balance change for the expected receiver
            const pre = preBalances.find(
              p => p.accountIndex === post.accountIndex
            )

            const preAmount = pre?.uiTokenAmount?.amount
              ? BigInt(pre.uiTokenAmount.amount)
              : BigInt(0)
            const postAmount = BigInt(post.uiTokenAmount.amount)
            const delta = postAmount - preAmount

            if (delta > 0) {
              // Find the sender from pre-balances
              let sender: string | undefined
              for (const preB of preBalances) {
                if (preB.mint === usdcMint && preB.owner !== expectedReceiver) {
                  const postB = postBalances.find(
                    p => p.accountIndex === preB.accountIndex
                  )
                  const senderPre = BigInt(preB.uiTokenAmount.amount)
                  const senderPost = postB
                    ? BigInt(postB.uiTokenAmount.amount)
                    : BigInt(0)

                  if (senderPre - senderPost === delta) {
                    sender = preB.owner ?? undefined
                    break
                  }
                }
              }

              return {
                found: true,
                sender,
                receiver: expectedReceiver,
                amount: Number(delta),
              }
            }
          }
        }
      }
    }
  }

  // Fallback: Check token balance changes directly
  const preBalances = tx.meta?.preTokenBalances || []
  const postBalances = tx.meta?.postTokenBalances || []

  for (const post of postBalances) {
    if (post.mint === usdcMint && post.owner === expectedReceiver) {
      const pre = preBalances.find(p => p.accountIndex === post.accountIndex)

      const preAmount = pre?.uiTokenAmount?.amount
        ? BigInt(pre.uiTokenAmount.amount)
        : BigInt(0)
      const postAmount = BigInt(post.uiTokenAmount.amount)
      const delta = postAmount - preAmount

      if (delta > 0) {
        // Find sender
        let sender: string | undefined
        for (const preB of preBalances) {
          if (preB.mint === usdcMint && preB.owner !== expectedReceiver) {
            const postB = postBalances.find(
              p => p.accountIndex === preB.accountIndex
            )
            const senderPre = BigInt(preB.uiTokenAmount.amount)
            const senderPost = postB
              ? BigInt(postB.uiTokenAmount.amount)
              : BigInt(0)

            if (senderPre - senderPost === delta) {
              sender = preB.owner ?? undefined
              break
            }
          }
        }

        return {
          found: true,
          sender,
          receiver: expectedReceiver,
          amount: Number(delta),
        }
      }
    }
  }

  return {
    found: false,
    error: `No USDC transfer to ${expectedReceiver} found in transaction`,
  }
}

/**
 * Clear the used signatures cache (useful for testing)
 */
export function clearUsedSignatures(): void {
  usedSignatures.clear()
}

/**
 * Check if a signature has been used
 */
export function isSignatureUsed(signature: string): boolean {
  return usedSignatures.has(signature)
}

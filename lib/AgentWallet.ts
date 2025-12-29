/**
 * AgentWallet - Standalone x402 Payment Client for Solana
 *
 * A lightweight client that enables autonomous agents to pay for
 * x402-protected resources using a Solana keypair.
 *
 * This implementation uses only @solana/web3.js and @solana/spl-token
 * for maximum compatibility and minimal dependencies.
 *
 * @example
 * ```typescript
 * const wallet = new AgentWallet(process.env.SOLANA_PRIVATE_KEY!)
 * const response = await wallet.pay('https://api.example.com/reputation', 0.05)
 * console.log(response.data)
 * ```
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import bs58 from 'bs58'

// USDC mint addresses by network
const USDC_MINTS: Record<string, string> = {
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}

export interface AgentWalletConfig {
  /** Solana network: 'devnet' or 'mainnet-beta' */
  network?: 'devnet' | 'mainnet-beta'
  /** Custom RPC endpoint URL */
  rpcUrl?: string
  /** Enable debug logging */
  debug?: boolean
}

export interface PaymentResponse<T = unknown> {
  /** Whether the payment and request succeeded */
  success: boolean
  /** Response data from the server */
  data?: T
  /** Error message if failed */
  error?: string
  /** Solana transaction signature */
  txSignature?: string
  /** HTTP status code */
  status: number
}

interface PaymentRequirements {
  receiver: string
  amount: number
  token: string
  network: string
}

/**
 * AgentWallet handles x402 micropayments for AI agents.
 *
 * Flow:
 * 1. Make initial request to get 402 + payment requirements
 * 2. Send USDC payment on Solana
 * 3. Retry request with transaction signature in Authorization header
 */
export class AgentWallet {
  private keypair: Keypair
  private connection: Connection
  private network: 'devnet' | 'mainnet-beta'
  private debug: boolean

  /**
   * Create a new AgentWallet instance
   *
   * @param privateKey - Base58-encoded Solana private key
   * @param config - Optional configuration
   */
  constructor(privateKey: string, config: AgentWalletConfig = {}) {
    this.network = config.network ?? 'devnet'
    this.debug = config.debug ?? false

    // Decode private key
    const secretKey = bs58.decode(privateKey)
    this.keypair = Keypair.fromSecretKey(secretKey)

    // Create connection
    const rpcUrl =
      config.rpcUrl ??
      (this.network === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com')

    this.connection = new Connection(rpcUrl, 'confirmed')

    if (this.debug) {
      console.log(`[AgentWallet] Initialized`)
      console.log(`  Address: ${this.address}`)
      console.log(`  Network: ${this.network}`)
    }
  }

  /**
   * Get the wallet's public key
   */
  get publicKey(): PublicKey {
    return this.keypair.publicKey
  }

  /**
   * Get the wallet's address as a base58 string
   */
  get address(): string {
    return this.keypair.publicKey.toBase58()
  }

  /**
   * Make a paid request to a URL
   *
   * Automatically handles the HTTP 402 payment flow:
   * 1. Makes initial request to get payment requirements
   * 2. Sends USDC payment on Solana
   * 3. Retries request with tx signature as Authorization header
   *
   * @param url - The URL to request
   * @param maxAmount - Maximum amount willing to pay in USD
   * @param options - Additional fetch options (method, headers, body)
   * @returns Payment response with data or error
   */
  async pay<T = unknown>(
    url: string,
    maxAmount: number,
    options: RequestInit = {}
  ): Promise<PaymentResponse<T>> {
    if (this.debug) {
      console.log(`[AgentWallet] Requesting: ${url}`)
    }

    try {
      // Step 1: Make initial request to get payment requirements
      const initialResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      // If not 402, return the response directly
      if (initialResponse.status !== 402) {
        const data = await this.parseResponse<T>(initialResponse)
        return {
          success: initialResponse.ok,
          data,
          status: initialResponse.status,
          error: initialResponse.ok ? undefined : `HTTP ${initialResponse.status}`,
        }
      }

      // Step 2: Parse 402 response for payment requirements
      const paymentInfo = await initialResponse.json()
      const requirements = this.parsePaymentRequirements(paymentInfo)

      if (this.debug) {
        console.log(`[AgentWallet] Payment required:`)
        console.log(`  Receiver: ${requirements.receiver}`)
        console.log(`  Amount: ${requirements.amount} ${requirements.token}`)
      }

      // Check if amount exceeds maximum
      if (requirements.amount > maxAmount) {
        return {
          success: false,
          error: `Payment amount $${requirements.amount} exceeds maximum $${maxAmount}`,
          status: 402,
        }
      }

      // Step 3: Send USDC payment
      const txSignature = await this.sendUSDCPayment(
        requirements.receiver,
        requirements.amount
      )

      if (this.debug) {
        console.log(`[AgentWallet] Payment sent: ${txSignature}`)
      }

      // Step 4: Retry request with payment proof
      const paidResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: txSignature,
          ...options.headers,
        },
      })

      const data = await this.parseResponse<T>(paidResponse)

      if (this.debug && paidResponse.ok) {
        console.log(`[AgentWallet] Request successful!`)
      }

      return {
        success: paidResponse.ok,
        data,
        txSignature,
        status: paidResponse.status,
        error: paidResponse.ok ? undefined : `HTTP ${paidResponse.status}`,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'

      if (this.debug) {
        console.error(`[AgentWallet] Error: ${message}`)
      }

      return {
        success: false,
        error: message,
        status: 0,
      }
    }
  }

  /**
   * Send USDC payment to a receiver
   */
  private async sendUSDCPayment(
    receiver: string,
    amount: number
  ): Promise<string> {
    const usdcMint = new PublicKey(USDC_MINTS[this.network])
    const receiverPubkey = new PublicKey(receiver)

    // Get token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      this.keypair.publicKey
    )

    const receiverTokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      receiverPubkey
    )

    // Check sender balance
    const senderAccount = await getAccount(this.connection, senderTokenAccount)
    const amountRaw = BigInt(Math.round(amount * 1_000_000)) // USDC has 6 decimals

    if (senderAccount.amount < amountRaw) {
      throw new Error(
        `Insufficient USDC balance. Have: ${Number(senderAccount.amount) / 1_000_000}, Need: ${amount}`
      )
    }

    // Create transfer instruction
    const transferIx = createTransferInstruction(
      senderTokenAccount,
      receiverTokenAccount,
      this.keypair.publicKey,
      amountRaw,
      [],
      TOKEN_PROGRAM_ID
    )

    // Build and send transaction
    const transaction = new Transaction().add(transferIx)

    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.keypair],
      { commitment: 'confirmed' }
    )

    return signature
  }

  /**
   * Parse payment requirements from 402 response
   */
  private parsePaymentRequirements(response: any): PaymentRequirements {
    // Handle various 402 response formats
    const payment = response.payment || response

    return {
      receiver:
        payment.receiver ||
        payment.address ||
        payment.wallet ||
        payment.recipient,
      amount: parseFloat(
        payment.amount?.toString().replace('$', '') ||
          payment.price?.toString().replace('$', '') ||
          '0'
      ),
      token: payment.token || payment.asset || 'USDC',
      network: payment.network || this.network,
    }
  }

  /**
   * Parse response body based on content type
   */
  private async parseResponse<T>(response: Response): Promise<T | undefined> {
    const contentType = response.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      return response.json()
    }

    return response.text() as Promise<T>
  }

  /**
   * Get USDC balance
   */
  async getBalance(): Promise<number> {
    const usdcMint = new PublicKey(USDC_MINTS[this.network])

    const tokenAccount = await getAssociatedTokenAddress(
      usdcMint,
      this.keypair.publicKey
    )

    try {
      const account = await getAccount(this.connection, tokenAccount)
      return Number(account.amount) / 1_000_000
    } catch {
      return 0
    }
  }

  /**
   * Get Solana Explorer URL for a transaction
   */
  getExplorerUrl(txSignature: string): string {
    const cluster = this.network === 'devnet' ? '?cluster=devnet' : ''
    return `https://explorer.solana.com/tx/${txSignature}${cluster}`
  }
}

/**
 * Create an AgentWallet instance (convenience factory)
 */
export function createAgentWallet(
  privateKey: string,
  config?: AgentWalletConfig
): AgentWallet {
  return new AgentWallet(privateKey, config)
}

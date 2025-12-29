'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Terminal, ArrowRight, Copy, Check, Zap, Shield, Clock, Code, FileCode, Braces } from 'lucide-react'

// =============================================================================
// CONFIGURATION
// =============================================================================

const RECEIVER_WALLET = process.env.NEXT_PUBLIC_RECEIVER_WALLET || 'EsWeMEvuLDV2Q4CXigZbETzqXfEQwZntQjwD4Cy8AgY5'
const API_ENDPOINT = '/api/reputation'
const PRICE = '0.05'

// =============================================================================
// CODE SNIPPETS
// =============================================================================

const USAGE_CODE = `import { AgentWallet } from './lib/AgentWallet'

// Initialize with your Solana private key
const wallet = new AgentWallet(process.env.SOLANA_PRIVATE_KEY!)

// The wallet handles the full x402 flow automatically:
// 1. Makes initial request → receives 402
// 2. Parses payment requirements
// 3. Sends USDC on Solana
// 4. Retries with TX signature as proof

const result = await wallet.pay(
  'https://x402-oracle.vercel.app/api/reputation',
  0.05 // Max amount willing to pay
)

if (result.success) {
  console.log(result.data.score)      // 87
  console.log(result.data.tier)       // "Gold"
  console.log(result.data.badge)      // "Diamond Hands"
  console.log(result.txSignature)     // "5UfDuX7rXkzC..."
}`

const AGENT_WALLET_CODE = `import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, createTransferInstruction } from '@solana/spl-token'
import bs58 from 'bs58'

export class AgentWallet {
  private keypair: Keypair
  private connection: Connection

  constructor(privateKey: string, network: 'devnet' | 'mainnet-beta' = 'devnet') {
    this.keypair = Keypair.fromSecretKey(bs58.decode(privateKey))
    this.connection = new Connection(
      network === 'devnet'
        ? 'https://api.devnet.solana.com'
        : 'https://api.mainnet-beta.solana.com'
    )
  }

  get address(): string {
    return this.keypair.publicKey.toBase58()
  }

  async pay<T>(url: string, maxAmount: number): Promise<PaymentResponse<T>> {
    // Step 1: Initial request to get 402 + payment requirements
    const initial = await fetch(url)

    if (initial.status !== 402) {
      return { success: initial.ok, data: await initial.json(), status: initial.status }
    }

    // Step 2: Parse payment requirements
    const { payment } = await initial.json()

    if (payment.amount > maxAmount) {
      throw new Error(\`Amount \${payment.amount} exceeds max \${maxAmount}\`)
    }

    // Step 3: Send USDC payment on Solana
    const txSignature = await this.sendUSDC(payment.receiver, payment.amount)

    // Step 4: Retry with payment proof
    const paid = await fetch(url, {
      headers: { 'Authorization': txSignature }
    })

    return {
      success: paid.ok,
      data: await paid.json(),
      txSignature,
      status: paid.status
    }
  }

  private async sendUSDC(receiver: string, amount: number): Promise<string> {
    const USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')

    const senderATA = await getAssociatedTokenAddress(USDC_MINT, this.keypair.publicKey)
    const receiverATA = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(receiver))

    const tx = new Transaction().add(
      createTransferInstruction(senderATA, receiverATA, this.keypair.publicKey, amount * 1e6)
    )

    return await sendAndConfirmTransaction(this.connection, tx, [this.keypair])
  }
}`

const RESPONSE_CODE = `{
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "score": 87,
  "tier": "Gold",
  "badge": "Diamond Hands",
  "age": "2+ years",
  "metrics": {
    "totalTransactions": 2847,
    "uniqueInteractions": 156,
    "avgTransactionValue": 12.5,
    "trustScore": 0.87
  },
  "badges": [
    "Diamond Hands",
    "Early Adopter",
    "DeFi Degen"
  ],
  "paymentVerification": {
    "txSignature": "5UfDuX7rXkzC...",
    "paidAmount": 0.05,
    "verifiedAt": "2025-01-15T10:30:00Z"
  }
}`

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const stagger = {
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

// =============================================================================
// COMPONENTS
// =============================================================================

function CodeBlock({ children, className = '' }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`relative group ${className}`}>
      <pre className="bg-[#0A0A0A] border border-white/10 rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-white/80 font-mono">{children}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded-md bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4 text-white/40" />
        )}
      </button>
    </div>
  )
}

interface Tab {
  id: string
  label: string
  icon: typeof Code
  code: string
  language: string
}

function TabbedCodeBlock() {
  const tabs: Tab[] = [
    { id: 'usage', label: 'Usage', icon: Code, code: USAGE_CODE, language: 'typescript' },
    { id: 'wallet', label: 'AgentWallet.ts', icon: FileCode, code: AGENT_WALLET_CODE, language: 'typescript' },
    { id: 'response', label: 'Response', icon: Braces, code: RESPONSE_CODE, language: 'json' },
  ]

  const [activeTab, setActiveTab] = useState('usage')
  const [copied, setCopied] = useState(false)

  const currentTab = tabs.find((t) => t.id === activeTab)!

  const handleCopy = () => {
    navigator.clipboard.writeText(currentTab.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div variants={fadeUp} className="w-full">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-white/10 mb-0">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                  isActive ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-px bg-white"
                  />
                )}
              </button>
            )
          })}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-3 py-1.5 mr-2 text-xs text-white/40 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="bg-[#0A0A0A] border border-t-0 border-white/10 rounded-b-lg overflow-hidden">
        <div className="p-4 overflow-x-auto">
          <pre className="text-sm font-mono">
            <code className={activeTab === 'response' ? 'text-[#3B82F6]' : 'text-white/80'}>
              {currentTab.code}
            </code>
          </pre>
        </div>
      </div>

      {/* Install hint */}
      {activeTab === 'wallet' && (
        <div className="mt-4 flex items-center gap-2 text-xs text-white/40">
          <Terminal className="w-3.5 h-3.5" />
          <code className="bg-white/5 px-2 py-1 rounded">
            npm install @solana/web3.js @solana/spl-token bs58
          </code>
        </div>
      )}
    </motion.div>
  )
}

function TerminalWindow() {
  const curlCommand = `curl -H "Authorization: <tx-signature>" \\
  "${typeof window !== 'undefined' ? window.location.origin : 'https://x402-oracle.vercel.app'}${API_ENDPOINT}"`

  const jsonResponse = `{
  "walletAddress": "7xKXtg2CW87d97TXJ...",
  "score": 87,
  "tier": "Gold",
  "badge": "Diamond Hands",
  "age": "2+ years",
  "metrics": {
    "totalTransactions": 2847,
    "trustScore": 0.87
  }
}`

  return (
    <motion.div
      variants={fadeUp}
      className="w-full max-w-xl"
    >
      {/* Terminal Header */}
      <div className="bg-[#1A1A1A] border border-white/10 rounded-t-lg px-4 py-3 flex items-center gap-2">
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
          <div className="w-3 h-3 rounded-full bg-white/20" />
        </div>
        <span className="text-white/40 text-sm font-mono ml-2">terminal</span>
      </div>

      {/* Terminal Body */}
      <div className="bg-[#0A0A0A] border border-t-0 border-white/10 rounded-b-lg p-4 font-mono text-sm space-y-4">
        {/* Command */}
        <div>
          <span className="text-white/40">$ </span>
          <span className="text-white/80">{curlCommand}</span>
        </div>

        {/* Response */}
        <div className="pt-2 border-t border-white/5">
          <div className="text-white/40 text-xs mb-2">Response 200 OK</div>
          <pre className="text-[#3B82F6]">{jsonResponse}</pre>
        </div>
      </div>
    </motion.div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Zap
  title: string
  description: string
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="bg-[#0A0A0A] border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors"
    >
      <Icon className="w-5 h-5 text-white/60 mb-4" />
      <h3 className="text-white font-medium mb-2">{title}</h3>
      <p className="text-white/50 text-sm leading-relaxed">{description}</p>
    </motion.div>
  )
}

function LiveDemo() {
  const [wallet, setWallet] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleCheck = async () => {
    if (!wallet) return

    setLoading(true)
    setResult(null)

    // Simulate API response with deterministic mock data
    await new Promise((r) => setTimeout(r, 1500))

    const hash = wallet.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const score = 50 + (hash % 50)
    const tier = score >= 90 ? 'Platinum' : score >= 75 ? 'Gold' : score >= 60 ? 'Silver' : 'Bronze'
    const badges = ['Diamond Hands', 'Early Adopter', 'DeFi Degen', 'NFT Collector']
    const badge = badges[hash % badges.length]

    setResult({
      walletAddress: wallet,
      score,
      tier,
      badge,
      age: ['< 1 month', '1-3 months', '6-12 months', '1-2 years', '2+ years'][hash % 5],
      metrics: {
        totalTransactions: 100 + (hash % 5000),
        trustScore: (0.5 + (hash % 50) / 100).toFixed(2),
      },
    })

    setLoading(false)
  }

  return (
    <motion.div variants={fadeUp} className="w-full">
      {/* Input Section */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Enter Solana wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          className="flex-1 bg-[#0A0A0A] border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 font-mono text-sm focus:outline-none focus:border-white/30 transition-colors"
        />
        <button
          onClick={handleCheck}
          disabled={loading || !wallet}
          className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <>
              Check
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Result Terminal */}
      <div className="bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-white/40" />
          <span className="text-white/40 text-sm font-mono">output</span>
        </div>
        <div className="p-4 font-mono text-sm min-h-[200px]">
          {!result && !loading && (
            <span className="text-white/30">
              {`// Enter a wallet address and click "Check" to simulate a reputation query`}
            </span>
          )}
          {loading && (
            <div className="text-white/50">
              <div>→ Requesting reputation data...</div>
              <div className="text-[#3B82F6] mt-2">→ 402 Payment Required</div>
              <div className="text-white/50 mt-1">→ Sending 0.05 USDC...</div>
              <div className="animate-pulse mt-1">→ Verifying on-chain...</div>
            </div>
          )}
          {result && (
            <pre className="text-[#3B82F6]">{JSON.stringify(result, null, 2)}</pre>
          )}
        </div>
      </div>

      {/* Note */}
      <p className="text-white/30 text-xs mt-3 text-center">
        This is a simulation. Live API requires USDC payment on Solana.
      </p>
    </motion.div>
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white rounded-sm" />
            <span className="font-semibold tracking-tight">x402-oracle</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#sdk" className="text-white/50 hover:text-white text-sm transition-colors">
              SDK
            </a>
            <a href="#api" className="text-white/50 hover:text-white text-sm transition-colors">
              API
            </a>
            <a href="#demo" className="text-white/50 hover:text-white text-sm transition-colors">
              Demo
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-white text-sm transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="grid lg:grid-cols-2 gap-16 items-center"
          >
            {/* Left: Copy */}
            <div>
              <motion.div variants={fadeUp} className="mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 text-xs text-white/50">
                  <span className="w-1.5 h-1.5 bg-[#3B82F6] rounded-full" />
                  x402 Protocol · Solana
                </span>
              </motion.div>

              <motion.h1
                variants={fadeUp}
                className="text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] mb-6"
              >
                The Trust Layer
                <br />
                <span className="text-white/40">for AI Agents.</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                className="text-lg text-white/50 leading-relaxed mb-8 max-w-md"
              >
                On-chain reputation scoring behind an x402 paywall.
                No API keys. No accounts. Just pay and query.
              </motion.p>

              <motion.div variants={fadeUp} className="flex items-center gap-4">
                <a
                  href="#sdk"
                  className="px-6 py-3 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors"
                >
                  Get Started
                </a>
                <a
                  href="#demo"
                  className="px-6 py-3 border border-white/20 text-white font-medium rounded-lg hover:bg-white/5 transition-colors"
                >
                  Try Demo
                </a>
              </motion.div>
            </div>

            {/* Right: Terminal */}
            <TerminalWindow />
          </motion.div>
        </div>
      </section>

      {/* Developer Integration Section */}
      <section id="sdk" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="mb-2">
              <span className="text-[#3B82F6] text-sm font-mono">// Developer Integration</span>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight mb-2">
              Copy. Paste. Ship.
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/50 mb-8 max-w-xl">
              The AgentWallet class handles the entire x402 payment flow.
              Your agent just calls <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded text-sm">.pay()</code> and
              gets the data.
            </motion.p>

            {/* Tabbed Code Block */}
            <TabbedCodeBlock />

            {/* Quick highlights */}
            <motion.div variants={fadeUp} className="grid md:grid-cols-3 gap-4 mt-8">
              <div className="flex items-start gap-3 p-4 bg-white/[0.02] rounded-lg border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-[#3B82F6]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">Zero Config</div>
                  <div className="text-xs text-white/40">Just pass your private key</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white/[0.02] rounded-lg border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-[#3B82F6]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">Max Amount Guard</div>
                  <div className="text-xs text-white/40">Never overpay for a resource</div>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-white/[0.02] rounded-lg border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center flex-shrink-0">
                  <Code className="w-4 h-4 text-[#3B82F6]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">Fully Typed</div>
                  <div className="text-xs text-white/40">TypeScript-first with generics</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
            className="grid md:grid-cols-3 gap-4"
          >
            <FeatureCard
              icon={Zap}
              title="Instant Verification"
              description="On-chain payment verification in under 2 seconds. No waiting for confirmations."
            />
            <FeatureCard
              icon={Shield}
              title="Replay Protected"
              description="Each payment signature can only be used once. Built-in protection against replay attacks."
            />
            <FeatureCard
              icon={Clock}
              title="Real-time Scoring"
              description="Wallet reputation computed from on-chain transaction history and behavioral patterns."
            />
          </motion.div>
        </div>
      </section>

      {/* API Specs */}
      <section id="api" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight mb-2">
              API Reference
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/50 mb-12">
              One endpoint. One price. Zero complexity.
            </motion.p>

            {/* Specs Table */}
            <motion.div
              variants={fadeUp}
              className="bg-[#0A0A0A] border border-white/10 rounded-lg overflow-hidden mb-8"
            >
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-6 py-4 text-sm font-medium text-white/50">Endpoint</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-white/50">Method</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-white/50">Price</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-white/50">Auth</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-6 py-4">
                      <code className="text-[#3B82F6] font-mono text-sm">/api/reputation</code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 bg-white/5 rounded text-xs font-mono">
                        GET / POST
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-white font-medium">${PRICE}</span>
                      <span className="text-white/40 ml-1">USDC</span>
                    </td>
                    <td className="px-6 py-4 text-white/50 text-sm">
                      Solana TX Signature
                    </td>
                  </tr>
                </tbody>
              </table>
            </motion.div>

            {/* Payment Info */}
            <motion.div variants={fadeUp} className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="bg-[#0A0A0A] border border-white/10 rounded-lg p-6">
                <div className="text-xs text-white/40 uppercase tracking-wide mb-2">
                  Receiver Wallet
                </div>
                <code className="text-white/80 font-mono text-sm break-all">{RECEIVER_WALLET}</code>
              </div>
              <div className="bg-[#0A0A0A] border border-white/10 rounded-lg p-6">
                <div className="text-xs text-white/40 uppercase tracking-wide mb-2">Network</div>
                <code className="text-white/80 font-mono text-sm">Solana Devnet</code>
              </div>
            </motion.div>

            {/* Code Examples */}
            <motion.div variants={fadeUp}>
              <h3 className="text-sm font-medium text-white/50 mb-4">cURL Example</h3>
              <CodeBlock>
{`curl -X GET \\
  -H "Authorization: <solana-tx-signature>" \\
  "${typeof window !== 'undefined' ? window.location.origin : 'https://x402-oracle.vercel.app'}/api/reputation?wallet=<target-wallet>"`}
              </CodeBlock>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Live Demo */}
      <section id="demo" className="py-20 px-6 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight mb-2">
              Try It
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/50 mb-8">
              Enter any Solana wallet to see a simulated reputation score.
            </motion.p>

            <LiveDemo />
          </motion.div>
        </div>
      </section>

      {/* x402 Flow */}
      <section className="py-20 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl font-semibold tracking-tight mb-2">
              How x402 Works
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/50 mb-12">
              HTTP 402 "Payment Required" — finally used for its intended purpose.
            </motion.p>

            <motion.div variants={fadeUp} className="grid md:grid-cols-4 gap-4">
              {[
                { step: '01', title: 'Request', desc: 'Agent calls API without payment' },
                { step: '02', title: '402 Response', desc: 'Server returns payment requirements' },
                { step: '03', title: 'Pay', desc: 'Agent sends USDC on Solana' },
                { step: '04', title: 'Retry', desc: 'Agent retries with TX signature' },
              ].map((item) => (
                <div
                  key={item.step}
                  className="bg-[#0A0A0A] border border-white/10 rounded-lg p-6"
                >
                  <div className="text-[#3B82F6] font-mono text-sm mb-3">{item.step}</div>
                  <div className="text-white font-medium mb-1">{item.title}</div>
                  <div className="text-white/40 text-sm">{item.desc}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white rounded-sm" />
            <span className="font-medium text-sm">x402-oracle</span>
          </div>
          <div className="text-white/30 text-sm">
            Built for x402 Hackathon 2025
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://x402.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white text-sm transition-colors"
            >
              x402 Protocol
            </a>
            <a
              href="https://solana.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white text-sm transition-colors"
            >
              Solana
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}

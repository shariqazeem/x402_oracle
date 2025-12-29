# x402-oracle

**Wallet Reputation Oracle for Autonomous AI Agents**

An x402-protected API that provides on-chain wallet reputation scoring for AI agents operating on Solana.

[![Solana](https://img.shields.io/badge/Solana-Devnet-9945FF?logo=solana)](https://solana.com)
[![x402](https://img.shields.io/badge/Protocol-x402-00D4AA)](https://x402.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The Problem

AI Agents are increasingly autonomous. They interact with wallets, execute transactions, and make decisions on behalf of users. But there's a critical blind spot:

> **AI Agents blindly trust wallets.**

When an agent receives a wallet address, it has no way to assess:
- Is this wallet legitimate or a fresh sybil?
- Does this wallet have a history of malicious behavior?
- Should this wallet be trusted for high-value operations?

Without reputation data, agents are vulnerable to:
- Sybil attacks (fresh wallets gaming airdrop systems)
- Rug pulls (interacting with malicious contracts)
- Wash trading (fake volume from coordinated wallets)

---

## The Solution

**x402-oracle** is a Reputation Oracle that AI agents can query to score wallet trustworthiness.

```
Agent: "Should I trust wallet 7xKXtg...?"
Oracle: "Score: 87/100, Tier: Gold, Badge: Diamond Hands, Age: 2+ years"
```

### How It Works

1. **Agent sends payment** - 0.05 USDC via Solana
2. **Oracle verifies on-chain** - Confirms payment in real-time
3. **Returns reputation data** - Score, badges, metrics, trust tier

The x402 protocol ensures:
- Agents pay only for data they consume
- No API keys or accounts required
- Fully permissionless and trustless

---

## Quick Start

### Prerequisites

- Node.js 18+
- Solana wallet with devnet USDC
- Funded devnet wallet for testing

### Installation

```bash
git clone https://github.com/yourusername/x402-oracle.git
cd x402-oracle
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Your Solana wallet that receives payments
SOLANA_WALLET_ADDRESS=your_wallet_address_here

# Network (devnet for testing, mainnet-beta for production)
X402_NETWORK=solana-devnet

# Optional: Custom RPC endpoint
SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## API Reference

### Endpoint

```
GET /api/reputation
POST /api/reputation
```

### Payment Requirements

| Field | Value |
|-------|-------|
| **Price** | 0.05 USDC |
| **Token** | USDC (SPL Token) |
| **Network** | Solana Devnet |
| **Receiver** | See `X-Payment-Receiver` header |

### Request Flow

#### Step 1: Initial Request (No Payment)

```bash
curl https://your-domain.com/api/reputation
```

Response (402 Payment Required):

```json
{
  "status": 402,
  "message": "Payment Required",
  "payment": {
    "receiver": "GiDRjzYbFvzBxyhkCjrYj9kPHti9Gz3rYKtNmKwPiqEA",
    "amount": 0.05,
    "token": "USDC",
    "network": "Solana Devnet"
  }
}
```

#### Step 2: Send Payment

Transfer 0.05 USDC to the receiver address on Solana. Save the transaction signature.

#### Step 3: Retry with Payment Proof

```bash
curl -H "Authorization: YOUR_TX_SIGNATURE" \
     "https://your-domain.com/api/reputation?wallet=TARGET_WALLET"
```

Response (200 OK):

```json
{
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "score": 87,
  "badge": "Diamond Hands",
  "tier": "Gold",
  "age": "2+ years",
  "metrics": {
    "totalTransactions": 2847,
    "uniqueInteractions": 156,
    "avgTransactionValue": 12.5,
    "trustScore": 0.87
  },
  "badges": ["Diamond Hands", "Early Adopter", "DeFi Degen"],
  "lastUpdated": "2025-01-15T10:30:00Z",
  "paymentVerification": {
    "txSignature": "Verified from 5yNmWxV...",
    "paidAmount": 0.05,
    "verifiedAt": "2025-01-15T10:30:00Z"
  }
}
```

---

## Usage Examples

### Using AgentWallet (TypeScript)

```typescript
import { AgentWallet } from './lib/AgentWallet'

const wallet = new AgentWallet(process.env.SOLANA_PRIVATE_KEY!)

// Query reputation for a wallet
const result = await wallet.pay(
  'https://your-domain.com/api/reputation?wallet=7xKXtg...',
  0.05 // Max amount willing to pay
)

if (result.success) {
  const reputation = result.data
  console.log(`Trust Score: ${reputation.score}/100`)
  console.log(`Tier: ${reputation.tier}`)
  console.log(`Primary Badge: ${reputation.badge}`)

  // Agent decision based on reputation
  if (reputation.score >= 70) {
    console.log('Wallet is trustworthy - proceeding with transaction')
  } else {
    console.log('Low reputation - requiring additional verification')
  }
}
```

### Using curl

```bash
# Get payment requirements
curl -X OPTIONS https://your-domain.com/api/reputation

# After sending 0.05 USDC payment, use the tx signature:
curl -H "Authorization: 5UfDuX7rXkzC..." \
     "https://your-domain.com/api/reputation?wallet=7xKXtg..."
```

### Using fetch (JavaScript)

```javascript
// Step 1: Get payment requirements
const infoRes = await fetch('/api/reputation')
const { payment } = await infoRes.json()

console.log(`Send ${payment.amount} ${payment.token} to ${payment.receiver}`)

// Step 2: After payment, query with signature
const signature = 'your_tx_signature_here'
const walletToQuery = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'

const res = await fetch(`/api/reputation?wallet=${walletToQuery}`, {
  headers: {
    'Authorization': signature
  }
})

const reputation = await res.json()
console.log(reputation)
```

---

## Reputation Scoring

### Score Tiers

| Tier | Score Range | Description |
|------|-------------|-------------|
| **Platinum** | 90-100 | Elite wallets with extensive history |
| **Gold** | 75-89 | Established, trustworthy wallets |
| **Silver** | 60-74 | Active wallets with decent history |
| **Bronze** | 0-59 | New or low-activity wallets |

### Badge Types

| Badge | Criteria |
|-------|----------|
| Diamond Hands | Long-term holder behavior |
| Early Adopter | Wallet age > 2 years |
| DeFi Degen | Active in DeFi protocols |
| NFT Collector | Significant NFT holdings |
| DAO Voter | Governance participation |
| Staking Pro | Active staking history |
| Bridge Builder | Cross-chain activity |
| Airdrop Hunter | Multiple airdrop claims |

---

## Security

### Replay Attack Prevention

- Transaction signatures can only be used once
- Transactions older than 5 minutes are rejected
- In-memory signature cache prevents reuse

### On-Chain Verification

- All payments are verified directly on Solana
- USDC transfers are validated against the expected receiver
- Amount verification with tolerance for rounding

---

## Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

### Environment Variables (Production)

```env
SOLANA_WALLET_ADDRESS=your_mainnet_wallet
X402_NETWORK=solana-mainnet
SOLANA_RPC_URL=https://your-rpc-provider.com
```

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│   AI Agent      │────▶│  x402-oracle     │────▶│  Solana RPC     │
│   (Client)      │     │  (Next.js API)   │     │  (Verification) │
│                 │◀────│                  │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │  1. Request           │  3. Verify payment
        │  2. 402 + Payment     │  4. Return reputation
        │     info              │
        ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Solana         │     │  Reputation      │
│  (Payment)      │     │  Engine          │
└─────────────────┘     └──────────────────┘
```

---

## Roadmap

- [x] x402 payment verification
- [x] Basic reputation scoring
- [x] Replay attack prevention
- [ ] Real on-chain analysis (Helius API)
- [ ] Historical transaction patterns
- [ ] Cross-protocol reputation (DeFi, NFT, DAO)
- [ ] Batch wallet queries
- [ ] Webhook notifications

---

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Built For

**x402 Hackathon 2025** - Trustless Agent Track

Building the infrastructure for autonomous AI agents on Solana.

---

## Links

- [x402 Protocol](https://x402.org)
- [Solana](https://solana.com)
- [Documentation](https://your-domain.com)

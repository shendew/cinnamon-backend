# Cinnamon Backend

## Blockchain Dev

A production-grade blockchain system for tracking cinnamon supply chain from farm to export.

### Features
- **ECDSA Cryptographic Signing** - Secure transaction authentication
- **Proof-of-Work Mining** - Block validation with adjustable difficulty
- **Merkle Trees** - Efficient transaction verification
- **Auto Health Monitoring** - Integrity checks every 5 minutes
- **Rate Limiting** - 100 transactions/minute per user
- **Immutable Records** - Cultivation, harvest, processing, distribution, export

### Database Schema
Execute schema: `psql $DATABASE_URL -f config/bc_schema.sql`

Tables: `blockchain_blocks`, `blockchain_transactions`, `user_keys`, `batch_blockchain_refs`

### Cryptographic Keys

**Key Generation**
- Uses ECDSA (secp256k1 curve) - same as Bitcoin/Ethereum
- Each user generates one key pair per account
- Keys are tied to `user_id` in the system

**Private Key**
- 64-character hexadecimal string
- Used to **sign** blockchain transactions
- Encrypted with AES-256-GCM before database storage
- Encryption key from `JWT_SECRET` environment variable
- **Never** sent in API requests or shared
- Shown **only once** when generated - save for backup

**Public Key**
- Derived from private key (130+ characters)
- Used to **verify** transaction signatures
- Stored unencrypted in database
- Included in each blockchain transaction
- Safe to share - proves transaction authenticity

**Key Storage**
```
user_keys table:
- user_id (foreign key)
- public_key (plaintext)
- encrypted_private_key (AES-256-GCM)
- is_active (only one active key per user)
- key_version (for key rotation)
```

**Automatic Usage**
When you create any blockchain record:
1. System fetches your encrypted private key
2. Decrypts it using JWT_SECRET
3. Signs the transaction with your private key
4. Adds your public key to the transaction
5. Stores transaction on blockchain

You never manually provide keys - all automatic.

**Key Management Endpoints**
```bash
POST /api/blockchain/keys/generate      # Generate new keys
GET  /api/blockchain/keys/public        # View your public key
GET  /api/blockchain/keys/info          # Key status/version
POST /api/blockchain/keys/deactivate    # Disable current keys
POST /api/blockchain/keys/reactivate    # Re-enable keys
```

### Quick Start

**1. Generate Keys (Required Once)**
```bash
POST /api/blockchain/keys/generate
Authorization: Bearer <token>
```
Save the private key returned - shown only once.

**2. Create Blockchain Records**
Records are automatically created when you:
- Create cultivation → `BATCH_CREATE` transaction
- Record harvest → `HARVEST_RECORD` transaction  
- Log collection → `COLLECTION_RECORD` transaction
- Start transport → `TRANSPORT_START` transaction
- Process (dry/grade/pack) → Processing transactions
- Distribute → `DISTRIBUTION_COLLECT` transaction
- Export → `EXPORT_RECORD` transaction

**Example: Create Cultivation (creates BATCH_CREATE transaction)**
```bash
POST /api/farmer/cultivation
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
  "batch_no": "BATCH001",
  "farm_id": 1,
  "date_of_planting": "2026-01-05",
  "seeding_source": "Organic Seeds Co.",
  "type_of_fertilizers": "Organic Compost",
  "pesticides": "None",
  "expected_harvest_date": "2026-06-05",
  "no_of_trees": 100,
  "organic_certification": <file>
}
```

**Response:**
```json
{
  "success": true,
  "cultivation": {...},
  "blockchain": {
    "success": true,
    "transactionHash": "a3f5b2...",
    "blockNumber": 1,
    "blockHash": "d4e7c9..."
  }
}
```

**3. Verify Batch History**
```bash
GET /api/blockchain/verify/:batchNo
```

### Admin Endpoints

```bash
GET  /api/blockchain/stats              # Blockchain statistics
GET  /api/blockchain/blocks             # All blocks
GET  /api/blockchain/transactions       # All transactions
GET  /api/blockchain/health             # System health
POST /api/blockchain/admin/reload       # Reload chain from DB
POST /api/blockchain/admin/reset        # Reset blockchain
```

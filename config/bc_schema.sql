
CREATE TABLE IF NOT EXISTS blockchain_blocks (
  block_id SERIAL PRIMARY KEY,
  block_number INTEGER NOT NULL UNIQUE,
  previous_hash VARCHAR(64) NOT NULL,
  merkle_root VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  nonce INTEGER NOT NULL DEFAULT 0,
  block_hash VARCHAR(64) NOT NULL UNIQUE,
  validator_user_id INTEGER REFERENCES "user"(user_id),
  validator_signature TEXT,
  transaction_count INTEGER NOT NULL DEFAULT 0,
  difficulty INTEGER DEFAULT 2,
  validator_public_key TEXT,
  mining_time_ms INTEGER,
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- indexes for blockchain_blocks
CREATE INDEX IF NOT EXISTS block_number_idx ON blockchain_blocks(block_number);
CREATE INDEX IF NOT EXISTS block_hash_idx ON blockchain_blocks(block_hash);
CREATE INDEX IF NOT EXISTS block_timestamp_idx ON blockchain_blocks(timestamp);
CREATE INDEX IF NOT EXISTS idx_blocks_validator ON blockchain_blocks(validator_user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_difficulty ON blockchain_blocks(difficulty);
CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blockchain_blocks(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_blocks_is_valid ON blockchain_blocks(is_valid);


CREATE TABLE IF NOT EXISTS blockchain_transactions (
  transaction_id SERIAL PRIMARY KEY,
  transaction_hash VARCHAR(64) NOT NULL UNIQUE,
  block_id INTEGER NOT NULL REFERENCES blockchain_blocks(block_id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  actor_user_id INTEGER NOT NULL REFERENCES "user"(user_id),
  actor_role TEXT NOT NULL,
  actor_signature TEXT NOT NULL,
  transaction_data JSONB NOT NULL,
  from_entity_id INTEGER,
  to_entity_id INTEGER,
  document_hashes JSONB,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  actor_public_key TEXT,
  nonce TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  verification_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- indexes for blockchain_transactions
CREATE INDEX IF NOT EXISTS tx_hash_idx ON blockchain_transactions(transaction_hash);
CREATE INDEX IF NOT EXISTS tx_batch_no_idx ON blockchain_transactions(batch_no);
CREATE INDEX IF NOT EXISTS tx_type_idx ON blockchain_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS tx_actor_idx ON blockchain_transactions(actor_user_id);
CREATE INDEX IF NOT EXISTS tx_block_id_idx ON blockchain_transactions(block_id);
CREATE INDEX IF NOT EXISTS tx_timestamp_idx ON blockchain_transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_tx_actor_user ON blockchain_transactions(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_tx_batch_timestamp ON blockchain_transactions(batch_no, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tx_type ON blockchain_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_tx_nonce ON blockchain_transactions(nonce);


CREATE TABLE IF NOT EXISTS user_keys (
  key_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT NOT NULL,
  key_version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- add unique constraint with WHERE clause
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_keys_unique_active ON user_keys(user_id, is_active) WHERE is_active = true;

-- indexes for user_keys
CREATE INDEX IF NOT EXISTS idx_user_keys_user ON user_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_keys_active ON user_keys(is_active) WHERE is_active = true;


CREATE TABLE IF NOT EXISTS blockchain_health_logs (
  log_id SERIAL PRIMARY KEY,
  check_timestamp TIMESTAMP DEFAULT NOW(),
  check_duration_ms INTEGER,
  check_passed BOOLEAN,
  total_blocks INTEGER,
  total_transactions INTEGER,
  issues_found TEXT[],
  error_message TEXT,
  chain_valid BOOLEAN
);

-- index for health logs
CREATE INDEX IF NOT EXISTS idx_health_timestamp 
ON blockchain_health_logs(check_timestamp DESC);


CREATE TABLE IF NOT EXISTS blockchain_metrics (
  metric_id SERIAL PRIMARY KEY,
  metric_timestamp TIMESTAMP DEFAULT NOW(),
  metric_type VARCHAR(50) NOT NULL, -- 'block_time', 'tx_count', 'difficulty_change'
  metric_value DECIMAL,
  metadata JSONB
);

-- index for blockchain_metrics
CREATE INDEX IF NOT EXISTS idx_metrics_type_timestamp 
  ON blockchain_metrics(metric_type, metric_timestamp DESC);

CREATE TABLE IF NOT EXISTS blockchain_metadata (
  metadata_id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batch_blockchain_refs (
  ref_id SERIAL PRIMARY KEY,
  batch_no TEXT NOT NULL REFERENCES main(batch_no) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  transaction_id INTEGER NOT NULL REFERENCES blockchain_transactions(transaction_id) ON DELETE RESTRICT,
  block_id INTEGER NOT NULL REFERENCES blockchain_blocks(block_id) ON DELETE RESTRICT,
  transaction_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- iindexes for batch_blockchain_refs
CREATE INDEX IF NOT EXISTS batch_stage_idx ON batch_blockchain_refs(batch_no, stage);
CREATE INDEX IF NOT EXISTS tx_ref_idx ON batch_blockchain_refs(transaction_id);


-- Update timestamp trigger for user_keys
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_keys_updated_at BEFORE UPDATE ON user_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- analyze tables
ANALYZE blockchain_blocks;
ANALYZE blockchain_transactions;
ANALYZE batch_blockchain_refs;
ANALYZE blockchain_metadata;
-- vacuum to reclaim space and update statistics
VACUUM ANALYZE blockchain_blocks;
VACUUM ANALYZE blockchain_transactions;


-- verify the update
-- check if all columns exist
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'blockchain_blocks' ORDER BY ordinal_position;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'blockchain_transactions' ORDER BY ordinal_position;

-- check indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('blockchain_blocks', 'blockchain_transactions', 'user_keys') ORDER BY tablename, indexname;

-- verify user_keys table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'user_keys';

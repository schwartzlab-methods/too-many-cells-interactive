#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE UNLOGGED TABLE features (
        id VARCHAR(255) NOT NULL,
        feature VARCHAR(255) NOT NULL,
        feature_type VARCHAR(255) NOT NULL,
        value DECIMAL NOT NULL
    );
EOSQL
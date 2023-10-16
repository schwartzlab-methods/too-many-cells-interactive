#!/bin/bash
set -e

apt-get update && apt-get install postgresql-contrib -y

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	CREATE UNLOGGED TABLE features (
        id VARCHAR(255) NOT NULL,
        feature VARCHAR(255) NOT NULL,
        feature_type VARCHAR(255) NOT NULL,
        value DECIMAL NOT NULL
    );

    CREATE UNLOGGED TABLE feature_names (
        name VARCHAR(255) NOT NULL
    );

    CREATE EXTENSION pg_trgm;

    CREATE UNIQUE INDEX feature_name_unique_idx ON feature_names(name);
EOSQL

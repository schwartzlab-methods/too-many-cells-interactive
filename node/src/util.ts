import { Pool } from 'pg';

export interface Feature {
    feature: string;
    feature_type: string;
    id: string;
    value: number;
}

/**
 * Fetch features by name and reduce to a map of features
 * e.g., {APOE: {AAACCCAGTCGCAACC-123: 1.23}, SERP2: ...    }
 * @param {Array<string>} features the feature names
 * @param {Pool} pool the connection pool
 * @returns {Record<string | number, number>} the mapping of values
 */
export const queryFeatures = async (features: string[], pool: Pool) => {
    const parameters = features.map((_, i) => `$${i + 1}`).join(',');

    const r = await pool.query<Feature>(
        `SELECT * FROM features where feature in (${parameters})`,
        features
    );

    const formatted = {} as Record<string, Record<string | number, number>>;

    r.rows.forEach(item => {
        if (!formatted[item.feature]) {
            formatted[item.feature] = {};
        }
        formatted[item.feature][item.id] = +item.value;
    });

    return formatted;
};

/**
 * Search the database for features with a name like `featureName`
 * @param {string} featureName the search string
 * @param {Pool} pool the connection pool
 * @returns {Promise<Array<{name: string}>>} the matches
 */
export const searchFeatureNames = async (featureName: string, pool: Pool) => {
    const r = await pool.query<{ name: string }>(
        `select *, SIMILARITY(name, $1) from feature_names where SIMILARITY(name, $1) > .3 ORDER BY similarity DESC limit 25;`,
        [featureName]
    );

    return r.rows;
};

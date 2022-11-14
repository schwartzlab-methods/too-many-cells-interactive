import { Pool } from 'pg';

export interface Feature {
    feature: string;
    feature_type: string;
    id: string;
    value: number;
}

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

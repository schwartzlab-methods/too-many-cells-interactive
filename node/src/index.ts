import express from 'express';
import { Pool } from 'pg';

const app = express();

export interface Feature {
    feature: string;
    feature_type: string;
    id: string;
    value: number;
}

const pool = new Pool();

app.use('/', express.static('/usr/app/static'));

app.use('/api/features', async (req, res) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
        res.status(422).json('no query sent!');
    } else {
        const features = q.split(',').map(s => s.trim());

        const formatted = await queryFeatures(features, pool);

        res.json(formatted);
    }
});

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

app.use('/api/features-set', async (req, res) => {
    //searching all docs by regex is slow, so we can just return all unique values up front

    const allGenes = await pool.query<{ feature: string }>(
        `SELECT feature FROM features GROUP BY feature`
    );

    res.json(allGenes.rows.map(f => f.feature));
});

app.use((req, res) => {
    console.error(`NOT FOUND ${req.path}`);
    res.status(404).json('Not found');
});

app.listen(3000, () => {
    console.log(`The app is running!`);
});

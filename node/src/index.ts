import express from 'express';
import { Pool } from 'pg';
import path from 'path';
import { queryFeatures, searchFeatureNames } from './util';

/**
 * Simple express API for queries to the PG features database.
 */

const app = express();

const pool = new Pool();

const staticPath = path.resolve(__dirname, '..', 'static');

app.use('/', express.static(staticPath));

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

app.use('/api/feature-names', async (req, res) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
        res.status(422).json('no query sent!');
    } else {
        const feature = q.trim();

        const featureNames = await searchFeatureNames(feature, pool);

        res.json(featureNames.map(f => f.name));
    }
});

app.use((req, res) => {
    console.error(`NOT FOUND ${req.path}`);
    res.status(404).json('Not found');
});

app.listen(3000, () => {
    console.log('too-many-cells-interactive is running!');
});

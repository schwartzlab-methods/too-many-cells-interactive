import express from 'express';
import mongoose from 'mongoose';
import { Feature } from './models';

const app = express();

mongoose.connect(process.env.MONGO_CONNECTION_STRING!);

app.use('/', express.static('/usr/app/static'));

app.use('/api/features', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        res.status(422).json('no feature sent!');
    }
    const r = await Feature.find({ feature: q });
    res.json(r);
});

app.use('/api/features-set', async (req, res) => {
    //searching all docs by regex is slow, so we can just return all unique values up front
    const allGenes = await Feature.distinct('feature');
    res.json(allGenes);
});

app.use((req, res) => {
    console.error(`NOT FOUND ${req.path}`);
    res.status(404).json('Not found');
});

app.listen(3000, () => {
    console.log(`The app is running!`);
});

import express from 'express';
import mongoose from 'mongoose';

const app = express();

mongoose.connect(process.env.MONGO_CONNECTION_STRING!);

app.use('/', express.static(process.env.STATIC_DIR!));

app.use('/api/features', async (req, res) => {
    const { q } = req.query;
    if (!q) {
        res.status(422).json('no feature sent!');
    }
    //currently feature names are capitalized in db
    const feature =
        q!.toString().charAt(0).toLocaleUpperCase() + q!.toString().slice(1);

    const r = await Feature.find({ feature }).exec();
    res.json(r);
});

app.use('/api/features-set', async (req, res) => {
    //searching all docs by regex is slow, so we can just return all unique values
    //and store in FE, i don't think it's that heavy
    //but if they are we can just write them to another table
    const allGenes = await Feature.distinct('feature');

    //const r = await Feature.find({ feature }).exec();
    res.json(allGenes);
});

app.use((req, res) => {
    res.status(404).json('Not found');
});

app.listen(process.env.NODE_PORT, () => {
    console.log(`The app is listening on port ${process.env.NODE_PORT}`);
});

const featureSchema = new mongoose.Schema({
    feature: String,
    feature_type: String,
    id: String,
    value: Number,
});

const Feature = mongoose.model('matrix', featureSchema, 'matrix');

import express from 'express';
import mongoose from 'mongoose';

const app = express();

mongoose.connect(process.env.MONGO_CONNECTION_STRING!);

console.log(process.env.MONGO_CONNECTION_STRING!);

app.use('/', express.static('/usr/app/static'));

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

const featureSchema = new mongoose.Schema({
    feature: String,
    feature_type: String,
    id: String,
    value: Number,
});

const Feature = mongoose.model('features', featureSchema, 'features');

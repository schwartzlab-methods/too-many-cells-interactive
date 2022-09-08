import express from 'express';
import mongoose from 'mongoose';
import { Feature } from './models';

const app = express();

mongoose.connect(process.env.MONGO_CONNECTION_STRING!);

app.use('/', express.static('/usr/app/static'));

app.use('/api/features', async (req, res) => {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
        res.status(422).json('no query sent!');
    } else {
        const features = q.trim().split(',');

        const r = await Feature.aggregate<{
            _id: { feature: string };
            items: { id: string | number; value: number }[];
        }>([
            {
                $match: { feature: { $in: features } },
            },
            {
                $group: {
                    _id: { feature: '$feature' },
                    items: { $push: { id: '$id', value: '$value' } },
                },
            },
        ]);

        const formatted = {} as Record<string, Record<string | number, number>>;

        r.forEach(item => {
            formatted[item._id.feature] = {};
            item.items.forEach(element => {
                formatted[item._id.feature][element.id] = element.value;
            });
        });

        res.json(formatted);
    }

    //this works too but is quite slow:
    /* 
        db.features.aggregate([{$match: {feature: {$in: ['Apoe', 'Brca2']}}}, { $group: {_id: {"feature": "$feature"}, count: {$sum: 1}, items: {$push: {k: "$id", v: "$value"}}  }  }, {$project: {items : {$arrayToObject: "$items"} }}])
    */
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

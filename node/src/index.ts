import express from 'express';

const app = express();

app.use('/', express.static(process.env.STATIC_DIR!));

app.use((req, res) => {
    res.status(404).send('Not found');
});

app.listen(process.env.NODE_PORT, () => {
    console.log(`The app is listening on port ${process.env.NODE_PORT}`);
});

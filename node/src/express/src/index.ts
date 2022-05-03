import express from 'express';
import path from 'path';

const app = express();

app.use((req, res) => {
    if (req.headers.accept && req.headers.accept.includes('text')) {
        res.sendFile(path.join(__dirname, 'static/index.html'));
    }
});

express.static(path.join(__dirname, 'static/'));

app.listen(process.env.APP_PORT, () => {
    console.log(`Example app listening on port ${process.env.APP_PORT}`);
});

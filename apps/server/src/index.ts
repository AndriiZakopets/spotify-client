import express from 'express';
import https from 'https';
import fs from 'fs';

const app = express();
const port = 3000;

const options = {
    key: fs.readFileSync('path/to/key.pem'),
    cert: fs.readFileSync('path/to/cert.pem'),
};

https.createServer(options, app).listen(port, () => {
    console.log(`Server running on https://localhost:${port}`);
});

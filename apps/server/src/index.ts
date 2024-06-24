import express from 'express';
import https from 'https';
import fs from 'fs';

const app = express();
const port = 3000;

app.listen(port, () => {
    console.log(`Server running on https://localhost:${port}`);
});

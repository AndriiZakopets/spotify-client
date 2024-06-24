import express from 'express';
import path from 'path';

const app = express();
const port = 3000;

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../../client/dist')));

// API routes
app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from the server!' });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

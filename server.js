const express = require('express');
const yts = require('yt-search');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Search endpoint
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    try {
        const results = await yts(query);
        // Map to a cleaner format
        const songs = results.videos.map(video => ({
            id: video.videoId,
            title: video.title,
            thumbnail: video.thumbnail,
            duration: video.timestamp,
        })).slice(0, 15); // Top 15 results for better discovery

        res.json(songs);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to fetch search results' });
    }
});

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

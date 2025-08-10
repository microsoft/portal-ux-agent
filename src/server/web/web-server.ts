import express from 'express';
import cors from 'cors';
import { getComposition } from '../../rendering/ui-renderer.js';
import { renderReactUI } from './react-renderer.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// UI rendering endpoint
app.get('/ui/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const composition = getComposition(sessionId);
  
  if (!composition) {
    return res.status(404).json({ error: 'Composition not found' });
  }
  
  try {
    // Render the UI server-side
    const html = await renderReactUI(composition);
    res.send(html);
  } catch (error) {
    console.error('Rendering error:', error);
    res.status(500).json({ error: 'Failed to render UI' });
  }
});

// API endpoint to get composition data
app.get('/api/compositions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const composition = getComposition(sessionId);
  
  if (!composition) {
    return res.status(404).json({ error: 'Composition not found' });
  }
  
  res.json(composition);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'portal-ux-agent' });
});

export function startWebServer() {
  app.listen(PORT, () => {
    console.log(`Web server running on http://localhost:${PORT}`);
  });
}

import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Gemini client with API key from environment
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY not found in environment');
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

// Curated nostalgic Bollywood songs database for instant offline/fallback matching
const FALLBACK_SONGS = [
  {
    title: 'Pehla Nasha',
    film: 'Jo Jeeta Wohi Sikandar (1992)',
    singers: 'Udit Narayan, Sadhana Sargam',
    musicDirector: 'Jatin-Lalit',
    vibe: 'First Love Bliss · 90s School Romance',
    famousLyric: 'Chahe tum kuch na kaho, maine sun liya...',
    youtubeSearchQuery: 'Pehla Nasha Jo Jeeta Wohi Sikandar video song',
    youtubeVideoId: 'v211pB1l99s'
  },
  {
    title: 'Mere Rang Mein Rangne Wali',
    film: 'Maine Pyar Kiya (1989)',
    singers: 'S.P. Balasubrahmanyam',
    musicDirector: 'Raamlaxman',
    vibe: 'Salman 90s Prem · Pure Romantic Devotion',
    famousLyric: 'Mere rang mein rangne wali, pari ho ya ho pariyon ki rani...',
    youtubeSearchQuery: 'Mere Rang Mein Rangne Wali Maine Pyar Kiya video song',
    youtubeVideoId: 'fC9N5_7Jb8I'
  },
  {
    title: 'Dheere Dheere Se Meri Zindagi Mein Aana',
    film: 'Aashiqui (1990)',
    singers: 'Kumar Sanu, Anuradha Paudwal',
    musicDirector: 'Nadeem-Shravan',
    vibe: 'Monsoon Walkman Nostalgia · The Original Aashiqui',
    famousLyric: 'Dheere dheere se meri zindagi mein aana, dheere dheere se dil ko churana...',
    youtubeSearchQuery: 'Dheere Dheere Se Meri Zindagi Mein Aana Aashiqui video song',
    youtubeVideoId: 'F8-1_nB629o'
  },
  {
    title: 'Tujhe Dekha Toh Yeh Jaana Sanam',
    film: 'Dilwale Dulhania Le Jayenge (1995)',
    singers: 'Kumar Sanu, Lata Mangeshkar',
    musicDirector: 'Jatin-Lalit',
    vibe: 'Mustard Fields · Evergreen Golden Melody',
    famousLyric: 'Tujhe dekha toh yeh jaana sanam, pyaar hota hai deewana sanam...',
    youtubeSearchQuery: 'Tujhe Dekha Toh Yeh Jaana Sanam DDLJ video song',
    youtubeVideoId: 'cNVtK01t3eM'
  },
  {
    title: 'Tum Hi Ho',
    film: 'Aashiqui 2 (2013)',
    singers: 'Arijit Singh',
    musicDirector: 'Mithoon',
    vibe: 'Raincoat Heartbreak · Adhoori Mohabbat 💔',
    famousLyric: 'Kyunki tum hi ho, ab tum hi ho, zindagi ab tum hi ho...',
    youtubeSearchQuery: 'Tum Hi Ho Aashiqui 2 full video song',
    youtubeVideoId: 'Umqb9KENgmk'
  },
  {
    title: 'Sunn Raha Hai Na Tu',
    film: 'Aashiqui 2 (2013)',
    singers: 'Ankit Tiwari',
    musicDirector: 'Ankit Tiwari',
    vibe: 'Acoustic Rain & Passion · Soulful Echo',
    famousLyric: 'Yaara... sunn raha hai na tu, ro raha hoon main...',
    youtubeSearchQuery: 'Sunn Raha Hai Na Tu Ankit Tiwari Aashiqui 2 video song',
    youtubeVideoId: '4BuxbSfv2x4'
  },
  {
    title: 'Chura Ke Dil Mera',
    film: 'Main Khiladi Tu Anari (1994)',
    singers: 'Kumar Sanu, Alka Yagnik',
    musicDirector: 'Anu Malik',
    vibe: 'Leopard Print Era · Upbeat 90s Romance',
    famousLyric: 'Chura ke dil mera goriya chali...',
    youtubeSearchQuery: 'Chura Ke Dil Mera Main Khiladi Tu Anari video song',
    youtubeVideoId: 'sLffb0U24fU'
  },
  {
    title: 'Pehla Pehla Pyar Hai',
    film: 'Hum Aapke Hain Koun..! (1994)',
    singers: 'S.P. Balasubrahmanyam',
    musicDirector: 'Raamlaxman',
    vibe: 'Prem & Nisha · Innocence & Joy',
    famousLyric: 'Pehla pehla pyar hai, pehli pehli baar hai...',
    youtubeSearchQuery: 'Pehla Pehla Pyar Hai Hum Aapke Hain Koun video song',
    youtubeVideoId: '5n_W72u_4p0'
  },
  {
    title: 'Roop Tera Mastana',
    film: 'Aradhana (1969)',
    singers: 'Kishore Kumar',
    musicDirector: 'S.D. Burman',
    vibe: 'Fireplace & Rain · Kishore Da Seductive Classic',
    famousLyric: 'Roop tera mastana pyaar mera deewana...',
    youtubeSearchQuery: 'Roop Tera Mastana Aradhana Kishore Kumar song',
    youtubeVideoId: 'HenA-OUyo08'
  },
  {
    title: 'Bahon Ke Darmiyan',
    film: 'Khamoshi: The Musical (1996)',
    singers: 'Hariharan, Alka Yagnik',
    musicDirector: 'Jatin-Lalit',
    vibe: 'Poetic Silence · Balcony Breeze',
    famousLyric: 'Bahon ke darmiyan do pyar mil rahe hain...',
    youtubeSearchQuery: 'Bahon Ke Darmiyan Khamoshi video song',
    youtubeVideoId: 'f56-xZ0h190'
  },
  {
    title: 'Dil Ka Telephone',
    film: 'Dream Girl (2019)',
    singers: 'Jonita Gandhi, Nakash Aziz',
    musicDirector: 'Meet Bros',
    vibe: 'Ring-Ring Romance · Peppy Party Radio Mix ☎️',
    famousLyric: 'Tere sarr pe hai ilzaam mere dil ka telephone ring-ring-ra-ra-ring...',
    youtubeSearchQuery: 'Dil Ka Telephone Dream Girl Jonita Gandhi Nakash Aziz video song',
    youtubeVideoId: 'a3B2glol4IU'
  }
];

// /api/search-songs endpoint
app.post('/api/search-songs', async (req, res) => {
  const query = (req.body?.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const ai = getGeminiClient();

  if (!ai) {
    // If API key is not present, return curated matching fallback songs
    const filtered = FALLBACK_SONGS.filter(s =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.film.toLowerCase().includes(query.toLowerCase()) ||
      s.singers.toLowerCase().includes(query.toLowerCase()) ||
      s.famousLyric.toLowerCase().includes(query.toLowerCase()) ||
      s.vibe.toLowerCase().includes(query.toLowerCase())
    );
    const results = filtered.length > 0 ? filtered : FALLBACK_SONGS.slice(0, 4);
    return res.json({
      query,
      results: results.map(r => ({
        ...r,
        thumbnail: `https://i.ytimg.com/vi/${r.youtubeVideoId}/hqdefault.jpg`
      })),
      source: 'curated-vault'
    });
  }

  try {
    const prompt = `You are the chief music archivist for "Cassette Wala Pyaar", a nostalgic Bollywood retro cassette tape website celebrating 1990s and classic Indian romantic music.
The user is searching for songs with the query: "${query}".

Identify 4 to 6 most accurate, relevant Hindi/Bollywood film songs matching this search.
The query might be:
- Exact song title (e.g. "Pehla Nasha", "Tu Hi Meri Shab Hai")
- Singer name (e.g. "Kumar Sanu", "Kishore Kumar", "SP Balasubrahmanyam", "Arijit Singh", "Alka Yagnik", "Udit Narayan")
- Actor or era (e.g. "Salman Khan 90s Prem", "Shah Rukh Khan romantic", "Aamir Khan 90s")
- Partial lyrics (e.g. "chura ke dil mera", "ek ladki ko dekha", "tere bina zindagi se")
- Mood or feeling (e.g. "rainy day sad love", "college letter romance", "dholak shaadi duet")

For EACH song, return:
- title: Song title (e.g. "Pehla Nasha")
- film: Film name and release year in parentheses (e.g. "Jo Jeeta Wohi Sikandar (1992)")
- singers: Main singers (e.g. "Udit Narayan, Sadhana Sargam")
- musicDirector: Music composer(s) (e.g. "Jatin-Lalit")
- vibe: A short, poetic nostalgic vibe tag (under 5 words, e.g. "First Love in Rain", "Midnight Transistor Memory", "Adhoori Mohabbat 💔")
- famousLyric: One memorable line from the lyrics in Romanized Hinglish (e.g. "Chahe tum kuch na kaho, maine sun liya...")
- youtubeSearchQuery: Accurate YouTube search query for the official original video (e.g. "Pehla Nasha Jo Jeeta Wohi Sikandar original video song")
- youtubeVideoId: A known valid, high-quality YouTube video ID for this official song, or well-known standard upload ID.

Respond strictly with a JSON array conforming to the schema.`;

    // Try gemini-2.5-flash first with quick timeout, falling back gracefully
    let rawText = '';
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout calling model ${model}`)), 4500)
        );

        const callPromise = ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  film: { type: Type.STRING },
                  singers: { type: Type.STRING },
                  musicDirector: { type: Type.STRING },
                  vibe: { type: Type.STRING },
                  famousLyric: { type: Type.STRING },
                  youtubeSearchQuery: { type: Type.STRING },
                  youtubeVideoId: { type: Type.STRING }
                },
                required: ['title', 'film', 'singers', 'vibe', 'famousLyric', 'youtubeSearchQuery']
              }
            }
          }
        });

        const response: any = await Promise.race([callPromise, timeoutPromise]);

        if (response && response.text) {
          rawText = response.text.trim();
          break;
        }
      } catch (err: any) {
        console.warn(`[Gemini] Model ${model} failed, trying next:`, err.message);
        lastError = err;
      }
    }

    if (!rawText) {
      throw lastError || new Error('No response from Gemini API');
    }

    const parsed = JSON.parse(rawText);
    const enriched = parsed.map((item: any) => {
      const vid = item.youtubeVideoId && item.youtubeVideoId.length === 11 ? item.youtubeVideoId : '';
      return {
        ...item,
        youtubeVideoId: vid,
        thumbnail: vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '/src/assets/images/vintage_cassette_cover_1791736127552.jpg',
        url: vid ? `https://www.youtube.com/watch?v=${vid}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(item.youtubeSearchQuery || `${item.title} ${item.film}`)}`
      };
    });

    return res.json({
      query,
      results: enriched,
      source: 'gemini-ai'
    });
  } catch (error: any) {
    console.error('[Gemini] Search error:', error);
    // Graceful fallback to curated database if Gemini fails
    const filtered = FALLBACK_SONGS.filter(s =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.film.toLowerCase().includes(query.toLowerCase()) ||
      s.singers.toLowerCase().includes(query.toLowerCase()) ||
      s.famousLyric.toLowerCase().includes(query.toLowerCase())
    );
    const results = filtered.length > 0 ? filtered : FALLBACK_SONGS.slice(0, 4);
    return res.json({
      query,
      results: results.map(r => ({
        ...r,
        thumbnail: `https://i.ytimg.com/vi/${r.youtubeVideoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${r.youtubeVideoId}`
      })),
      source: 'curated-vault-fallback',
      warning: 'Gemini service temporarily busy; showing curated vintage tape recommendations'
    });
  }
});

// Vite middleware in development vs Static serving in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: typeof PORT === 'number' ? PORT : parseInt(PORT, 10)
      },
      appType: 'spa'
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Cassette Wala Pyaar] Server running on http://0.0.0.0:${PORT} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

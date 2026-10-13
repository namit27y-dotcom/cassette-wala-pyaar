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

// Serve static assets from public directory (images and fallbacks)
app.use('/images', express.static(path.resolve(__dirname, 'public/images')));
app.use(express.static(path.resolve(__dirname, 'public')));

// In-memory cache for resolved video IDs and official album art
const videoIdCache = new Map<string, string>();
const artworkCache = new Map<string, string>();

interface SongEntry {
  title: string;
  film: string;
  singers: string;
  musicDirector?: string;
  vibe: string;
  famousLyric: string;
  youtubeVideoId: string;
  artworkFallback?: string;
}

// Curated verified catalog of legendary Bollywood songs with confirmed video IDs and artwork
const VERIFIED_SONG_CATALOG: SongEntry[] = [
  // --- Maine Pyar Kiya (1989) - Salman Khan & S. P. Balasubrahmanyam & Lata Mangeshkar ---
  {
    title: 'Mere Rang Mein Rangne Wali',
    film: 'Maine Pyar Kiya (1989)',
    singers: 'S.P. Balasubrahmanyam',
    musicDirector: 'Raamlaxman',
    vibe: 'Salman 90s Prem · Pure Romantic Devotion',
    famousLyric: 'Mere rang mein rangne wali, pari ho ya ho pariyon ki rani...',
    youtubeVideoId: 'T9RQrpuPt6o',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/e5/5a/7d/e55a7de2-6854-cb33-d0c4-e6df703c2ea5/191773207656.jpg/600x600bb.jpg'
  },
  {
    title: 'Dil Deewana',
    film: 'Maine Pyar Kiya (1989)',
    singers: 'Lata Mangeshkar, S.P. Balasubrahmanyam',
    musicDirector: 'Raamlaxman',
    vibe: 'First Love Flutter · Golden 90s Innocent Love',
    famousLyric: 'Dil deewana bin sajna ke maane na, ye pagla hai samjhane se samjhe na...',
    youtubeVideoId: '5s68NXiaWgk',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/e5/5a/7d/e55a7de2-6854-cb33-d0c4-e6df703c2ea5/191773207656.jpg/600x600bb.jpg'
  },
  {
    title: 'Aate Jaate Hanste Gaate',
    film: 'Maine Pyar Kiya (1989)',
    singers: 'S.P. Balasubrahmanyam, Lata Mangeshkar',
    musicDirector: 'Raamlaxman',
    vibe: 'Prem & Suman Duet · Cassette Era Sweetness',
    famousLyric: 'Aate jaate hanste gaate socha tha maine mann mein pehli baar...',
    youtubeVideoId: '_LbmnNQVRr8',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/e5/5a/7d/e55a7de2-6854-cb33-d0c4-e6df703c2ea5/191773207656.jpg/600x600bb.jpg'
  },
  {
    title: 'Kabootar Ja Ja Ja',
    film: 'Maine Pyar Kiya (1989)',
    singers: 'S.P. Balasubrahmanyam, Lata Mangeshkar',
    musicDirector: 'Raamlaxman',
    vibe: 'Pehli Chitthi · Nostalgic Bollywood Pigeon Post',
    famousLyric: 'Kabootar ja ja ja, pehle pyar ki pehli chitthi sajan ko de aa...',
    youtubeVideoId: 'a1tVvBxs4rk',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/e5/5a/7d/e55a7de2-6854-cb33-d0c4-e6df703c2ea5/191773207656.jpg/600x600bb.jpg'
  },
  {
    title: 'Aaja Shaam Hone Aayee',
    film: 'Maine Pyar Kiya (1989)',
    singers: 'S.P. Balasubrahmanyam, Lata Mangeshkar',
    musicDirector: 'Raamlaxman',
    vibe: 'Twilight Longing · Iconic Salman Prem',
    famousLyric: 'Aaja shaam hone aayee, mausam ne li angdai...',
    youtubeVideoId: 'fGqoDP-QDAw',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/e5/5a/7d/e55a7de2-6854-cb33-d0c4-e6df703c2ea5/191773207656.jpg/600x600bb.jpg'
  },

  // --- Aashiqui 2 (2013) - Arijit Singh & Ankit Tiwari ---
  {
    title: 'Tum Hi Ho',
    film: 'Aashiqui 2 (2013)',
    singers: 'Arijit Singh',
    musicDirector: 'Mithoon',
    vibe: 'Raincoat Heartbreak · Adhoori Mohabbat 💔',
    famousLyric: 'Kyunki tum hi ho, ab tum hi ho, zindagi ab tum hi ho...',
    youtubeVideoId: 'Umqb9KENgmk',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/600x600bb.jpg'
  },
  {
    title: 'Sunn Raha Hai Na Tu',
    film: 'Aashiqui 2 (2013)',
    singers: 'Ankit Tiwari',
    musicDirector: 'Ankit Tiwari',
    vibe: 'Acoustic Rain & Passion · Soulful Echo',
    famousLyric: 'Yaara... sunn raha hai na tu, ro raha hoon main...',
    youtubeVideoId: 'z3UHfi9vpbc',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/600x600bb.jpg'
  },
  {
    title: 'Chahun Main Ya Naa',
    film: 'Aashiqui 2 (2013)',
    singers: 'Arijit Singh, Palak Muchhal',
    musicDirector: 'Jeet Gannguli',
    vibe: 'Hesitant Confession · Pure Melodic Longing',
    famousLyric: 'Tu hi ye mujhko bata de, chahun main ya naa...',
    youtubeVideoId: 'VdyBtGaspss',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/600x600bb.jpg'
  },
  {
    title: 'Meri Aashiqui',
    film: 'Aashiqui 2 (2013)',
    singers: 'Arijit Singh, Palak Muchhal',
    musicDirector: 'Mithoon',
    vibe: 'Sacrificial Devotion · Climax Tearjerker',
    famousLyric: 'Baatein yeh kabhi na tu bhoolna, koi tere khatir hai jee raha...',
    youtubeVideoId: '3gRQ5a2nyAw',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/600x600bb.jpg'
  },
  {
    title: 'Bhula Dena Mujhe',
    film: 'Aashiqui 2 (2013)',
    singers: 'Mustafa Zahid',
    musicDirector: 'Jeet Gannguli',
    vibe: 'Rock Ballad Grief · Midnight Despair',
    famousLyric: 'Bhula dena mujhe, hai alvida tujhe...',
    youtubeVideoId: 'II4CvWvgIsI',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/bb/23/ee/bb23eeed-0c35-4f1d-2b11-485622777ae4/8902894353007_cover.jpg/600x600bb.jpg'
  },

  // --- Kumar Sanu Classics ---
  {
    title: 'Dheere Dheere Se Meri Zindagi Mein Aana',
    film: 'Aashiqui (1990)',
    singers: 'Kumar Sanu, Anuradha Paudwal',
    musicDirector: 'Nadeem-Shravan',
    vibe: 'Monsoon Walkman Nostalgia · The Original Aashiqui',
    famousLyric: 'Dheere dheere se meri zindagi mein aana, dheere dheere se dil ko churana...',
    youtubeVideoId: 'KeyfUuXPOcY',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/0a/3a/df/0a3adfc7-66f2-b2a8-df6e-850a09cd4a1e/8902894684088_cover.jpg/600x600bb.jpg'
  },
  {
    title: 'Tujhe Dekha Toh Yeh Jaana Sanam',
    film: 'Dilwale Dulhania Le Jayenge (1995)',
    singers: 'Kumar Sanu, Lata Mangeshkar',
    musicDirector: 'Jatin-Lalit',
    vibe: 'Mustard Fields · Evergreen Golden Melody',
    famousLyric: 'Tujhe dekha toh yeh jaana sanam, pyaar hota hai deewana sanam...',
    youtubeVideoId: 'cNV5hLSa9H8',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/1e/c2/88/1ec2882b-e4bf-85cc-41f0-62c202febefe/197187651245.jpg/600x600bb.jpg'
  },
  {
    title: 'Chura Ke Dil Mera',
    film: 'Main Khiladi Tu Anari (1994)',
    singers: 'Kumar Sanu, Alka Yagnik',
    musicDirector: 'Anu Malik',
    vibe: 'Leopard Print Era · Upbeat 90s Romance',
    famousLyric: 'Chura ke dil mera goriya chali...',
    youtubeVideoId: 'Yqj1_V90KJo',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/dc/4b/31/dc4b31a8-cfae-5262-d04b-fa50fba205d1/191773203993.jpg/600x600bb.jpg'
  },
  {
    title: 'Ek Ladki Ko Dekha Toh Aisa Laga',
    film: '1942: A Love Story (1994)',
    singers: 'Kumar Sanu',
    musicDirector: 'R.D. Burman',
    vibe: 'Poetic Similes · Pancham Da Swan Song',
    famousLyric: 'Ek ladki ko dekha toh aisa laga, jaise khilta gulaab...',
    youtubeVideoId: 'fTauOK8J-U8',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/83/8f/35/838f3521-4d43-5296-6e47-e9a97bcbb527/191773203955.jpg/600x600bb.jpg'
  },
  {
    title: 'Mera Dil Bhi Kitna Pagal Hai',
    film: 'Saajan (1991)',
    singers: 'Kumar Sanu, Alka Yagnik',
    musicDirector: 'Nadeem-Shravan',
    vibe: 'Secret Diary Romance · Cassette Bestseller',
    famousLyric: 'Mera dil bhi kitna pagal hai, yeh pyaar toh tumse karta hai...',
    youtubeVideoId: 'DIvHIjOYq3U',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/37/8d/f9/378df9e8-4ee0-e71e-dc0f-8c3baaa5dfa7/8902894684132_cover.jpg/600x600bb.jpg'
  },
  {
    title: 'Do Dil Mil Rahe Hain',
    film: 'Pardes (1997)',
    singers: 'Kumar Sanu',
    musicDirector: 'Nadeem-Shravan',
    vibe: 'Acoustic Guitar Romance · SRK Classic',
    famousLyric: 'Do dil mil rahe hain magar chupke chupke...',
    youtubeVideoId: '5SvIuD6wJRI',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/d5/d3/df/d5d3dfae-df69-14a5-a4f6-80db61bfaae6/191773204914.jpg/600x600bb.jpg'
  },

  // --- Kishore Kumar Classics ---
  {
    title: 'Roop Tera Mastana',
    film: 'Aradhana (1969)',
    singers: 'Kishore Kumar',
    musicDirector: 'S.D. Burman',
    vibe: 'Fireplace & Rain · Kishore Da Seductive Classic',
    famousLyric: 'Roop tera mastana pyaar mera deewana...',
    youtubeVideoId: 'dyEdcOhxJNQ',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/69/14/b6/6914b6a2-6b5e-7efa-9a77-088273def2a6/191773202507.jpg/600x600bb.jpg'
  },
  {
    title: 'Yeh Shaam Mastani',
    film: 'Kati Patang (1970)',
    singers: 'Kishore Kumar',
    musicDirector: 'R.D. Burman',
    vibe: 'Twilight Whistle · Rajesh Khanna Romance',
    famousLyric: 'Yeh shaam mastani madhosh kiye jaaye...',
    youtubeVideoId: 'lbfWsIpXsCA',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/69/14/b6/6914b6a2-6b5e-7efa-9a77-088273def2a6/191773202507.jpg/600x600bb.jpg'
  },
  {
    title: 'O Mere Dil Ke Chain',
    film: 'Mere Jeevan Saathi (1972)',
    singers: 'Kishore Kumar',
    musicDirector: 'R.D. Burman',
    vibe: 'Late Night Transistor · Soulful Yearning',
    famousLyric: 'O mere dil ke chain, chain aaye mere dil ko dua kijiye...',
    youtubeVideoId: '-Px0efU00uQ',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/69/14/b6/6914b6a2-6b5e-7efa-9a77-088273def2a6/191773202507.jpg/600x600bb.jpg'
  },
  {
    title: 'Pal Pal Dil Ke Paas',
    film: 'Blackmail (1973)',
    singers: 'Kishore Kumar',
    musicDirector: 'Kalyanji-Anandji',
    vibe: 'Timeless Warmth · Dharmendra & Rakhee',
    famousLyric: 'Pal pal dil ke paas tum rehti ho...',
    youtubeVideoId: 'AMuRRXCuy-4',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/69/14/b6/6914b6a2-6b5e-7efa-9a77-088273def2a6/191773202507.jpg/600x600bb.jpg'
  },
  {
    title: 'Tere Bina Zindagi Se',
    film: 'Aandhi (1975)',
    singers: 'Kishore Kumar, Lata Mangeshkar',
    musicDirector: 'R.D. Burman',
    vibe: 'Ruins in Rain · Mature Poetic Love',
    famousLyric: 'Tere bina zindagi se koi shikwa toh nahin...',
    youtubeVideoId: 'hLuXy8yhHYQ',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/69/14/b6/6914b6a2-6b5e-7efa-9a77-088273def2a6/191773202507.jpg/600x600bb.jpg'
  },

  // --- S. P. Balasubrahmanyam Classics ---
  {
    title: 'Pehla Pehla Pyar Hai',
    film: 'Hum Aapke Hain Koun..! (1994)',
    singers: 'S.P. Balasubrahmanyam',
    musicDirector: 'Raamlaxman',
    vibe: 'Prem & Nisha · Innocence & Joy',
    famousLyric: 'Pehla pehla pyar hai, pehli pehli baar hai...',
    youtubeVideoId: 'w2iozAbNXAo',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b8/b6/f8/b8b6f8f6-df30-9b48-3a9a-ef1813f80c65/191773204013.jpg/600x600bb.jpg'
  },
  {
    title: 'Didi Tera Devar Deewana',
    film: 'Hum Aapke Hain Koun..! (1994)',
    singers: 'Lata Mangeshkar, S.P. Balasubrahmanyam',
    musicDirector: 'Raamlaxman',
    vibe: 'Wedding Festivity · Gully Cricket Antakshari',
    famousLyric: 'Didi tera devar deewana, haay ram kudiyon ko daale daana...',
    youtubeVideoId: 'tEKi6vnPApI',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/b8/b6/f8/b8b6f8f6-df30-9b48-3a9a-ef1813f80c65/191773204013.jpg/600x600bb.jpg'
  },
  {
    title: 'Bahut Pyar Karte Hain',
    film: 'Saajan (1991)',
    singers: 'S.P. Balasubrahmanyam',
    musicDirector: 'Nadeem-Shravan',
    vibe: 'Silent Lover Ghazal · Salman & Madhuri',
    famousLyric: 'Bahut pyar karte hain tumko sanam, kasam chahe le lo khuda ki kasam...',
    youtubeVideoId: 'rqEjOLu105I',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/37/8d/f9/378df9e8-4ee0-e71e-dc0f-8c3baaa5dfa7/8902894684132_cover.jpg/600x600bb.jpg'
  },
  {
    title: 'Roja Janeman',
    film: 'Roja (1992)',
    singers: 'S.P. Balasubrahmanyam',
    musicDirector: 'A.R. Rahman',
    vibe: 'Misty Mountains · AR Rahman Genesis',
    famousLyric: 'Roja jaaneman tu dil ki dhadkan, tujh bin tarse naina...',
    youtubeVideoId: 'iDQ1qjCevZE',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/35/d9/39/35d93963-366a-b2aa-49c0-6d4b4e1d5203/191773203658.jpg/600x600bb.jpg'
  },

  // --- Other Evergreen Romantic Anthems ---
  {
    title: 'Pehla Nasha',
    film: 'Jo Jeeta Wohi Sikandar (1992)',
    singers: 'Udit Narayan, Sadhana Sargam',
    musicDirector: 'Jatin-Lalit',
    vibe: 'First Love Bliss · 90s School Romance',
    famousLyric: 'Chahe tum kuch na kaho, maine sun liya...',
    youtubeVideoId: 'SBfPs-PMGTA',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/9a/c7/2b/9ac72b83-b78f-a78b-3f41-b84742f1f457/191773203719.jpg/600x600bb.jpg'
  },
  {
    title: 'Bahon Ke Darmiyan',
    film: 'Khamoshi: The Musical (1996)',
    singers: 'Hariharan, Alka Yagnik',
    musicDirector: 'Jatin-Lalit',
    vibe: 'Poetic Silence · Balcony Breeze',
    famousLyric: 'Bahon ke darmiyan do pyar mil rahe hain...',
    youtubeVideoId: 'kHYYfKAQdHA',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/55/e8/35/55e8354c-1111-e64e-a134-2e9fe557993a/8902894684170_cover.jpg/600x600bb.jpg'
  },
  {
    title: 'Dil Ka Telephone',
    film: 'Dream Girl (2019)',
    singers: 'Jonita Gandhi, Nakash Aziz',
    musicDirector: 'Meet Bros',
    vibe: 'Ring-Ring Romance · Peppy Party Radio Mix ☎️',
    famousLyric: 'Tere sarr pe hai ilzaam mere dil ka telephone ring-ring-ra-ra-ring...',
    youtubeVideoId: 'a3B2glol4IU',
    artworkFallback: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/45/03/c7/4503c758-2660-c42b-537b-1254bb99b3c2/8718857906544.png/600x600bb.jpg'
  }
];

// Helper: Verify if a YouTube video thumbnail is actually valid (not 404 or 1097-byte grey placeholder)
async function verifyYouTubeThumbnail(videoId: string): Promise<boolean> {
  if (!videoId || videoId.length !== 11 || videoId.startsWith('PL') || videoId.startsWith('RD')) {
    return false;
  }
  try {
    const thumbUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(thumbUrl, {
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timer);
    const cl = parseInt(res.headers.get('content-length') || '0', 10);
    // YouTube's 404 / unavailable grey placeholder is 1097 bytes. Valid thumbnails are > 2000 bytes.
    return res.status === 200 && cl > 2000;
  } catch {
    return false;
  }
}

// Helper: Find verified YouTube video ID via search
async function resolveYouTubeVideoId(query: string): Promise<string | null> {
  const cleanQ = query.trim();
  if (videoIdCache.has(cleanQ)) {
    return videoIdCache.get(cleanQ)!;
  }
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQ)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const matches = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
    if (!matches) return null;

    const tested = new Set<string>();
    for (const m of matches.slice(0, 4)) {
      const vid = m.split('"')[3];
      if (!vid || tested.has(vid) || vid.startsWith('PL') || vid.startsWith('RD')) continue;
      tested.add(vid);
      const isValid = await verifyYouTubeThumbnail(vid);
      if (isValid) {
        videoIdCache.set(cleanQ, vid);
        return vid;
      }
    }
  } catch (err) {
    console.warn('[YouTube Resolver] Search resolution error:', (err as Error).message);
  }
  return null;
}

// Helper: Fetch official album artwork from iTunes Search API
async function fetchOfficialArtwork(query: string): Promise<string | null> {
  const cleanQ = query.trim();
  if (artworkCache.has(cleanQ)) {
    return artworkCache.get(cleanQ)!;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(cleanQ)}&entity=song&limit=1`, {
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.results && data.results.length > 0) {
      const rawArt = data.results[0].artworkUrl100;
      if (rawArt) {
        const highRes = rawArt.replace('100x100bb.jpg', '600x600bb.jpg');
        artworkCache.set(cleanQ, highRes);
        return highRes;
      }
    }
  } catch (err) {
    console.warn('[Artwork Resolver] iTunes lookup error:', (err as Error).message);
  }
  return null;
}

// Helper: Normalize strings for fuzzy matching
function normalizeText(text: string): string {
  return (text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Helper: Match a song against our verified catalog
function findCatalogMatch(title: string, film?: string, singers?: string): SongEntry | null {
  const nTitle = normalizeText(title);
  const nFilm = normalizeText(film || '');
  const nSingers = normalizeText(singers || '');

  // Exact title match
  for (const song of VERIFIED_SONG_CATALOG) {
    const sTitle = normalizeText(song.title);
    const sFilm = normalizeText(song.film);
    if (nTitle === sTitle || nTitle.includes(sTitle) || sTitle.includes(nTitle)) {
      if (!nFilm || sFilm.includes(nFilm) || nFilm.includes(sFilm.replace(/\d+/g, ''))) {
        return song;
      }
    }
  }
  // Title + singer match
  for (const song of VERIFIED_SONG_CATALOG) {
    const sTitle = normalizeText(song.title);
    const sSingers = normalizeText(song.singers);
    if ((nTitle.includes(sTitle) || sTitle.includes(nTitle)) &&
        (nSingers && sSingers && (nSingers.includes('spb') || nSingers.includes('balasubrahmanyam') || nSingers.includes('sanu') || nSingers.includes('arijit') || nSingers.includes('kishore') || nSingers.includes('ankit')))) {
      return song;
    }
  }
  return null;
}

// /api/search-songs endpoint
app.post('/api/search-songs', async (req, res) => {
  const query = (req.body?.query || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const ai = getGeminiClient();

  // Helper to enrich raw song items into verified artwork responses
  const enrichSongs = async (items: any[]) => {
    return Promise.all(
      items.map(async (item: any) => {
        const title = item.title || 'Classic Hindi Song';
        const film = item.film || '';
        const singers = item.singers || 'Retro Bollywood';
        const queryTerm = item.youtubeSearchQuery || `${title} ${film} video song`;

        // 1. Check curated catalog first
        const catalogMatch = findCatalogMatch(title, film, singers);
        let confirmedVideoId = catalogMatch ? catalogMatch.youtubeVideoId : '';
        let officialArt = catalogMatch?.artworkFallback || '';

        // 2. If Gemini provided a video ID, test its validity
        if (!confirmedVideoId && item.youtubeVideoId && item.youtubeVideoId.length === 11) {
          const isValid = await verifyYouTubeThumbnail(item.youtubeVideoId);
          if (isValid) {
            confirmedVideoId = item.youtubeVideoId;
          }
        }

        // 3. If still unresolved, resolve via YouTube live search
        if (!confirmedVideoId) {
          const resolved = await resolveYouTubeVideoId(queryTerm);
          if (resolved) {
            confirmedVideoId = resolved;
          }
        }

        // 4. Fetch official album artwork if not already in catalog
        if (!officialArt) {
          const art = await fetchOfficialArtwork(`${film ? film + ' ' : ''}${title}`);
          if (art) {
            officialArt = art;
          }
        }

        // 5. Construct dependable URLs with multi-tier fallback
        const primaryThumbnail = confirmedVideoId
          ? `https://i.ytimg.com/vi/${confirmedVideoId}/hqdefault.jpg`
          : (officialArt || '/images/retro_cassette_fallback.jpg');

        const ytUrl = confirmedVideoId
          ? `https://www.youtube.com/watch?v=${confirmedVideoId}`
          : `https://www.youtube.com/results?search_query=${encodeURIComponent(queryTerm)}`;

        return {
          title,
          film: catalogMatch ? catalogMatch.film : film,
          singers: catalogMatch ? catalogMatch.singers : singers,
          musicDirector: item.musicDirector || catalogMatch?.musicDirector || '',
          vibe: item.vibe || catalogMatch?.vibe || 'Vintage Romantic Cassette',
          famousLyric: item.famousLyric || catalogMatch?.famousLyric || 'Purane gaane, feelings naye...',
          youtubeSearchQuery: queryTerm,
          youtubeVideoId: confirmedVideoId,
          thumbnail: primaryThumbnail,
          artworkFallback: officialArt || '/images/retro_cassette_fallback.jpg',
          defaultFallback: '/images/retro_cassette_fallback.jpg',
          url: ytUrl
        };
      })
    );
  };

  if (!ai) {
    // If API key is not present, return curated matching fallback songs
    const filtered = VERIFIED_SONG_CATALOG.filter(s =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.film.toLowerCase().includes(query.toLowerCase()) ||
      s.singers.toLowerCase().includes(query.toLowerCase()) ||
      s.famousLyric.toLowerCase().includes(query.toLowerCase()) ||
      s.vibe.toLowerCase().includes(query.toLowerCase())
    );
    const results = filtered.length > 0 ? filtered : VERIFIED_SONG_CATALOG.slice(0, 4);
    const enriched = await enrichSongs(results);
    return res.json({
      query,
      results: enriched,
      source: 'curated-vault'
    });
  }

  try {
    const prompt = `You are the chief music archivist for "Cassette Wala Pyaar", a nostalgic Bollywood retro cassette tape website celebrating 1990s and classic Indian romantic music.
The user is searching for songs with the query: "${query}".

Identify 4 to 6 most accurate, relevant Hindi/Bollywood film songs matching this search.
The query might be:
- Exact song title (e.g. "Pehla Nasha", "Dil Deewana", "Tu Hi Meri Shab Hai")
- Singer name (e.g. "Kumar Sanu", "Kishore Kumar", "S.P. Balasubrahmanyam", "Arijit Singh", "Ankit Tiwari", "Alka Yagnik", "Udit Narayan")
- Actor or era (e.g. "Salman Khan Maine Pyar Kiya", "Shah Rukh Khan 90s romantic", "Aamir Khan 90s")
- Partial lyrics (e.g. "chura ke dil mera", "ek ladki ko dekha", "mere rang mein rangne wali")
- Mood or feeling (e.g. "rainy heartbreak", "college love letter", "dholak shaadi duet")

For EACH song, return:
- title: Exact standard song title (e.g. "Mere Rang Mein Rangne Wali")
- film: Film name and release year in parentheses (e.g. "Maine Pyar Kiya (1989)")
- singers: Actual playback singers accurately preserved (e.g. "S.P. Balasubrahmanyam", "Arijit Singh", "Kumar Sanu", "Ankit Tiwari")
- musicDirector: Music composer(s) (e.g. "Raamlaxman", "Mithoon", "Jatin-Lalit")
- vibe: A short, poetic nostalgic vibe tag (under 5 words, e.g. "First Love in Rain", "Salman 90s Prem", "Adhoori Mohabbat 💔")
- famousLyric: One memorable line from the lyrics in Romanized Hinglish
- youtubeSearchQuery: Accurate YouTube search query for the official original video (e.g. "Mere Rang Mein Rangne Wali Maine Pyar Kiya video song")
- youtubeVideoId: Standard YouTube video ID if known with high confidence, or empty string.

Respond strictly with a JSON array conforming to the schema.`;

    // Try reliable Flash models
    let rawText = '';
    const modelsToTry = ['gemini-flash-latest', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout calling model ${model}`)), 6000)
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
    const enriched = await enrichSongs(parsed);

    return res.json({
      query,
      results: enriched,
      source: 'gemini-ai'
    });
  } catch (error: any) {
    console.error('[Gemini] Search error:', error);
    // Graceful fallback to verified database if Gemini fails
    const filtered = VERIFIED_SONG_CATALOG.filter(s =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.film.toLowerCase().includes(query.toLowerCase()) ||
      s.singers.toLowerCase().includes(query.toLowerCase()) ||
      s.famousLyric.toLowerCase().includes(query.toLowerCase())
    );
    const results = filtered.length > 0 ? filtered : VERIFIED_SONG_CATALOG.slice(0, 4);
    const enriched = await enrichSongs(results);

    return res.json({
      query,
      results: enriched,
      source: 'curated-vault-fallback',
      warning: 'Gemini service temporarily busy; showing verified vintage tape recommendations'
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

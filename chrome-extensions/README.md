# Nova Chrome Extensions

4 free Chrome extensions that replace popular paid/freemium tools, monetized with ads.

## Extensions

### 1. NovaGrammar — Free Grammarly Alternative
**Replaces:** Grammarly Premium ($12/month)  
**Location:** `nova-grammar/`

**Features:**
- Grammar, spelling & style checking via LanguageTool API (free, no key needed)
- Inline fix suggestions — click to apply
- Context menu: right-click selected text → "Check with NovaGrammar"
- Word count, error count stats
- Check selected text on any webpage
- Auto-saves your text between sessions

**Ad placement:** 360×60 banner in popup header

---

### 2. NovaTab — Free Momentum Alternative
**Replaces:** Momentum Plus ($3.33/month)  
**Location:** `nova-tab/`

**Features:**
- Live clock (12hr) + date display
- Real-time weather via open-meteo.com (free, no API key)
- Animated starfield background
- Pomodoro focus timer (25/5/15 min modes)
- Daily inspirational quotes (15 built-in, rotating)
- Todo list with localStorage persistence
- Daily focus goal input
- Quick links (Gmail, Calendar, Drive, GitHub, YouTube)

**Ad placement:** 728×50 leaderboard banner at page bottom

---

### 3. NovaRecorder — Free Loom Alternative
**Replaces:** Loom Business ($8/month)  
**Location:** `nova-recorder/`

**Features:**
- Record: Full screen, current tab, window, or webcam
- No time limits (Loom free = 5 min max)
- No watermarks
- Audio + microphone support
- Quality selector (1080p / 720p / 480p)
- Auto-downloads as `.webm` when stopped
- Recording history panel (last 10 recordings)
- Live recording timer + file size display

**Ad placement:** 340×60 banner in popup header

---

### 4. NovaAI — Free Monica/Sider Alternative
**Replaces:** Monica AI ($9/month), Sider AI ($7/month), HARPA AI  
**Location:** `nova-ai/`

**Features:**
- **Summarize tab:** Summarize page, extract key points, TL;DR, explain simply
- **Chat tab:** AI chat with page context awareness
- **Translate tab:** Free translation via LibreTranslate, AI fallback
- **Write tab:** AI-generated emails, LinkedIn posts, tweets, blog intros, cover letters
- Context menu integration (right-click → Summarize/Explain/Translate)
- Configurable API endpoint (Ollama local or OpenAI-compatible)

**Ad placement:** Full-width banner in popup header

---

## Installation (Developer Mode)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **"Load unpacked"**
4. Select the extension folder (e.g., `nova-grammar/`)
5. Repeat for each extension

## Generating Icons

Icons are auto-generated with `generate_icons.py` (Python 3, no dependencies):
```bash
cd chrome-extensions/
python3 generate_icons.py
```

## Ad Integration

Each extension has placeholder ad slots. To monetize:

1. Create a [Google AdSense](https://adsense.google.com) account
2. Create ad units sized for each slot (see above)
3. Replace the `<a class="ad-slot">` placeholder with your AdSense `<ins>` code
4. For extension ads, consider [CodeFuel](https://www.codefuel.com) or [Adtelligent](https://adtelligent.com) which specialize in browser extension monetization

> **Note:** Google AdSense standard display ads may not work inside extension popups due to iframe restrictions. Use extension-specific ad networks or a custom ad server for best results.

## Revenue Model

| Extension | Users needed for $1k/mo | Est. RPM |
|-----------|--------------------------|----------|
| NovaTab | ~50k DAU | $20 |
| NovaGrammar | ~100k DAU | $10 |
| NovaRecorder | ~20k DAU | $50 |
| NovaAI | ~30k DAU | $35 |

*RPM = Revenue per 1000 impressions*

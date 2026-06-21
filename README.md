# Scholarship Journey — SJ Interview Portal

A fully automated, AI-driven video interview platform for screening AI and ML internship candidates. Built with React, Netlify Functions, Groq (free Llama 3.3 70B), and Netlify Blobs storage.

---

## Tech Stack

| Layer | Technology | Cost |
|---|---|---|
| Frontend | React + Vite | Free |
| Hosting | Netlify Free Tier | Free |
| AI API | Groq — Llama 3.3 70B | Free |
| Storage | Netlify Blobs | Free |
| Voice Input | Web Speech API (browser built-in) | Free |
| Voice Output | Web Speech Synthesis API (browser built-in) | Free |

**Total running cost: $0**

---

## Features

- Email whitelist — only invited candidates can access the interview
- Single attempt per email — no retakes
- 20-minute auto-ending interview with graceful AI wrap-up
- AI interviewer (Alex Chen) powered by Llama 3.3 70B via Groq
- Dynamic follow-up counter-questions when candidates mention projects
- Live speech recognition (microphone) with text fallback
- AI interviewer speaks using browser Text-to-Speech
- Silent anti-cheat: tab switching and window blur detection
- Post-interview star rating and LinkedIn share call-to-action
- Admin panel to add/manage candidate emails
- Glassmorphism 3D design with Scholarship Journey brand colors

---

## Step 1: Get a Free Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Create a free account
3. Click **API Keys** in the left menu
4. Click **Create API Key**
5. Copy the key — it starts with `gsk_`

Groq free tier limits (more than enough for 100 applicants):
- 14,400 requests per day
- 500,000 tokens per day on Llama 3.3 70B
- 100 applicants using ~4,000 tokens each = 400,000 tokens total

---

## Step 2: Deploy to Netlify

### 2a. Push to GitHub

```bash
cd scholarship-interview
git init
git add .
git commit -m "Initial commit — SJ Interview Portal"
```

Create a new repository on GitHub (private recommended), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/sj-interview.git
git push -u origin main
```

### 2b. Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **Add new site** → **Import an existing project**
3. Choose **GitHub** and select your repository
4. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Click **Deploy site**

### 2c. Add Environment Variables

In Netlify dashboard: **Site configuration** → **Environment variables** → **Add a variable**

| Key | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq API key (`gsk_...`) |
| `ADMIN_SECRET_KEY` | Choose a strong secret (e.g., `SJ@Admin2025!`) |

After adding variables, go to **Deploys** and click **Trigger deploy** to redeploy.

---

## Step 3: Set Up Your Subdomain

You want the portal at `interview.scholarshipjourney.pk`.

### 3a. Add custom domain in Netlify

1. In Netlify dashboard: **Domain management** → **Add a domain**
2. Enter `interview.scholarshipjourney.pk`
3. Click **Verify** then **Add domain**
4. Netlify will show you a value to add as a CNAME record

### 3b. Add DNS record at your domain registrar

Log into wherever `scholarshipjourney.pk` is managed (e.g., Namecheap, GoDaddy, Hostinger) and add:

```
Type:  CNAME
Host:  interview
Value: your-netlify-site-name.netlify.app
TTL:   3600 (or Auto)
```

DNS propagation takes 5 to 30 minutes. Netlify also provisions an SSL certificate automatically (free via Let's Encrypt).

### 3c. WordPress iframe (optional)

If you want to embed the tool on a WordPress page instead of using the subdomain directly, create a page and add this HTML block:

```html
<iframe
  src="https://interview.scholarshipjourney.pk"
  width="100%"
  height="850"
  frameborder="0"
  allow="camera; microphone"
  allowfullscreen
  style="border-radius: 12px; border: none;"
></iframe>
```

The `allow="camera; microphone"` attribute is required for the browser to pass camera and mic permissions into the iframe.

---

## Step 4: Add Candidate Emails

Before sending invites, add the candidate emails to the whitelist.

### Option A: Admin Panel (recommended)

Open `https://interview.scholarshipjourney.pk/?admin=true` in your browser, enter your `ADMIN_SECRET_KEY`, paste the emails (one per line), and click Add.

### Option B: API call with curl

```bash
curl -X POST https://interview.scholarshipjourney.pk/api/add-emails \
  -H "Content-Type: application/json" \
  -d '{
    "adminKey": "YOUR_ADMIN_SECRET_KEY",
    "emails": [
      "candidate1@gmail.com",
      "candidate2@gmail.com",
      "candidate3@outlook.com"
    ]
  }'
```

Expected response:
```json
{ "success": true, "added": 3, "skipped": 0, "total": 3 }
```

---

## Step 5: Send Invites

Send this email to each candidate (recommended batch of 10 at a time):

---

**Subject:** Your AI Interview Invitation — Scholarship Journey AI and ML Internship

Hi [Name],

We are excited to invite you to the next stage of our AI and ML Internship selection process.

You have been selected to complete a 20-minute AI-powered screening interview. The interview is conducted by Alex, our AI recruiter, who will ask you 4 to 5 technical questions about machine learning, Python, computer vision, and real-world AI projects.

**Your interview link:** https://interview.scholarshipjourney.pk

**Before you start:**
- Use the email address this invitation was sent to — it is tied to your access
- You get exactly one attempt
- Make sure your camera and microphone are working
- Use Google Chrome or Microsoft Edge for best results
- Find a quiet place with a stable internet connection

The link is active now. You can start at any time.

Good luck!

The Scholarship Journey Team

---

## Local Development

```bash
# Install dependencies
npm install

# Install Netlify CLI globally
npm install -g netlify-cli

# Log into Netlify
netlify login

# Create a .env file from the template
cp .env.example .env
# Then fill in your GROQ_API_KEY and ADMIN_SECRET_KEY

# Run local dev server (runs Vite + Netlify Functions together)
netlify dev
```

The app will be at `http://localhost:8888`

The admin panel is at `http://localhost:8888/?admin=true`

---

## Project Structure

```
scholarship-interview/
├── netlify/
│   └── functions/
│       ├── check-email.js        # Validates email whitelist
│       ├── chat.js               # Groq AI conversation endpoint
│       ├── complete-interview.js # Marks interview as done
│       ├── add-emails.js         # Admin: add emails to whitelist
│       └── submit-review.js      # Stores post-interview ratings
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # Stage manager
│   ├── index.css                 # Global styles
│   └── components/
│       ├── EmailGate.jsx         # Step 1: email check
│       ├── Instructions.jsx      # Step 2: rules + permissions
│       ├── Interview.jsx         # Step 3: the actual interview
│       ├── PostInterview.jsx     # Step 4: thank you + share
│       └── AdminPanel.jsx        # Admin: manage whitelist
├── index.html
├── package.json
├── vite.config.js
├── netlify.toml
└── .env.example
```

---

## Browser Support

| Browser | Voice Input | Voice Output |
|---|---|---|
| Chrome (recommended) | Full support | Full support |
| Edge | Full support | Full support |
| Safari (iOS 17+) | Full support | Full support |
| Firefox | Text fallback | Full support |

If speech recognition is not available (Firefox desktop), a text input box appears automatically so the candidate can still type their answers.

---

## Anti-Cheat Details

The system silently monitors:
- Tab switching (document visibility change events)
- Window losing focus (window blur events)

After 3 or more violations, the candidate is silently flagged as `disqualified: true` in the Netlify Blobs record. They are not told about this. The interview continues normally so they do not know they have been flagged. You can check the flag by reading the Blobs record.

---

## Checking Results

To view stored data, go to your Netlify dashboard:
**Site** → **Blobs** → Select the `sj-interview-whitelist` or `sj-interview-reviews` store.

Each record is stored under the candidate's email address and contains:

```json
{
  "allowed": true,
  "used": true,
  "inProgress": false,
  "addedAt": "2025-06-01T10:00:00.000Z",
  "startedAt": "2025-06-02T14:30:00.000Z",
  "completedAt": "2025-06-02T14:50:00.000Z",
  "disqualified": false
}
```

---

## Groq Free Tier Usage Estimate

| Metric | Value |
|---|---|
| Tokens per interview | ~4,000 |
| 100 applicants | ~400,000 tokens |
| Groq daily free limit | 500,000 tokens |
| API calls per interview | ~15 |
| Groq daily request limit | 14,400 |
| Recommended batch | 10 per day |

Running 10 interviews per day gives you all 100 done in 10 days, well within all free limits.

---

## Troubleshooting

**Camera or mic not working**
Make sure the browser has permissions. In Chrome, click the lock icon in the address bar and set both Camera and Microphone to Allow.

**"Email not whitelisted" even after adding it**
Wait 30 seconds and try again. Netlify Blobs writes are eventually consistent. Also double-check the email is exactly the same including case (all stored lowercase).

**AI not responding**
Check that `GROQ_API_KEY` is correctly set in Netlify environment variables and that the site was redeployed after adding it.

**Functions not running locally**
Make sure you ran `netlify dev` and not `npm run dev`. The `netlify dev` command runs both Vite and the serverless functions together.

**Speech not being recognised**
Try Chrome or Edge. If the browser blocks the mic, the text input fallback will appear automatically.

---

## LinkedIn Details

Update the LinkedIn page URL in `src/components/PostInterview.jsx`:

```js
const LINKEDIN_PAGE = 'https://www.linkedin.com/company/scholarship-journey-pk'
```

Replace `scholarship-journey-pk` with your actual LinkedIn company page slug.

---

Built for Scholarship Journey — Empowering Pakistani students to access world-class education.

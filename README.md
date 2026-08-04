# Who Am I? - Bible Quiz Game

A browser-based, real-time multiplayer Bible quiz game focused on identity guessing ("Who Am I?" format). Players join private rooms and compete by guessing biblical characters or places based on progressively revealed clues.

## Tech Stack

- **Player app**: React 18 + Vite + Tailwind CSS (PWA)
- **Admin app**: React 18 + Vite + Tailwind CSS (separate PWA on `admin.*`)
- **Backend**: Node.js 20 + Express + Socket.io
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (player + admin frontends) + Railway (backend)

## Project Structure

```
whoami/
├── client/          # Player PWA (whoami.example.com)
├── admin/           # Admin PWA (admin.whoami.example.com)
├── server/          # Node.js backend + REST + Socket.io
└── package.json     # Root workspace config
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Supabase account

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up Supabase:
   - Install Supabase CLI: `npm install -g supabase`
   - Create a new Supabase project (or use existing)
   - Link your project: `cd server && supabase link --project-ref your-project-ref`
   - Run migrations: `supabase db push` (or `supabase migrate up` for local)
   - Configure Supabase Auth (email/password) in Supabase dashboard
   - Note your project URL and service role key

4. Configure environment variables:

   **Player** (`client/.env`):
   ```
   VITE_SOCKET_URL=http://localhost:3001
   VITE_ADMIN_URL=http://localhost:5174
   # Optional: Cloudflare Web Analytics (production)
   # VITE_CF_ANALYTICS_TOKEN=your_cf_beacon_token
   ```

   **Admin** (`admin/.env`):
   ```
   VITE_SOCKET_URL=http://localhost:3001
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   **Server** (`server/.env`):
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   PORT=3001
   CLIENT_ORIGIN=http://localhost:5173
   CLIENT_ORIGINS=http://localhost:5173,http://localhost:5174
   ```

5. Seed dev data (optional):
   ```bash
   cd server
   node src/scripts/seed.js
   ```

6. Add admin user:
   - Sign in at http://localhost:5174/login to create your Supabase user
   - Then add yourself as admin:
   ```bash
   cd server
   node src/scripts/addAdmin.js your-email@example.com
   ```

### Development

```bash
# Terminal 1: Player app
npm run dev:client

# Terminal 2: Admin app
npm run dev:admin

# Terminal 3: Backend
npm run dev:server
```

- Player: http://localhost:5173
- Admin: http://localhost:5174
- Backend: http://localhost:3001

Legacy `/admin/*` URLs on the player app redirect to the admin app (using `VITE_ADMIN_URL`).

### Production deploy

- **Vercel project 1** — root directory `client`, domain `whoami.example.com`
- **Vercel project 2** — root directory `admin`, domain `admin.whoami.example.com`
- **Railway** — `server/`, set `CLIENT_ORIGINS` to both production frontend URLs

Install the admin PWA from `admin.*` (Add to Home Screen) for standalone admin access on mobile.

## Features

- Private, code-based rooms
- Real-time multiplayer gameplay
- Server-authoritative timing and scoring
- Reconnection with grace period
- Difficulty modes with backfill logic
- Admin dashboard (datasets, entities, bulk import)

## License

MIT

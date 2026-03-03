# Who Am I? - Bible Quiz Game

A browser-based, real-time multiplayer Bible quiz game focused on identity guessing ("Who Am I?" format). Players join private rooms and compete by guessing biblical characters or places based on progressively revealed clues.

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js 20 + Express + Socket.io
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (frontend) + Railway (backend)

## Project Structure

```
whoami/
├── client/          # React frontend
│   ├── src/
│   │   ├── pages/   # Route pages
│   │   ├── components/
│   │   ├── hooks/
│   │   └── context/
│   └── package.json
├── server/          # Node.js backend
│   ├── src/
│   │   ├── rooms/   # Room management
│   │   ├── game/    # Game logic
│   │   ├── sockets/ # Socket.io handlers
│   │   └── db/      # Database queries
│   └── package.json
└── package.json     # Root workspace config
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
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
   - Configure Supabase Auth (email + Google OAuth) in Supabase dashboard
   - Note your project URL and service role key

4. Configure environment variables:
   - Copy `.env.example` to `.env` (if it exists) or create `.env` files:
   - **Client** (`client/.env`):
     ```
     VITE_SOCKET_URL=http://localhost:3001
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - **Server** (`server/.env`):
     ```
     SUPABASE_URL=your_supabase_url
     SUPABASE_SERVICE_KEY=your_supabase_service_role_key
     PORT=3001
     CLIENT_ORIGIN=http://localhost:5173
     ```

5. Seed dev data (optional):
   ```bash
   cd server
   node src/scripts/seed.js
   ```

6. Add admin user:
   - First, sign in to the admin dashboard at `/admin/login` to create your user account
   - Then add yourself as admin:
   ```bash
   cd server
   node src/scripts/addAdmin.js your-email@example.com
   ```

### Development

Run both client and server in development mode:

```bash
# Terminal 1: Frontend
npm run dev:client

# Terminal 2: Backend
npm run dev:server
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Features

- ✅ Private, code-based rooms
- ✅ Real-time multiplayer gameplay
- ✅ Server-authoritative timing and scoring
- ✅ Reconnection with grace period
- ✅ Difficulty modes with backfill logic
- ✅ Admin dashboard (coming soon)

## License

MIT

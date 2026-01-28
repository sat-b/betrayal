# Betrayal Game

A multiplayer social deduction game where players must choose to cooperate or betray each round. Built with React, PartyKit, and WebRTC.

## Tech Stack

- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Backend**: PartyKit (Cloudflare Workers-based real-time server)
- **Voice Chat**: WebRTC mesh with PartyKit signaling

## Game Rules

- Each round, choose to **Cooperate** or **Betray**
- If everyone cooperates: +2 points each
- Lone betrayer gets +5, cooperators get -2
- Multiple betrayers: +1 each, cooperators get -3

### Optional Bonuses
- **Streak Bonus**: +2 for cooperating 3+ rounds in a row when everyone cooperates
- **Revenge Bonus**: +1 per player who betrayed you last round but cooperates now

## Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Running Locally

```bash
# Run both Vite and PartyKit dev servers
npm run dev

# Or run them separately
npm run dev:vite      # Frontend on http://localhost:5173
npm run dev:partykit  # PartyKit on http://localhost:1999
```

> **Note for Windows users**: PartyKit dev server may have issues on Windows. You can still develop the frontend with `npm run dev:vite` and deploy PartyKit to production for testing.

### Building

```bash
npm run build
```

## Deployment

### PartyKit (Backend)

```bash
npx partykit deploy
```

This deploys to `betrayal-game.{your-username}.partykit.dev`

### Vercel (Frontend)

1. Connect your repo to Vercel
2. Set environment variable: `VITE_PARTYKIT_HOST=betrayal-game.{your-username}.partykit.dev`
3. Deploy

## Project Structure

```
betrayal-game/
├── src/
│   ├── client/               # React frontend
│   │   ├── components/       # UI components
│   │   ├── hooks/            # React hooks
│   │   ├── lib/              # Utilities
│   │   └── types.ts          # TypeScript types
│   └── server/
│       └── room.ts           # PartyKit game server
├── partykit.json             # PartyKit config
└── vite.config.ts            # Vite config
```

## Features

- 2-5 players per room
- Configurable round timer (5-20 seconds)
- Configurable total rounds (5-50)
- Real-time voice chat via WebRTC
- Awards at game end:
  - Most Trusted
  - Most Evil
  - Biggest Swing
  - Kingmaker

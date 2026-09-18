# Poker Bankroll Tracker

A local React/Vite bankroll tracker for a home poker game.

## Features
- Select 4, 5, 6, or 7 players when starting a game.
- Enter the same starting bankroll for every player.
- Rename players during the game.
- Enter bets per player and collect them into the pot.
- Award the full pot to a selected winner.
- Automatically mark players as bankrupt once their balance reaches ₹0.
- Automatically ends the game when only one active player remains.
- Shows total completed rounds.
- Keeps round history with post-round balances for every player.
- Persists the game in browser `localStorage`, so refreshing the page keeps the game state.

## Run locally

```bash
npm install
npm run dev
```

Then open the localhost URL shown by Vite, usually `http://localhost:5173`.

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  RotateCcw,
  Trophy,
  WalletCards,
  Plus,
  Minus,
  History,
  ShieldCheck,
  AlertTriangle,
  Users,
} from 'lucide-react';
import './styles.css';

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 7;
const DEFAULT_PLAYER_COUNT = 4;
const STORAGE_KEY = 'poker-bankroll-state';

const makePlayers = (count, amount = 500) =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Player ${index + 1}`,
    balance: Number(amount) || 0,
    eliminated: false,
  }));

const blankBets = (players) =>
  Object.fromEntries(players.map((player) => [player.id, '']));

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function App() {
  const [started, setStarted] = useState(false);
  const [playerCount, setPlayerCount] = useState(DEFAULT_PLAYER_COUNT);
  const [initialAmount, setInitialAmount] = useState(500);
  const [players, setPlayers] = useState(makePlayers(DEFAULT_PLAYER_COUNT));
  const [bets, setBets] = useState(blankBets(players));
  const [roundPot, setRoundPot] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [history, setHistory] = useState([]);
  const [winnerId, setWinnerId] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const state = JSON.parse(saved);
      if (typeof state.started === 'boolean') setStarted(state.started);
      if (Number.isFinite(Number(state.initialAmount))) setInitialAmount(Number(state.initialAmount));
      if (Array.isArray(state.players) && state.players.length >= MIN_PLAYERS && state.players.length <= MAX_PLAYERS) {
        setPlayers(state.players);
        setPlayerCount(state.players.length);
        setBets(state.bets && typeof state.bets === 'object' ? state.bets : blankBets(state.players));
      }
      if (typeof state.roundPot === 'number') setRoundPot(state.roundPot);
      if (typeof state.roundNumber === 'number') setRoundNumber(state.roundNumber);
      if (Array.isArray(state.history)) setHistory(state.history);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        started,
        playerCount,
        initialAmount,
        players,
        bets,
        roundPot,
        roundNumber,
        history,
      }),
    );
  }, [started, playerCount, initialAmount, players, bets, roundPot, roundNumber, history]);

  const activePlayers = useMemo(
    () => players.filter((player) => !player.eliminated),
    [players],
  );
  const eliminatedCount = players.length - activePlayers.length;
  const totalMoney = useMemo(
    () => players.reduce((sum, player) => sum + player.balance, 0) + roundPot,
    [players, roundPot],
  );
  const potExpected = Object.values(bets).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
  const gameOver = activePlayers.length <= 1 && started;

  function startGame(event) {
    event?.preventDefault();
    const amount = Number(initialAmount);

    if (!amount || amount <= 0) {
      setNotice('Enter a valid starting amount.');
      return;
    }

    const count = Number(playerCount);
    const nextPlayers = makePlayers(count, amount);
    setPlayers(nextPlayers);
    setBets(blankBets(nextPlayers));
    setRoundPot(0);
    setRoundNumber(1);
    setHistory([]);
    setWinnerId('');
    setStarted(true);
    setNotice(`Game started with ${count} players. Add bets for Round 1.`);
  }

  function changeBet(id, value) {
    if (value !== '' && !/^\d*(\.\d{0,2})?$/.test(value)) return;

    const num = Number(value);
    const player = players.find((p) => p.id === id);

    if (player && num > player.balance) {
      setNotice(`${player.name} only has ${money(player.balance)} available.`);
      return;
    }

    setBets((current) => ({ ...current, [id]: value }));
    setNotice('');
  }

  function commitBets() {
    let total = 0;
    const deductions = {};

    for (const player of players) {
      const bet = Number(bets[player.id]) || 0;
      if (bet < 0 || bet > player.balance) {
        setNotice(`${player.name} cannot bet more than their current balance.`);
        return;
      }
      deductions[player.id] = bet;
      total += bet;
    }

    if (total <= 0) {
      setNotice('Add at least one bet before collecting the pot.');
      return;
    }

    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        balance: +(player.balance - deductions[player.id]).toFixed(2),
      })),
    );
    setRoundPot((pot) => +(pot + total).toFixed(2));
    setBets(blankBets(players));
    setNotice(`${money(total)} added to the pot.`);
  }

  function awardWinner() {
    const winner = players.find((player) => player.id === Number(winnerId));

    if (!winner) {
      setNotice('Select the winner first.');
      return;
    }

    if (roundPot <= 0) {
      setNotice('The pot is empty. Add bets before awarding the winner.');
      return;
    }

    const amount = roundPot;
    const nextPlayers = players.map((player) =>
      player.id === winner.id
        ? { ...player, balance: +(player.balance + amount).toFixed(2) }
        : player,
    );
    const finalizedPlayers = nextPlayers.map((player) => ({
      ...player,
      eliminated:
        player.balance <= 0 && player.id !== winner.id ? true : player.eliminated,
    }));
    const bankruptNames = finalizedPlayers
      .filter((player) => player.eliminated && !players.find((p) => p.id === player.id)?.eliminated)
      .map((player) => player.name);

    setPlayers(finalizedPlayers);
    setHistory((current) => [
      {
        round: roundNumber,
        winner: winner.name,
        pot: amount,
        balances: finalizedPlayers.map((player) => ({
          id: player.id,
          name: player.name,
          balance: player.balance,
          eliminated: player.eliminated,
        })),
      },
      ...current,
    ]);
    setRoundPot(0);
    setBets(blankBets(finalizedPlayers));
    setWinnerId('');
    setRoundNumber((number) => number + 1);

    setNotice(
      `${winner.name} won ${money(amount)}.${
        bankruptNames.length
          ? ` ${bankruptNames.join(', ')} ${bankruptNames.length === 1 ? 'is' : 'are'} bankrupt.`
          : ''
      }`,
    );
  }

  function resetGame() {
    if (!window.confirm('Reset the current game and clear all rounds?')) return;

    localStorage.removeItem(STORAGE_KEY);
    const resetPlayers = makePlayers(DEFAULT_PLAYER_COUNT, Number(initialAmount) || 500);
    setStarted(false);
    setPlayerCount(DEFAULT_PLAYER_COUNT);
    setPlayers(resetPlayers);
    setBets(blankBets(resetPlayers));
    setRoundPot(0);
    setRoundNumber(1);
    setHistory([]);
    setWinnerId('');
    setNotice('');
  }

  return (
    <div className="app-shell">
      <div className="ambient a1" />
      <div className="ambient a2" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <WalletCards size={22} />
          </div>
          <div>
            <h1>Poker Bankroll</h1>
            <p>Simple bankroll tracking for your home game</p>
          </div>
        </div>
        <div className="top-actions">
          <div className="stat-pill">
            <span>Rounds</span>
            <strong>{history.length}</strong>
          </div>
          <button className="ghost-btn" onClick={resetGame}>
            <RotateCcw size={17} /> Reset
          </button>
        </div>
      </header>

      {!started ? (
        <main className="setup-wrap">
          <section className="setup-card">
            <div className="setup-icon">
              <ShieldCheck size={28} />
            </div>
            <h2>Build your poker table</h2>
            <p>
              Choose 4–7 players and set the same starting bankroll for everyone.
              Player names can be changed after the game starts.
            </p>

            <form onSubmit={startGame}>
              <label>Number of players</label>
              <div className="player-counts" role="group" aria-label="Number of players">
                {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, index) => {
                  const count = MIN_PLAYERS + index;
                  return (
                    <button
                      type="button"
                      key={count}
                      className={`count-btn ${Number(playerCount) === count ? 'selected' : ''}`}
                      onClick={() => setPlayerCount(count)}
                      aria-pressed={Number(playerCount) === count}
                    >
                      {count}
                    </button>
                  );
                })}
              </div>

              <label>Starting bankroll per player</label>
              <div className="money-input">
                <span>₹</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={initialAmount}
                  onChange={(event) => setInitialAmount(event.target.value)}
                />
              </div>

              <div className="player-preview">
                {makePlayers(Number(playerCount), Number(initialAmount) || 0).map((player, index) => (
                  <div key={player.id}>
                    <span className="seat">{index + 1}</span>
                    {player.name}
                    <strong>{money(Number(initialAmount) || 0)}</strong>
                  </div>
                ))}
              </div>

              <button className="primary-btn full-width" type="submit">
                Start {playerCount}-Player Game <span>→</span>
              </button>
            </form>
          </section>
        </main>
      ) : (
        <main className="content">
          <section className="hero-row">
            <div>
              <div className="eyebrow">ROUND {roundNumber}</div>
              <h2>Manage the table</h2>
              <p>Enter bets, collect the pot, then award it to the winner.</p>
            </div>
            <div className="game-status">
              {gameOver ? (
                <>
                  <AlertTriangle size={18} /> Game over
                </>
              ) : (
                <>
                  <span className="live-dot" /> Live
                </>
              )}
            </div>
          </section>

          {notice && <div className="notice">{notice}</div>}

          <section className="summary-grid">
            <div className="summary">
              <span>Total rounds</span>
              <strong>{history.length}</strong>
              <small>Completed rounds</small>
            </div>
            <div className="summary">
              <span>Current pot</span>
              <strong>{money(roundPot)}</strong>
              <small>{potExpected > 0 ? `${money(potExpected)} ready to collect` : 'Waiting for bets'}</small>
            </div>
            <div className="summary">
              <span>Players active</span>
              <strong>
                {activePlayers.length}/{players.length}
              </strong>
              <small>
                {eliminatedCount
                  ? `${eliminatedCount} eliminated`
                  : 'Everyone is in'}
              </small>
            </div>
            <div className="summary">
              <span>Money in play</span>
              <strong>{money(totalMoney)}</strong>
              <small>Pot + player balances</small>
            </div>
          </section>

          <section className="table-card">
            <div className="card-head">
              <div>
                <h3>
                  <Users size={19} /> Player balances
                </h3>
                <span>Use the bet field to deduct money from each player.</span>
              </div>
              <button className="secondary-btn" onClick={commitBets} disabled={gameOver}>
                <Plus size={17} /> Collect bets into pot
              </button>
            </div>

            <div className="players-grid">
              {players.map((player, index) => (
                <article
                  className={`player-card ${player.eliminated ? 'eliminated' : ''}`}
                  key={player.id}
                >
                  <div className="player-top">
                    <div className="avatar">{index + 1}</div>
                    <div className="player-name-wrap">
                      <input
                        className="name-input"
                        value={player.name}
                        onChange={(event) =>
                          setPlayers((current) =>
                            current.map((item) =>
                              item.id === player.id
                                ? { ...item, name: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <span>{player.eliminated ? 'BANKRUPT' : 'ACTIVE'}</span>
                    </div>
                    <Trophy className="muted-icon" size={18} />
                  </div>

                  <div className="balance-label">Current balance</div>
                  <div className="balance">{money(player.balance)}</div>

                  <div className="bet-row">
                    <label>Bet this round</label>
                    <div className="bet-box">
                      <span>₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        disabled={player.eliminated}
                        value={bets[player.id] ?? ''}
                        onChange={(event) => changeBet(player.id, event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          changeBet(
                            player.id,
                            String(Math.max(0, Number(bets[player.id] || 0) - 10)),
                          )
                        }
                        disabled={player.eliminated}
                        aria-label={`Decrease ${player.name} bet`}
                      >
                        <Minus size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          changeBet(
                            player.id,
                            String(
                              Math.min(
                                player.balance,
                                Number(bets[player.id] || 0) + 10,
                              ),
                            ),
                          )
                        }
                        disabled={player.eliminated}
                        aria-label={`Increase ${player.name} bet`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {player.eliminated && (
                    <div className="bankrupt-note">Bankrupt — this player is out.</div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="action-card">
            <div>
              <div className="card-kicker">SETTLE ROUND {roundNumber}</div>
              <h3>
                <Trophy size={20} /> Award the pot
              </h3>
              <p>Choose who won the hand. The entire current pot goes to that player.</p>
            </div>
            <div className="settle-controls">
              <select
                value={winnerId}
                onChange={(event) => setWinnerId(event.target.value)}
                disabled={roundPot <= 0 || gameOver}
              >
                <option value="">Select winner…</option>
                {activePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} — {money(player.balance)}
                  </option>
                ))}
              </select>
              <button
                className="primary-btn"
                onClick={awardWinner}
                disabled={roundPot <= 0 || !winnerId || gameOver}
              >
                Award {money(roundPot)} <Trophy size={17} />
              </button>
            </div>
          </section>

          <section className="history-card">
            <div className="card-head">
              <div>
                <h3>
                  <History size={19} /> Round history
                </h3>
                <span>Every completed hand is saved in this browser.</span>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="empty">No completed rounds yet.</div>
            ) : (
              <div className="history-list">
                {history.map((round) => (
                  <div className="history-row" key={round.round}>
                    <div className="round-chip">R{round.round}</div>
                    <div>
                      <strong>{round.winner}</strong>
                      <span>won the pot</span>
                    </div>
                    <b>{money(round.pot)}</b>
                    <div className="mini-balances">
                      {round.balances.map((balance) => (
                        <span key={balance.id}>
                          {balance.name}: {money(balance.balance)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      )}

      <footer>All data stays in your browser via localStorage. No accounts or internet connection required.</footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);

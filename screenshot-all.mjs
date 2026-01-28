import puppeteer from 'puppeteer';
import fs from 'fs';

// Create a mock page that renders all components
const mockHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Betrayal Game - Mock Screens</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            cooperate: { DEFAULT: '#22c55e', dark: '#16a34a' },
            betray: { DEFAULT: '#ef4444', dark: '#dc2626' },
          }
        }
      }
    }
  </script>
  <style>
    body { background: #0f172a; color: white; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="lobby" class="min-h-screen p-4 flex flex-col items-center">
    <div class="w-full max-w-md space-y-6">
      <div class="text-center">
        <h1 class="text-3xl font-bold mb-2">Betrayal Game</h1>
        <div class="flex items-center justify-center gap-2">
          <span class="text-slate-400">Room Code:</span>
          <button class="text-2xl font-mono font-bold bg-slate-800 px-4 py-2 rounded-lg">XK7M</button>
        </div>
      </div>

      <div class="bg-slate-800/50 rounded-xl p-4">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Players (3/5)</h2>
        <div class="space-y-2">
          <div class="flex items-center justify-between p-3 rounded-lg bg-slate-700 ring-2 ring-blue-500">
            <div class="flex items-center gap-3">
              <div class="w-6 text-center text-slate-400 font-mono">#1</div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">Alice</span>
                  <span class="text-xs text-blue-400">(You)</span>
                  <span class="text-xs text-amber-400">👑</span>
                </div>
                <div class="text-xs text-green-400">✓ Ready</div>
              </div>
            </div>
            <span class="font-bold text-lg">0</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-6 text-center text-slate-400 font-mono">#2</div>
              <div>
                <span class="font-medium">Bob</span>
                <div class="text-xs text-green-400">✓ Ready</div>
              </div>
            </div>
            <span class="font-bold text-lg">0</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-6 text-center text-slate-400 font-mono">#3</div>
              <div>
                <span class="font-medium">Charlie</span>
                <div class="text-xs text-slate-500">Not ready</div>
              </div>
            </div>
            <span class="font-bold text-lg">0</span>
          </div>
        </div>
      </div>

      <button class="w-full py-4 rounded-xl font-semibold text-lg bg-slate-700 text-slate-500">
        Waiting for Players...
      </button>

      <div class="bg-slate-800/30 rounded-xl p-4 text-sm text-slate-400">
        <h3 class="font-semibold mb-2">How to Play</h3>
        <ul class="space-y-1 list-disc list-inside">
          <li>Each round, choose to Cooperate or Betray</li>
          <li>If everyone cooperates: +2 points each</li>
          <li>Lone betrayer gets +5, cooperators get -2</li>
          <li>Multiple betrayers: +1 each, cooperators get -3</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
`;

const gameHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            cooperate: { DEFAULT: '#22c55e', dark: '#16a34a' },
            betray: { DEFAULT: '#ef4444', dark: '#dc2626' },
          }
        }
      }
    }
  </script>
  <style>
    body { background: #0f172a; color: white; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div class="min-h-screen p-4">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <span class="text-slate-400">Room</span>
          <span class="ml-2 font-mono font-bold">XK7M</span>
        </div>
        <div class="text-center">
          <div class="text-sm text-slate-400">Round</div>
          <div class="text-2xl font-bold">5 / 20</div>
        </div>
        <div class="w-20"></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-slate-800 rounded-2xl p-6 flex flex-col items-center gap-6">
            <div class="text-center">
              <div class="text-6xl font-bold tabular-nums">7</div>
              <div class="text-sm text-slate-400 uppercase tracking-wider">seconds</div>
            </div>

            <div class="flex flex-col items-center gap-4">
              <div class="flex gap-4">
                <button class="w-32 h-32 rounded-2xl text-xl font-bold bg-cooperate ring-4 ring-cooperate/50 shadow-lg shadow-cooperate/30">
                  <div class="text-4xl mb-1">🤝</div>
                  <div>Cooperate</div>
                </button>
                <button class="w-32 h-32 rounded-2xl text-xl font-bold bg-slate-700 hover:bg-slate-600">
                  <div class="text-4xl mb-1">🗡️</div>
                  <div>Betray</div>
                </button>
              </div>
              <button class="px-8 py-3 rounded-xl font-semibold text-lg bg-amber-500 text-black">
                🔓 Lock In
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="bg-slate-800 rounded-xl p-4">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Leaderboard</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-2">
                  <span class="w-6 text-center">🥇</span>
                  <span>Bob</span>
                </div>
                <span class="font-bold tabular-nums">12</span>
              </div>
              <div class="flex items-center justify-between py-1 text-blue-400">
                <div class="flex items-center gap-2">
                  <span class="w-6 text-center">🥈</span>
                  <span class="font-semibold">Alice (You)</span>
                </div>
                <span class="font-bold tabular-nums">8</span>
              </div>
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-2">
                  <span class="w-6 text-center">🥉</span>
                  <span>Charlie</span>
                </div>
                <span class="font-bold tabular-nums">4</span>
              </div>
            </div>
          </div>

          <div class="bg-slate-800 rounded-xl p-4">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Rounds</h3>
            <div class="space-y-2">
              <div class="flex items-center gap-3 text-sm">
                <span class="text-slate-500 w-8">R4</span>
                <div class="flex gap-1">
                  <span class="px-2 py-0.5 rounded text-xs bg-cooperate/20 text-cooperate">Ali</span>
                  <span class="px-2 py-0.5 rounded text-xs bg-betray/20 text-betray">Bob</span>
                  <span class="px-2 py-0.5 rounded text-xs bg-cooperate/20 text-cooperate">Cha</span>
                </div>
                <span class="text-slate-500 ml-auto">1 betrayer</span>
              </div>
              <div class="flex items-center gap-3 text-sm">
                <span class="text-slate-500 w-8">R3</span>
                <div class="flex gap-1">
                  <span class="px-2 py-0.5 rounded text-xs bg-cooperate/20 text-cooperate">Ali</span>
                  <span class="px-2 py-0.5 rounded text-xs bg-cooperate/20 text-cooperate">Bob</span>
                  <span class="px-2 py-0.5 rounded text-xs bg-cooperate/20 text-cooperate">Cha</span>
                </div>
                <span class="text-slate-500 ml-auto">✨ All cooperated</span>
              </div>
            </div>
          </div>

          <button class="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-lg">
            <span>🎤</span>
            <span>Enable Voice Chat</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const revealHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            cooperate: { DEFAULT: '#22c55e', dark: '#16a34a' },
            betray: { DEFAULT: '#ef4444', dark: '#dc2626' },
          }
        }
      }
    }
  </script>
  <style>
    body { background: #0f172a; color: white; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div class="min-h-screen p-4">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <div>
          <span class="text-slate-400">Room</span>
          <span class="ml-2 font-mono font-bold">XK7M</span>
        </div>
        <div class="text-center">
          <div class="text-sm text-slate-400">Round</div>
          <div class="text-2xl font-bold">5 / 20</div>
        </div>
        <div class="w-20"></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <div class="bg-slate-800 rounded-2xl p-6">
            <h2 class="text-xl font-bold text-center mb-4">Round 5 Results</h2>
            <div class="text-center mb-4">
              <div class="text-2xl text-red-400">🗡️ A Lone Betrayer!</div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-700">
                <div class="flex items-center gap-3">
                  <div class="w-6 text-center text-slate-400 font-mono">#1</div>
                  <span class="font-medium">Bob</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-8 h-8 flex items-center justify-center rounded-full text-lg bg-betray/20 text-betray">🗡️</span>
                  <div class="flex items-center gap-2 min-w-[80px] justify-end">
                    <span class="text-sm font-medium text-green-400">+5</span>
                    <span class="font-bold text-lg tabular-nums">17</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-700 ring-2 ring-blue-500">
                <div class="flex items-center gap-3">
                  <div class="w-6 text-center text-slate-400 font-mono">#2</div>
                  <span class="font-medium">Alice <span class="text-xs text-blue-400">(You)</span></span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-8 h-8 flex items-center justify-center rounded-full text-lg bg-cooperate/20 text-cooperate">🤝</span>
                  <div class="flex items-center gap-2 min-w-[80px] justify-end">
                    <span class="text-sm font-medium text-red-400">-2</span>
                    <span class="font-bold text-lg tabular-nums">6</span>
                  </div>
                </div>
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-800">
                <div class="flex items-center gap-3">
                  <div class="w-6 text-center text-slate-400 font-mono">#3</div>
                  <span class="font-medium">Charlie</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="w-8 h-8 flex items-center justify-center rounded-full text-lg bg-cooperate/20 text-cooperate">🤝</span>
                  <div class="flex items-center gap-2 min-w-[80px] justify-end">
                    <span class="text-sm font-medium text-red-400">-2</span>
                    <span class="font-bold text-lg tabular-nums">2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="bg-slate-800 rounded-xl p-4">
            <h3 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Leaderboard</h3>
            <div class="space-y-2">
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-2">
                  <span class="w-6 text-center">🥇</span>
                  <span>Bob</span>
                </div>
                <span class="font-bold tabular-nums">17</span>
              </div>
              <div class="flex items-center justify-between py-1 text-blue-400">
                <div class="flex items-center gap-2">
                  <span class="w-6 text-center">🥈</span>
                  <span class="font-semibold">Alice (You)</span>
                </div>
                <span class="font-bold tabular-nums">6</span>
              </div>
              <div class="flex items-center justify-between py-1">
                <div class="flex items-center gap-2">
                  <span class="w-6 text-center">🥉</span>
                  <span>Charlie</span>
                </div>
                <span class="font-bold tabular-nums">2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const endHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background: #0f172a; color: white; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
  <div class="min-h-screen p-4 flex flex-col items-center justify-center">
    <div class="w-full max-w-md space-y-8">
      <div class="text-center">
        <div class="text-6xl mb-4">👑</div>
        <h1 class="text-3xl font-bold mb-2">Game Over!</h1>
        <div class="text-xl">
          <span class="text-amber-400 font-bold">Bob</span>
          <span class="text-slate-400"> wins with </span>
          <span class="text-amber-400 font-bold">42</span>
          <span class="text-slate-400"> points!</span>
        </div>
      </div>

      <div class="bg-slate-800 rounded-xl p-4">
        <h2 class="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Final Standings</h2>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
            <div class="flex items-center gap-3">
              <span class="text-2xl text-amber-400">🥇</span>
              <span class="font-medium">Bob</span>
            </div>
            <span class="text-2xl font-bold tabular-nums">42</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-blue-500/20 ring-1 ring-blue-500">
            <div class="flex items-center gap-3">
              <span class="text-2xl text-slate-300">🥈</span>
              <span class="font-medium">Alice <span class="text-blue-400">(You)</span></span>
            </div>
            <span class="text-2xl font-bold tabular-nums">28</span>
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg bg-slate-700/50">
            <div class="flex items-center gap-3">
              <span class="text-2xl text-amber-600">🥉</span>
              <span class="font-medium">Charlie</span>
            </div>
            <span class="text-2xl font-bold tabular-nums">15</span>
          </div>
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="text-lg font-semibold text-center">Awards</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-slate-800 rounded-xl p-4 text-center">
            <div class="text-3xl mb-1">🕊️</div>
            <div class="font-semibold text-blue-400">Most Trusted</div>
            <div class="text-lg font-bold mt-1">Alice</div>
            <div class="text-xs text-slate-500 mt-1">Highest cooperation score</div>
          </div>
          <div class="bg-slate-800 rounded-xl p-4 text-center">
            <div class="text-3xl mb-1">😈</div>
            <div class="font-semibold text-red-400">Most Evil</div>
            <div class="text-lg font-bold mt-1">Bob</div>
            <div class="text-xs text-slate-500 mt-1">Betrayed the most cooperators</div>
          </div>
          <div class="bg-slate-800 rounded-xl p-4 text-center">
            <div class="text-3xl mb-1">📈</div>
            <div class="font-semibold text-amber-400">Biggest Swing</div>
            <div class="text-lg font-bold mt-1">Bob</div>
            <div class="text-xs text-slate-500 mt-1">Largest single-round change</div>
          </div>
          <div class="bg-slate-800 rounded-xl p-4 text-center">
            <div class="text-3xl mb-1">👑</div>
            <div class="font-semibold text-purple-400">Kingmaker</div>
            <div class="text-lg font-bold mt-1">Charlie</div>
            <div class="text-xs text-slate-500 mt-1">Most impact on others' scores</div>
          </div>
        </div>
      </div>

      <div class="bg-slate-800/50 rounded-xl p-4 text-center">
        <div class="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div class="text-2xl font-bold">20</div>
            <div class="text-slate-400">Rounds</div>
          </div>
          <div>
            <div class="text-2xl font-bold">8</div>
            <div class="text-slate-400">All Cooperated</div>
          </div>
          <div>
            <div class="text-2xl font-bold">15</div>
            <div class="text-slate-400">Total Betrayals</div>
          </div>
        </div>
      </div>

      <button class="w-full py-4 rounded-xl font-semibold text-lg bg-amber-500 text-black">
        Play Again
      </button>
    </div>
  </div>
</body>
</html>
`;

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 400, height: 850, deviceScaleFactor: 2 });

// Lobby screen
await page.setContent(mockHtml);
await page.waitForNetworkIdle();
await page.screenshot({ path: 'screenshot-lobby.png' });
console.log('Lobby screenshot saved');

// Game screen
await page.setContent(gameHtml);
await page.waitForNetworkIdle();
await page.screenshot({ path: 'screenshot-game.png' });
console.log('Game screenshot saved');

// Reveal screen
await page.setContent(revealHtml);
await page.waitForNetworkIdle();
await page.screenshot({ path: 'screenshot-reveal.png' });
console.log('Reveal screenshot saved');

// End screen
await page.setViewport({ width: 400, height: 1100, deviceScaleFactor: 2 });
await page.setContent(endHtml);
await page.waitForNetworkIdle();
await page.screenshot({ path: 'screenshot-end.png' });
console.log('End screenshot saved');

await browser.close();
console.log('All screenshots complete!');

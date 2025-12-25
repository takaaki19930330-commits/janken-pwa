// src/algorithms.js
// Prediction & scoring utilities for janken-pwa
// - Implements: Laplace smoothing, recent exponential weighting, transition model,
//   epsilon-greedy exploration, hybrid expected/winrate scoring.
// - Exported functions:
//    - defaultOptions()
//    - computeStatsFromHistory(records, opts)
//    - predictOpponentDistribution(history, opts, context)
//    - recommendHand(history, opts, context)
//
// Notes:
// - records: array of { date, hand, result, createdAt }
// - hand values: "✊", "✌️", "✋"
// - result values: "勝ち","あいこ","負け"
// - recommended defaults: laplace=1, lambda=0.25, alpha=0.7, epsilon=0.05

const SCORE = { "勝ち": 40, "あいこ": 20, "負け": 10 };
const HANDS = ["✊","✌️","✋"];

function defaultOptions() {
  return {
    laplace: 1,
    lambda: 0.25,       // recency decay factor (higher -> more recent weight)
    alpha: 0.7,         // blend: alpha * expected_value + (1-alpha) * winrate_score
    epsilon: 0.05,      // exploration probability
    useTransitionIfEnough: 3, // if history length >= this, use transition model preferentially
  };
}

// helper: exponential weight based on age (ms->days)
function ageWeight(createdAt, lambda) {
  const now = Date.now();
  const ms = now - (createdAt || now);
  const days = ms / (1000*60*60*24);
  return Math.exp(-lambda * days);
}

// compute per-hand counts and transition counts with Laplace smoothing
function computeCounts(history = [], opts = {}) {
  const { laplace = 1, lambda = 0.25 } = opts;
  const counts = { "✊": laplace, "✌️": laplace, "✋": laplace };
  const weightedCounts = { "✊": laplace, "✌️": laplace, "✋": laplace };
  const transition = {
    "✊": { "✊": laplace, "✌️": laplace, "✋": laplace },
    "✌️": { "✊": laplace, "✌️": laplace, "✋": laplace },
    "✋": { "✊": laplace, "✌️": laplace, "✋": laplace }
  };
  for (let i=0;i<history.length;i++){
    const r = history[i];
    const h = r.hand;
    if (!h || !counts[h]) continue;
    counts[h] = (counts[h] || 0) + 1;
    const w = ageWeight(r.createdAt, lambda);
    weightedCounts[h] = (weightedCounts[h] || 0) + w;
    if (i>0){
      const prev = history[i-1].hand;
      if (transition[prev]) {
        transition[prev][h] = (transition[prev][h] || 0) + 1;
      }
    }
  }
  return { counts, weightedCounts, transition };
}

// predict opponent distribution by frequency (unweighted) or recent (weighted)
function predictByFrequency(history, opts = { laplace:1 }) {
  const { counts } = computeCounts(history, opts);
  const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
  const dist = {};
  for (const h of HANDS) dist[h] = (counts[h]||0) / total;
  return dist;
}

function predictByRecentWeighted(history, opts = { lambda:0.25, laplace:1 }) {
  const { weightedCounts } = computeCounts(history, opts);
  const total = Object.values(weightedCounts).reduce((a,b)=>a+b,0) || 1;
  const dist = {};
  for (const h of HANDS) dist[h] = (weightedCounts[h]||0) / total;
  return dist;
}

// predict by transition model: P(next | prev)
function predictByTransition(history, opts = { laplace:1 }) {
  const { transition } = computeCounts(history, opts);
  const dist = { "✊":0,"✌️":0,"✋":0 };
  if (!history || history.length === 0) {
    // fallback to frequency
    return predictByFrequency(history, opts);
  }
  const prev = history[history.length - 1].hand;
  const row = transition[prev] || transition["✊"];
  const total = Object.values(row).reduce((a,b)=>a+b,0) || 1;
  for (const h of HANDS) dist[h] = (row[h]||0) / total;
  return dist;
}

// compute winrate for each our-hand given distribution over opponent hands
function expectedScoresFromDist(dist) {
  // returns { bestHand, bestExpected, scores: {hand:exp} }
  const scores = {};
  for (const our of HANDS) {
    let exp = 0;
    for (const opp of HANDS) {
      const p = dist[opp] || 0;
      exp += scoreFor(our, opp) * p;
    }
    scores[our] = exp;
  }
  let bestHand = HANDS[0], best = scores[bestHand];
  for (const h of HANDS) if (scores[h] > best) { best = scores[h]; bestHand = h; }
  return { bestHand, bestExpected: best, scores };
}

function scoreFor(ourHand, oppHand) {
  if (ourHand === oppHand) return SCORE["あいこ"];
  // rules: ✊ beats ✌️, ✌️ beats ✋, ✋ beats ✊
  if ((ourHand==="✊" && oppHand==="✌️") || (ourHand==="✌️" && oppHand==="✋") || (ourHand==="✋" && oppHand==="✊")) return SCORE["勝ち"];
  return SCORE["負け"];
}

// combine methods: predictive distribution = mixture/hierarchy
function predictOpponentDistribution(history, opts = {}) {
  const { epsilon = 0.05, lambda = 0.25, laplace=1, useTransitionIfEnough=3 } = opts;
  // if enough history and transition preferred, use transition; otherwise weighted recent
  let dist;
  if (history.length >= useTransitionIfEnough) {
    dist = predictByTransition(history, opts);
  } else {
    dist = predictByRecentWeighted(history, opts);
  }
  // exploration: with epsilon probability, return uniform distribution
  if (Math.random() < (epsilon || 0)) {
    return { "✊":1/3, "✌️":1/3, "✋":1/3 };
  }
  return dist;
}

// compute recommendation (hand to play) given history and options
function recommendHand(history, opts = {}) {
  const options = Object.assign(defaultOptions(), opts || {});
  // produce opponent distribution
  const dist = predictOpponentDistribution(history, options);
  const expectedData = expectedScoresFromDist(dist); // bestHand, bestExpected
  // compute winrate-like score fallback: use observed win rate per hand in history
  const wins = { "✊":0,"✌️":0,"✋":0 }, counts = { "✊":0,"✌️":0,"✋":0 };
  for (const r of history) {
    if (!r.hand) continue;
    counts[r.hand] = (counts[r.hand]||0) + 1;
    if (r.result === "勝ち") wins[r.hand] = (wins[r.hand]||0) + 1;
  }
  const winRates = {};
  for (const h of HANDS) winRates[h] = counts[h] ? (wins[h]/counts[h]) : 0;
  // convert winRates to score-like scale (0..max score)
  const maxScore = Math.max(SCORE["勝ち"], SCORE["あいこ"], SCORE["負け"]);
  const winScore = {};
  for (const h of HANDS) winScore[h] = winRates[h] * maxScore;

  // combined score = alpha * expected + (1-alpha) * winScore
  const alpha = options.alpha != null ? options.alpha : 0.7;
  const combined = {};
  for (const h of HANDS) {
    combined[h] = alpha * expectedData.scores[h] + (1-alpha) * winScore[h];
  }
  // choose argmax, but incorporate epsilon-greedy exploration
  const epsilon = options.epsilon || 0;
  if (Math.random() < epsilon) {
    // random choice
    const idx = Math.floor(Math.random() * HANDS.length);
    return { hand: HANDS[idx], reason: "explore", dist, expected: expectedData.scores, combined };
  }
  // pick max combined
  let best = HANDS[0];
  for (const h of HANDS) if (combined[h] > combined[best]) best = h;
  return { hand: best, reason: "exploit", dist, expected: expectedData.scores, combined };
}

// compute some useful stats from history for UI (avg score, cumulative avg, per-day)
function computeStatsFromHistory(history = [], opts = {}) {
  // returns { cumulativeByDay: [{date, cumAvg}], expectedBaseline, perHandStats }
  const scoreMap = { "勝ち": SCORE["勝ち"], "あいこ": SCORE["あいこ"], "負け": SCORE["負け"] };
  // ensure sorted by createdAt ascending
  const sorted = (history || []).slice().sort((a,b)=> (a.createdAt||0) - (b.createdAt||0));
  const daily = {};
  for (const r of sorted) {
    const d = r.date || new Date(r.createdAt).toISOString().slice(0,10);
    const v = scoreMap[r.result] || 0;
    if (!daily[d]) daily[d] = { sum:0, count:0 };
    daily[d].sum += v;
    daily[d].count += 1;
  }
  const days = Object.keys(daily).sort();
  const cumulative = [];
  let cumSum = 0, cumCount = 0;
  for (const d of days) {
    cumSum += daily[d].sum;
    cumCount += daily[d].count;
    const cumAvg = cumCount ? Math.round((cumSum / cumCount) * 100) / 100 : 0;
    cumulative.push({ date: d, cumAvg, dayAvg: daily[d].count ? (daily[d].sum/daily[d].count) : 0 });
  }
  const expectedBaseline = (SCORE["勝ち"] + SCORE["あいこ"] + SCORE["負け"]) / 3;
  // per-hand stats
  const perHand = {};
  for (const h of HANDS) perHand[h] = { count:0, win:0, draw:0, loss:0, avg:0 };
  for (const r of sorted) {
    const h = r.hand;
    if (!perHand[h]) continue;
    perHand[h].count++;
    if (r.result === "勝ち") perHand[h].win++;
    else if (r.result === "あいこ") perHand[h].draw++;
    else if (r.result === "負け") perHand[h].loss++;
  }
  for (const h of HANDS) {
    const s = perHand[h];
    const totalScore = (s.win * SCORE["勝ち"]) + (s.draw * SCORE["あいこ"]) + (s.loss * SCORE["負け"]);
    s.avg = s.count ? Math.round((totalScore / s.count) * 100) / 100 : 0;
  }
  return { cumulative, expectedBaseline, perHand };
}

module.exports = {
  defaultOptions,
  computeCounts,
  predictByFrequency,
  predictByRecentWeighted,
  predictByTransition,
  predictOpponentDistribution,
  recommendHand,
  computeStatsFromHistory,
  SCORE,
  HANDS
};

// scripts/backtest.js
// Usage: node scripts/backtest.js data/records.json
// Produces a ranked list of parameter combinations by avg expected score.

const fs = require('fs');
const path = require('path');
const alg = require('../src/algorithms.js');

function loadRecords(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw || "[]");
}
function normalize(records) {
  return records.map(r=>{
    const rec = Object.assign({}, r);
    if (rec.createdAt && typeof rec.createdAt === 'string' && !isNaN(Date.parse(rec.createdAt))) rec.createdAt = new Date(rec.createdAt).getTime();
    if (!rec.createdAt) rec.createdAt = Date.now();
    if (!rec.date) rec.date = new Date(rec.createdAt).toISOString().slice(0,10);
    return rec;
  }).sort((a,b)=>a.createdAt - b.createdAt);
}

function evaluateConfig(records, opts) {
  // sequential simulation: at step t predict next using history up to t-1, choose recommended hand,
  // compute score vs actual, accumulate average.
  let totalScore = 0;
  let n = 0;
  for (let i=1;i<records.length;i++){
    const history = records.slice(0,i);
    const next = records[i];
    const rec = alg.recommendHand(history, opts);
    // rec.hand is our chosen hand
    // compute score we would get vs next.hand
    function scoreFor(our, opp) {
      if (our === opp) return alg.SCORE["あいこ"];
      if ((our==="✊" && opp==="✌️") || (our==="✌️" && opp==="✋") || (our==="✋" && opp==="✊")) return alg.SCORE["勝ち"];
      return alg.SCORE["負け"];
    }
    const s = scoreFor(rec.hand, next.hand);
    totalScore += s;
    n++;
  }
  return n ? totalScore / n : 0;
}

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: node scripts/backtest.js data/records.json");
    process.exit(1);
  }
  const file = path.resolve(arg);
  if (!fs.existsSync(file)) { console.error("file not found:", file); process.exit(1); }
  const raw = loadRecords(file);
  const records = normalize(raw);

  // parameter grid (small, extendable)
  const lambdas = [0.01, 0.05, 0.1, 0.25, 0.5];
  const alphas = [0.2, 0.5, 0.7, 0.9];
  const epsilons = [0, 0.02, 0.05];
  const laplaces = [1]; // keep laplace=1 for now
  const results = [];

  for (const lambda of lambdas) for (const alpha of alphas) for (const eps of epsilons) for (const lap of laplaces) {
    const opts = { lambda, alpha, epsilon: eps, laplace: lap, useTransitionIfEnough: 3 };
    const score = evaluateConfig(records, opts);
    results.push({ opts, score });
  }

  results.sort((a,b)=>b.score - a.score);
  console.log("Top 10 configurations:");
  results.slice(0,10).forEach((r,i)=> {
    console.log(`${i+1}. score=${Math.round(r.score*100)/100}  lambda=${r.opts.lambda}  alpha=${r.opts.alpha}  eps=${r.opts.epsilon}`);
  });
  console.log("Full results count:", results.length);
}

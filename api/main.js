// Deno Deploy endpoint for Wortsel community stats
const kv = await Deno.openKv();

const json = (obj, status = 200) =>
	new Response(JSON.stringify(obj), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});

const ALLOW_ORIGINS = new Set([
	"https://tehes.github.io", // production (GitHub Pages)
	"http://127.0.0.1:5500", // local dev (uncomment if needed)
	"https://faz-sta.fastconnect.ai", // FAZ DEV
	"https://www.testfaz.net", // FAZ TEST
	"https://www.faz.net", // FAZ PROD
]);

const isAllowedOrigin = (req) => {
	const origin = req.headers.get("origin");
	return origin ? ALLOW_ORIGINS.has(origin) : false;
};

const withCORS = (req, res) => {
	const origin = req.headers.get("origin") || "";
	const allow = ALLOW_ORIGINS.has(origin) ? origin : "https://tehes.github.io";
	const h = new Headers(res.headers);
	h.set("Access-Control-Allow-Origin", allow);
	h.set("Vary", "Origin");
	h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	h.set("Access-Control-Allow-Headers", "Content-Type");
	return new Response(res.body, { status: res.status, headers: h });
};

// Normalize to keep Ä/Ö/Ü stable and uppercase
const norm = (s) => (s ?? "").toString().trim().toUpperCase().normalize("NFC");

let curatedWords = [];
let curatedWordsError = null;
try {
	const { default: curatedRaw } = await import(
		"https://tehes.github.io/wortsel/data/curated_words.json",
		{
			with: { type: "json" },
		}
	);
	const normalized = new Set();
	for (const entry of curatedRaw) {
		const word = norm(entry);
		if (word && word.length === 5) normalized.add(word);
	}
	curatedWords = [...normalized];
} catch (e) {
	curatedWordsError = e;
	console.error("Unable to import curated words list", e);
}

const PATTERN_SIZE = 243;
const POW3 = [1, 3, 9, 27, 81];

const clampScore = (value) => {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(100, value));
};

const computePatternCode = (guess, solution) => {
	const tempSolution = solution.split("");
	const result = [0, 0, 0, 0, 0];

	for (let i = 0; i < 5; i++) {
		if (guess[i] === tempSolution[i]) {
			result[i] = 2;
			tempSolution[i] = "";
		}
	}

	for (let i = 0; i < 5; i++) {
		if (result[i] !== 0) continue;
		const index = tempSolution.indexOf(guess[i]);
		if (index !== -1) {
			result[i] = 1;
			tempSolution[index] = "";
		}
	}

	let code = 0;
	for (let i = 0; i < 5; i++) {
		code += result[i] * POW3[i];
	}

	return code;
};

const decodePatternCode = (code, out) => {
	let value = code;
	for (let i = 0; i < 5; i++) {
		out[i] = value % 3;
		value = (value / 3) | 0;
	}
};

const buildHardModeConstraints = (guesses, patterns, turnIndex) => {
	const greens = ["", "", "", "", ""];
	const yellowBans = [new Set(), new Set(), new Set(), new Set(), new Set()];
	const yellowLetters = new Set();
	const grayLetters = new Set();
	const pattern = [0, 0, 0, 0, 0];

	for (let i = 0; i < turnIndex; i++) {
		const guess = guesses[i];
		decodePatternCode(patterns[i], pattern);
		for (let j = 0; j < 5; j++) {
			const letter = guess[j];
			const status = pattern[j];
			if (status === 2) {
				greens[j] = letter;
			} else if (status === 1) {
				yellowLetters.add(letter);
				yellowBans[j].add(letter);
			} else {
				grayLetters.add(letter);
			}
		}
	}

	for (const letter of yellowLetters) {
		grayLetters.delete(letter);
	}
	for (let i = 0; i < 5; i++) {
		if (greens[i]) grayLetters.delete(greens[i]);
	}

	return { greens, yellowBans, yellowLetters, grayLetters };
};

const isCandidateAllowed = (word, constraints) => {
	const { greens, yellowBans, yellowLetters, grayLetters } = constraints;

	for (let i = 0; i < 5; i++) {
		const green = greens[i];
		if (green && word[i] !== green) return false;
		if (yellowBans[i].size && yellowBans[i].has(word[i])) return false;
	}

	for (const letter of yellowLetters) {
		if (word.indexOf(letter) === -1) return false;
	}

	for (const letter of grayLetters) {
		if (word.indexOf(letter) !== -1) return false;
	}

	return true;
};

const countBuckets = (remaining, guess, bucket) => {
	bucket.fill(0);
	for (let i = 0; i < remaining.length; i++) {
		const code = computePatternCode(guess, remaining[i]);
		bucket[code] += 1;
	}
};

const expectedRemaining = (bucket, n) => {
	let sum = 0;
	for (let i = 0; i < PATTERN_SIZE; i++) {
		const count = bucket[i];
		if (count) sum += count * count;
	}
	return sum / n;
};

const analyzeGame = (guesses, patterns, hardMode) => {
	let remaining = curatedWords.slice();
	const luckScores = [];
	const efficiencyScores = [];
	const bucket = new Uint16Array(PATTERN_SIZE);

	for (let i = 0; i < guesses.length; i++) {
		const guess = guesses[i];
		const observed = patterns[i];
		const n = remaining.length;

		if (!n) return { error: "no candidates" };

		countBuckets(remaining, guess, bucket);

		const myE = expectedRemaining(bucket, n);

		let minBucket = 0;
		for (let p = 0; p < PATTERN_SIZE; p++) {
			const count = bucket[p];
			if (count > 0 && (minBucket === 0 || count < minBucket)) {
				minBucket = count;
			}
		}

		let luck;
		if (myE === minBucket) {
			luck = 50;
		} else {
			luck = 100 * (myE - bucket[observed]) / (myE - minBucket);
		}
		luckScores.push(clampScore(luck));

		let candidates = curatedWords;
		if (hardMode) {
			const constraints = buildHardModeConstraints(guesses, patterns, i);
			candidates = curatedWords.filter((word) =>
				isCandidateAllowed(word, constraints)
			);
			if (!candidates.length) return { error: "no candidates" };
		}

		let bestE = Infinity;
		let worstE = -Infinity;
		for (let c = 0; c < candidates.length; c++) {
			countBuckets(remaining, candidates[c], bucket);
			const eCand = expectedRemaining(bucket, n);
			if (eCand < bestE) bestE = eCand;
			if (eCand > worstE) worstE = eCand;
		}

		let eff;
		if (bestE === worstE) {
			eff = 100;
		} else {
			eff = 100 * (worstE - myE) / (worstE - bestE);
		}
		efficiencyScores.push(clampScore(eff));

		remaining = remaining.filter(
			(solution) => computePatternCode(guess, solution) === observed,
		);
	}

	const average = (values) =>
		values.reduce((sum, value) => sum + value, 0) / values.length;

	return {
		E: Math.round(average(efficiencyScores)),
		L: Math.round(average(luckScores)),
	};
};

const totalFromValue = (value) => {
	const total = value?.total;
	return Number.isFinite(total) && total >= 0 ? total : 0;
};

const emptyDist = () => ({
	total: 0,
	counts: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "fail": 0 },
});

let cachedTotals = null; // Map(word -> total)
let totalsCachedAt = 0;
const TOTALS_TTL_MS = 60_000; // 60 Sekunden

async function getTotalsMap() {
	const now = Date.now();

	if (cachedTotals && (now - totalsCachedAt) < TOTALS_TTL_MS) {
		return cachedTotals;
	}

	const totals = new Map();
	for await (const entry of kv.list({ prefix: ["w"] })) {
		const w = String(entry.key?.[1] ?? "");
		if (w) totals.set(w, totalFromValue(entry.value));
	}

	cachedTotals = totals;
	totalsCachedAt = now;
	return totals;
}

const handlePreflight = (req) => {
	if (req.method !== "OPTIONS") return null;
	return withCORS(req, new Response(null, { status: 204 }));
};

const ensureCuratedAvailable = (req) => {
	if (!curatedWordsError && curatedWords.length > 0) return null;
	return withCORS(req, json({ error: "curated words unavailable" }, 503));
};

const getLeastPlayedWords = (totals) => {
	let minTotal = Infinity;
	const indices = [];

	for (let i = 0; i < curatedWords.length; i++) {
		const word = curatedWords[i];
		const total = totals.get(word) ?? 0;
		if (total < minTotal) {
			minTotal = total;
			indices.length = 0;
			indices.push(i);
		} else if (total === minTotal) {
			indices.push(i);
		}
	}

	const words = indices.map((idx) => curatedWords[idx]);
	return { words, minTotal };
};

Deno.serve(async (req) => {
	const url = new URL(req.url);

	// GET /next: Get the next word to play (the one with the lowest total count)
	if (url.pathname === "/next") {
		const preflight = handlePreflight(req);
		if (preflight) return preflight;
		if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

		const curatedError = ensureCuratedAvailable(req);
		if (curatedError) return curatedError;

		const totals = await getTotalsMap();
		const { words, minTotal } = getLeastPlayedWords(totals);

		if (words.length === 0) {
			console.error("No candidates found for /next");
			return withCORS(req, new Response(null, { status: 204 }));
		}

		const word = words[Math.floor(Math.random() * words.length)];
		return withCORS(req, json({ word, total: minTotal, candidates: words.length }));
	}

	// GET /next-batch: Get up to 50 least-played words (shuffled)
	if (url.pathname === "/next-batch") {
		const preflight = handlePreflight(req);
		if (preflight) return preflight;
		if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

		const curatedError = ensureCuratedAvailable(req);
		if (curatedError) return curatedError;

		const totals = await getTotalsMap();
		const { words, minTotal } = getLeastPlayedWords(totals);

		if (words.length === 0) {
			console.error("No candidates found for /next-batch");
			return withCORS(req, new Response(null, { status: 204 }));
		}

		for (let i = words.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = words[i];
			words[i] = words[j];
			words[j] = tmp;
		}

		const batch = words.slice(0, 50);
		return withCORS(req, json({ words: batch, total: minTotal, candidates: words.length }));
	}

	if (url.pathname === "/analyze") {
		const preflight = handlePreflight(req);
		if (preflight) return preflight;
		if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

		if (!isAllowedOrigin(req)) {
			return withCORS(req, json({ error: "origin not allowed" }, 403));
		}

		const ct = (req.headers.get("content-type") || "").toLowerCase();
		if (!ct.startsWith("application/json")) {
			return withCORS(req, json({ error: "content-type must be application/json" }, 415));
		}

		const curatedError = ensureCuratedAvailable(req);
		if (curatedError) return curatedError;

		const { guesses, patterns, hardMode } = await req.json().catch(() => ({}));

		if (!Array.isArray(guesses) || !Array.isArray(patterns)) {
			return withCORS(req, json({ error: "bad payload" }, 400));
		}

		if (guesses.length === 0 || guesses.length !== patterns.length) {
			return withCORS(req, json({ error: "bad payload" }, 400));
		}

		const normalizedGuesses = [];
		for (let i = 0; i < guesses.length; i++) {
			const guess = norm(guesses[i]);
			if (!guess || guess.length !== 5) {
				return withCORS(req, json({ error: "bad guess" }, 400));
			}
			normalizedGuesses.push(guess);
		}

		const normalizedPatterns = [];
		for (let i = 0; i < patterns.length; i++) {
			const pattern = Number(patterns[i]);
			if (!Number.isInteger(pattern) || pattern < 0 || pattern >= PATTERN_SIZE) {
				return withCORS(req, json({ error: "bad pattern" }, 400));
			}
			normalizedPatterns.push(pattern);
		}

		const result = analyzeGame(
			normalizedGuesses,
			normalizedPatterns,
			hardMode === true,
		);

		if (result.error) {
			return withCORS(req, json({ error: result.error }, 400));
		}

		return withCORS(req, json(result));
	}

	if (url.pathname !== "/stats") return new Response("Not found", { status: 404 });
	if (req.method === "OPTIONS") return withCORS(req, new Response(null, { status: 204 }));

	if (req.method === "POST") {
		// --- security: only accept writes from allowed frontends
		if (!isAllowedOrigin(req)) {
			return withCORS(req, json({ error: "origin not allowed" }, 403));
		}

		// --- enforce JSON to avoid simple cross-site form posts
		const ct = (req.headers.get("content-type") || "").toLowerCase();
		if (!ct.startsWith("application/json")) {
			return withCORS(req, json({ error: "content-type must be application/json" }, 415));
		}

		const { solution, attempts } = await req.json().catch(() => ({}));
		const SOL = norm(solution);
		if (!SOL || SOL.length !== 5) return withCORS(req, json({ error: "bad solution" }, 400));

		const bucket = ["1", "2", "3", "4", "5", "6"].includes(String(attempts))
			? String(attempts)
			: "fail";
		const key = ["w", SOL];

		let stats;
		let success = false;
		let retries = 0;
		const maxRetries = 10;

		while (!success && retries < maxRetries) {
			const current = await kv.get(key);
			const data = current.value ?? emptyDist();

			// Increment counters
			data.total += 1;
			data.counts[bucket] += 1;

			const now = new Date().toISOString();

			// Atomic compare-and-set
			const result = await kv.atomic()
				.check(current) // Fails if data changed between get() and now
				.set(key, data)
				.set(["meta", "lastUpdate"], now)
				.commit();

			if (result.ok) {
				stats = data;
				if (cachedTotals) {
					const prev = cachedTotals.get(SOL) ?? 0;
					cachedTotals.set(SOL, prev + 1);
				}
				success = true;
			} else {
				retries++;
				// Exponential backoff with jitter
				const delay = Math.min(100, Math.pow(2, retries) * 10) + Math.random() * 10;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		if (!success) {
			console.error(`Failed to update stats for ${SOL} after ${maxRetries} retries`);
			return withCORS(req, json({ error: "too much contention, try again" }, 503));
		}

		return withCORS(req, json({ ok: true, stats }));
	}

	// GET: Retrieve stats or dump all
	if (req.method === "GET") {
		// --- admin dump: https://wortsel.tehes.deno.net/stats?all=1
		if (url.searchParams.get("all")) {
			const entries = [];
			for await (const entry of kv.list({ prefix: ["w"] })) {
				entries.push({
					key: entry.key,
					value: entry.value,
				});
			}
			const meta = await kv.get(["meta", "lastUpdate"]);
			return withCORS(
				req,
				json({ count: entries.length, lastUpdate: meta.value ?? null, entries }),
			);
		}

		// --- normal single retrieval: https://wortsel.tehes.deno.net/stats?solution=FASER
		const SOL = norm(url.searchParams.get("solution"));
		if (!SOL || SOL.length !== 5) return withCORS(req, json({ error: "bad solution" }, 400));
		const r = await kv.get(["w", SOL]);
		const meta = await kv.get(["meta", "lastUpdate"]);
		return withCORS(
			req,
			json({
				...(r.value ?? emptyDist()),
				lastUpdate: meta.value ?? null,
			}),
		);
	}

	return new Response("Method not allowed", { status: 405 });
});


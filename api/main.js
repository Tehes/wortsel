// Deno Deploy endpoint for Wortsel community stats
const kv = await Deno.openKv();

const json = (obj, status = 200) =>
	new Response(JSON.stringify(obj), {
		status,
		headers: { "Content-Type": "application/json; charset=utf-8" },
	});

const ALLOW_ORIGINS = new Set([
	"https://tehes.github.io", // production (GitHub Pages)
	//"http://127.0.0.1:5500", // local dev (uncomment if needed)
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

const totalFromValue = (value) => {
	const total = value?.total;
	return Number.isFinite(total) && total >= 0 ? total : 0;
};

const emptyDist = () => ({
	total: 0,
	counts: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "fail": 0 },
});

Deno.serve(async (req) => {
	const url = new URL(req.url);

	// GET /next: Get the next word to play (the one with the lowest total count)
	if (url.pathname === "/next") {
		if (req.method === "OPTIONS") return withCORS(req, new Response(null, { status: 204 }));
		if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });

		if (curatedWordsError || curatedWords.length === 0) {
			return withCORS(req, json({ error: "curated words unavailable" }, 503));
		}

		// Build a totals map by streaming existing keys once
		const totals = new Map();
		for await (const entry of kv.list({ prefix: ["w"] })) {
			const w = String(entry.key?.[1] ?? "");
			if (w) totals.set(w, totalFromValue(entry.value));
		}

		// Determine least-played among all curated words (missing ⇒ 0)
		let minTotal = Infinity;
		const candidates = [];
		for (let i = 0; i < curatedWords.length; i++) {
			const w = curatedWords[i];
			const t = totals.get(w) ?? 0;
			if (t < minTotal) {
				minTotal = t;
				candidates.length = 0;
				candidates.push({ idx: i, total: t });
			} else if (t === minTotal) {
				candidates.push({ idx: i, total: t });
			}
		}

		if (candidates.length === 0) {
			console.error("No candidates found for /next");
			return withCORS(req, new Response(null, { status: 204 }));
		}

		const pick = candidates[Math.floor(Math.random() * candidates.length)];
		const word = curatedWords[pick.idx];
		return withCORS(req, json({ word, total: pick.total, candidates: candidates.length }));
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

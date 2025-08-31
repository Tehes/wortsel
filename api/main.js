// Deno Deploy endpoint for Wortsel community stats (plaintext keys)
const kv = await Deno.openKv();

const json = (obj, status = 200) =>
	new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

const withCORS = (res) => {
	const h = new Headers(res.headers);
	h.set("Access-Control-Allow-Origin", ALLOW_ORIGIN);
	h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
	h.set("Access-Control-Allow-Headers", "Content-Type");
	return new Response(res.body, { status: res.status, headers: h });
};

// Normalize to keep Ä/Ö/Ü stable and uppercase
const norm = (s) => (s ?? "").toString().trim().toUpperCase().normalize("NFC");
const emptyDist = () => ({
	total: 0,
	counts: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "fail": 0 },
});

Deno.serve(async (req) => {
	const url = new URL(req.url);
	if (url.pathname !== "/stats") return new Response("Not found", { status: 404 });
	if (req.method === "OPTIONS") return withCORS(new Response(null, { status: 204 }));

	if (req.method === "POST") {
		const { solution, attempts } = await req.json().catch(() => ({}));
		const SOL = norm(solution);
		if (!SOL || SOL.length !== 5) return withCORS(json({ error: "bad solution" }, 400));

		const bucket = ["1", "2", "3", "4", "5", "6"].includes(String(attempts))
			? String(attempts)
			: "fail";
		const key = ["w", SOL];

		const r = await kv.get(key);
		const data = r.value ?? emptyDist();
		data.total += 1;
		data.counts[bucket] += 1;

		await kv.set(key, data);
		return withCORS(json({ ok: true }));
	}

	if (req.method === "GET") {
		const SOL = norm(url.searchParams.get("solution"));
		if (!SOL || SOL.length !== 5) return withCORS(json({ error: "bad solution" }, 400));
		const r = await kv.get(["w", SOL]);
		return withCORS(json(r.value ?? emptyDist()));
	}

	return withCORS(new Response("Method not allowed", { status: 405 }));
});

const jsonUrl = new URL("../data/curated_words.json", import.meta.url);
const solutions = JSON.parse(await Deno.readTextFile(jsonUrl));

const words = solutions;

const freq = Object.create(null);
const posFreq = Array.from({ length: 5 }, () => Object.create(null));

for (const w of words) {
	const letters = [...w.toLowerCase()];
	const seen = new Set();
	letters.forEach((ch, i) => {
		posFreq[i][ch] = (posFreq[i][ch] || 0) + 1;
		if (!seen.has(ch)) {
			freq[ch] = (freq[ch] || 0) + 1;
			seen.add(ch);
		}
	});
}

const score = (w) => {
	const letters = [...w.toLowerCase()];
	const coverage = letters.reduce((a, c) => a + (freq[c] || 0), 0);
	const positional = letters.reduce((a, c, i) => a + (posFreq[i][c] || 0), 0);
	return coverage + 0.5 * positional;
};

const rankedRaw = words
	.filter((w) => new Set(w.toLowerCase()).size === 5)
	.map((w) => ({ w, s: score(w) }))
	.sort((a, b) => b.s - a.s);
const max = rankedRaw.length > 0 ? rankedRaw[0].s : 1;
const ranked = rankedRaw.map(({ w, s }) => ({
	w,
	score: max ? +((s / max) * 100).toFixed(2) : 0,
}));
console.table(ranked.slice(0, 25).map(({ w, score }) => ({ w, score })));

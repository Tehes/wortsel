/* --------------------------------------------------------------------------------------------------
 * Imports & data sources
 ---------------------------------------------------------------------------------------------------*/
import additionalWords from "../data/additional_words.json" with { type: "json" };
import curatedWords from "../data/curated_words.json" with { type: "json" };

/* --------------------------------------------------------------------------------------------------
 * DOM references
 ---------------------------------------------------------------------------------------------------*/
const gameBoardEl = document.querySelector("main");
const keyboardElement = document.querySelector("#keyboard");
const restartButtons = document.querySelectorAll(".restart");
const shareBtn = document.querySelector("#shareChallengeButton");
const rowElements = document.querySelectorAll(".row");
const modalElement = document.querySelector("aside.modal");
const headlineElement = document.querySelector("h1");
const howToIcon = document.querySelector("#howToIcon");
const howToSection = document.querySelector("#howTo");
const settingsIcon = document.querySelector("#settingsIcon");
const settingsSection = document.querySelector("#settings");
const statsSection = document.querySelector("#stats");
const resumeSection = document.querySelector("#resume");
const resumeContinueBtn = document.querySelector("#resume-continue");
const backdrop = document.querySelector(".backdrop");
const closeIcons = document.querySelectorAll(".close");
const wholeWordsCheckbox = document.querySelector("#wholeWords");

/* --------------------------------------------------------------------------------------------------
 * Settings
 ---------------------------------------------------------------------------------------------------*/
const hardModeCheckbox = document.querySelector("#hardMode");

wholeWordsCheckbox.checked = JSON.parse(
	localStorage.getItem("wortsel_wholeWords") || "true",
);

hardModeCheckbox.checked = JSON.parse(
	localStorage.getItem("wortsel_hardMode") || "false",
);

/* --------------------------------------------------------------------------------------------------
 * Game state (runtime)
 ---------------------------------------------------------------------------------------------------*/
let activeRow = 0;
let letterIndex = 0;
const firstVisit = JSON.parse(
	localStorage.getItem("wortsel_firstVisit") || "true",
);
let isGameOver = false; // blocks input

let lockedLetters = [null, null, null, null, null]; // fixed, correct letters carried over
// In hard mode, prevent reusing yellow letters at the same position
// Key: position index (0..4), Value: Set of letters banned at that position
let yellowBans = new Map();

const STATE_PREFIX = "wortsel_state::"; // per-word for Challenge saves
const CURRENT_KEY = "wortsel_current"; // exactly one non-challenge game
const STATE_TTL_DAYS = 7; // purge only Challenge saves

/* --------------------------------------------------------------------------------------------------
 * Dictionary and solution selection
 ---------------------------------------------------------------------------------------------------*/
const wordList = [...curatedWords, ...additionalWords];
const wordSet = new Set(wordList.map((w) => w.toLowerCase()));
let solution = curatedWords[getRandomInteger(0, curatedWords.length - 1)]
	.toLowerCase();

/* --------------------------------------------------------------------------------------------------
 * Challenge token from URL (if any)
 ---------------------------------------------------------------------------------------------------*/
const currentUrl = new URL(globalThis.location?.href);
const tokenParam = currentUrl.searchParams.get("t");
let viaChallenge = false;

// (helper) Base32 token encoding with offset
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAP32 = Object.fromEntries([...B32].map((c, i) => [c, i]));
const TOKEN_OFFSET = 10000;

function encodeIdx(index) {
	let n = index + TOKEN_OFFSET;
	if (n === 0) return "0";
	let s = "";
	while (n > 0) {
		s = B32[n % 32] + s;
		n = Math.floor(n / 32);
	}
	return s;
}

function decodeIdx(token) {
	let n = 0;
	for (const c of token.toUpperCase()) {
		const v = MAP32[c];
		if (v == null) throw new Error("bad b32");
		n = n * 32 + v;
	}
	const x = n - TOKEN_OFFSET;
	if (x < 0 || x >= curatedWords.length) throw new Error("token out of range");
	return x;
}

if (tokenParam) {
	try {
		const idx = decodeIdx(tokenParam);
		solution = curatedWords[idx].toLowerCase();
		viaChallenge = true;
		currentUrl.searchParams.delete("t");
		history.replaceState(null, "", currentUrl);
		showModal("Herausforderung angenommen!", 1500);
	} catch {
		console.warn(`Invalid challenge token: ${tokenParam}`);
	}
}

/* --------------------------------------------------------------------------------------------------
 * Remote least-played endpoint
 ---------------------------------------------------------------------------------------------------*/
const NEXT_ENDPOINT = "https://wortsel.tehes.deno.net/next";

// Controller for current /next request so we can cancel it on reset
let nextFetchController = null;

/* --------------------------------------------------------------------------------------------------
 * Functions (utilities and game logic)
 ---------------------------------------------------------------------------------------------------*/

function getRandomInteger(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Tries to replace the fallback-random solution with a least‑played pick from the server.
 * Non-blocking: safe to call and ignore failures/timeouts. Only updates if not finalized.
 */
async function fetchLeastPlayedSolution() {
	if (viaChallenge) return; // keep challenge solution
	if (typeof navigator !== "undefined" && navigator.onLine === false) return; // offline

	// Create a controller and expose it globally so resetGame() can abort in-flight requests
	const ac = new AbortController();
	nextFetchController = ac;
	try {
		const res = await fetch(NEXT_ENDPOINT, { method: "GET", mode: "cors", signal: ac.signal });
		// 204 No Content → server had no candidate; keep fallback
		if (res.status === 204) return;
		if (!res.ok) return;
		const data = await res.json(); // { word, total, candidates }
		const w = (data && typeof data.word === "string") ? data.word.toLowerCase() : null;
		if (!w) return;
		// Replace fallback with server-provided solution (submit will abort in-flight requests)
		solution = w;
	} catch (e) {
		if (e?.name === "AbortError") {
			console.log("[Next] Solution fetch aborted (reset)");
		} else {
			console.log("[Next] Solution fetch failed");
		}
		// ignore; keep fallback
	} finally {
		// Clear only if this call is still the active one
		if (nextFetchController === ac) nextFetchController = null;
	}
}

function setLetterIndex(event) {
	if (isGameOver) return;
	if (event.target.parentElement === rowElements[activeRow]) {
		const letters = Array.from(
			rowElements[activeRow].querySelectorAll(".letter"),
		);
		let index = letters.indexOf(event.target);
		if (index < 0) return;
		// In hard mode, skip locked cells
		if (
			hardModeCheckbox.checked && letters[index].dataset.locked === "true"
		) {
			// find nearest editable cell to the right, then left
			let j = index + 1;
			while (j < letters.length && letters[j].dataset.locked === "true") j++;
			if (j >= letters.length) {
				j = index - 1;
				while (j >= 0 && letters[j].dataset.locked === "true") j--;
			}
			if (j < 0 || j >= letters.length) return;
			index = j;
		}
		letterIndex = index;
		updateActiveLetter();
	}
}

function updateActiveLetter() {
	const letters = Array.from(
		rowElements[activeRow].querySelectorAll(".letter"),
	);
	letters.forEach((letter) => letter.classList.remove("active"));
	if (letterIndex < letters.length) {
		letters[letterIndex].classList.add("active");
	}
}

/**
 * Handles key presses from both physical and on-screen keyboards.
 */
function typeKey(event) {
	if (isGameOver) return;
	const keyEl = event.target?.closest(".key");
	const pressedKey = (keyEl?.textContent || event.key || "").trim().toLowerCase();
	if (!pressedKey) return;

	if (hardModeCheckbox.checked) {
		const domKey = keyEl || [...document.querySelectorAll(".key")]
			.find((k) => k.textContent.trim().toLowerCase() === pressedKey);
		if (domKey?.classList.contains("disabled")) return;
	}

	const letters = [...rowElements[activeRow].querySelectorAll(".letter")];
	const i = letterIndex;

	// caret left (skip locked in hard mode)
	if (pressedKey === "arrowleft") {
		if (letterIndex > 0) {
			let j = letterIndex - 1;
			if (hardModeCheckbox.checked) {
				while (j >= 0 && letters[j].dataset.locked === "true") j--;
			}
			if (j >= 0) {
				letterIndex = j;
				updateActiveLetter();
			}
		}
		return;
	}
	// caret right (skip locked in hard mode)
	if (pressedKey === "arrowright") {
		if (letterIndex < letters.length - 1) {
			let j = letterIndex + 1;
			if (hardModeCheckbox.checked) {
				while (j < letters.length && letters[j].dataset.locked === "true") j++;
			}
			if (j <= letters.length - 1) {
				letterIndex = j;
				updateActiveLetter();
			}
		}
		return;
	}
	// Delete last letter (prefer previous editable cell); support virtual 'back' key
	if (pressedKey === "backspace" || pressedKey === "zurück" || pressedKey === "back") {
		let j = i - 1;
		// skip locked cells in hard mode
		if (hardModeCheckbox.checked) {
			while (j >= 0 && letters[j].dataset.locked === "true") j--;
		}
		if (j >= 0 && letters[j]) {
			// only clear if not locked
			if (
				!(hardModeCheckbox.checked &&
					letters[j].dataset.locked === "true")
			) {
				letters[j].textContent = "";
				letterIndex = j;
				updateActiveLetter();
			}
		}
		return;
	}
	// Delete current/next editable letter
	if (pressedKey === "delete" || pressedKey === "löschen" || pressedKey === "del") {
		let j = i;
		// skip locked cells in hard mode
		if (hardModeCheckbox.checked) {
			while (j < letters.length && letters[j].dataset.locked === "true") j++;
		}
		if (j < letters.length && letters[j]) {
			if (
				!(hardModeCheckbox.checked &&
					letters[j].dataset.locked === "true")
			) {
				letters[j].textContent = "";
				letterIndex = j;
				updateActiveLetter();
			}
		}
		return;
	}
	// Submit current row
	if (pressedKey === "enter" || pressedKey === "eingabe") {
		if (letters.every((l) => l.textContent !== "")) {
			if (!inDatabase(letters) && wholeWordsCheckbox.checked) {
				playErrorAnimation();
				showModal("Kein zulässiges Wort", 1000);
				globalThis.umami?.track("Wortsel", {
					illegalWord: letters.map((l) => l.textContent).join(""),
				});
			} else {
				if (nextFetchController) {
					nextFetchController.abort();
					nextFetchController = null;
				}
				colorizeRow(letters);
				colorizeKeyboard(letters);
				checkEndCondition();
			}
		} else {
			showModal("Zu wenig Zeichen", 1000);
		}
		return;
	}
	// Type a single character
	if (i < letters.length && pressedKey.length === 1) {
		// In hard mode: block locked positions and yellow-banned (pos, char)
		if (hardModeCheckbox.checked) {
			const currentCellLocked = letters[i].dataset.locked === "true";
			if (currentCellLocked) return;
			const bannedAtPos = yellowBans.get(i);
			if (bannedAtPos && bannedAtPos.has(pressedKey)) {
				showModal("Gelb ≠ diese Position", 1000);
				return;
			}
		}
		letters[i].textContent = pressedKey;

		// Advance caret and SKIP locked cells in hard mode
		let next = i + 1;
		if (hardModeCheckbox.checked) {
			while (next < letters.length && letters[next].dataset.locked === "true") next++;
		}
		letterIndex = next; // may equal letters.length → no active cell shown, which is fine
		updateActiveLetter();
	}
}

function handleVirtualKeyFeedback(event) {
	if (isGameOver) return;
	let key = event.key.toLowerCase();
	if (key === "backspace") {
		key = "back";
	} else if (key === "enter") {
		key = "enter";
	}

	const virtualKey = Array.from(document.querySelectorAll(".key"))
		.find((el) => el.textContent.trim().toLowerCase() === key);

	if (virtualKey) {
		if (event.type === "keydown") {
			virtualKey.classList.add("pressed");
		} else if (event.type === "keyup") {
			virtualKey.classList.remove("pressed");
		}
	}
}

function inDatabase(letters) {
	const entered = letters.map((l) => l.textContent).join("").toLowerCase();
	return wordSet.has(entered);
}

function colorizeRow(letters) {
	const tempSolution = solution.split("");

	// Mark correct letters
	letters.forEach((letter, i) => {
		if (letter.textContent === solution[i]) {
			letter.classList.add("correct");
			letter.classList.remove("active");
			tempSolution[i] = "";
		}
	});

	// Mark present letters
	letters.forEach((letter) => {
		if (!letter.classList.contains("correct")) {
			const index = tempSolution.indexOf(letter.textContent);
			if (index !== -1) {
				letter.classList.add("present");
				letter.classList.remove("active");
				tempSolution[index] = "";
			}
		}
	});

	// Mark absent letters
	letters.forEach((letter) => {
		if (
			!letter.classList.contains("correct") &&
			!letter.classList.contains("present")
		) {
			letter.classList.add("absent");
			letter.classList.remove("active");
		}
	});
	// In hard mode, remember yellow bans: the same (pos, letter) is invalid in future guesses
	if (hardModeCheckbox.checked) {
		letters.forEach((letter, i) => {
			if (letter.classList.contains("present")) {
				const ch = (letter.textContent || "").toLowerCase();
				if (!yellowBans.has(i)) yellowBans.set(i, new Set());
				yellowBans.get(i).add(ch);
			}
		});
	}
	// After coloring, capture correct letters for hard mode
	if (hardModeCheckbox.checked) {
		letters.forEach((letter, i) => {
			if (letter.classList.contains("correct")) {
				lockedLetters[i] = letter.textContent;
			}
		});
	}
}

function colorizeKeyboard(letters) {
	const keys = document.querySelectorAll(".key");
	const arrKeys = [...keys].map((key) => key.textContent.trim().toLowerCase());

	letters.forEach((letter) => {
		const j = arrKeys.indexOf(letter.textContent.trim().toLowerCase());
		if (j === -1) return;

		if (
			letter.classList.contains("absent") &&
			!keys[j].classList.contains("correct") &&
			!keys[j].classList.contains("present")
		) {
			keys[j].classList.add("absent");
			// only style as disabled in hard mode
			if (hardModeCheckbox.checked) {
				keys[j].classList.add("disabled");
			}
		}
		if (
			letter.classList.contains("present") &&
			!keys[j].classList.contains("correct")
		) {
			keys[j].classList.add("present");
			keys[j].classList.remove("absent");
		}
		if (letter.classList.contains("correct")) {
			keys[j].classList.add("correct");
			keys[j].classList.remove("present");
			keys[j].classList.remove("absent");
		}
	});
}

function applyHardModeStateToRow(rowEl) {
	const cells = [...rowEl.querySelectorAll(".letter")];
	cells.forEach((cell, i) => {
		if (lockedLetters[i]) {
			cell.textContent = lockedLetters[i];
			cell.classList.add("correct");
			cell.dataset.locked = "true"; // prevent editing
		} else {
			cell.dataset.locked = "false";
		}
	});
	// Move cursor to first editable
	const firstEditable = cells.findIndex((c) => c.dataset.locked !== "true");
	letterIndex = firstEditable >= 0 ? firstEditable : 0;
}

function checkEndCondition() {
	const correctLetters = rowElements[activeRow].querySelectorAll(".correct");
	const winText = [
		"Wahnsinn, eine perfekte Runde!",
		"Wow, das war fantastisch!",
		"Ein beachtlicher Sieg!",
		"Sehr gut gemacht!",
		"Yay, gewonnen!",
		"Puh, das war knapp.",
	];
	let gameEnded = false;
	let analyticsPayload = null;

	if (correctLetters.length === 5) {
		showModal(winText[activeRow], 3000);
		playWinAnimation(correctLetters);
		analyticsPayload = { roundsUntilWin: activeRow + 1 };
		gameEnded = true;
	} else {
		letterIndex = 0;
		activeRow++;
		// Prefill & lock correct letters for the new row in hard mode (only if a next row exists)
		if (activeRow < rowElements.length) {
			if (hardModeCheckbox.checked) {
				applyHardModeStateToRow(rowElements[activeRow]);
			}
			updateActiveLetter();
		}
	}

	if (activeRow === 6) {
		showModal(
			`Leider verloren. Gesucht wurde '${solution.toUpperCase()}'.`,
			3000,
		);
		analyticsPayload = { failedWord: solution.toUpperCase() };
		gameEnded = true;
	}

	if (gameEnded) {
		isGameOver = true;
		removeInputListeners();
		clearGameState();

		if (analyticsPayload) {
			// UMAMI ANALYTICS
			globalThis.umami?.track("Wortsel", {
				...analyticsPayload,
				usedDictionary: wholeWordsCheckbox.checked,
				activatedHardMode: hardModeCheckbox.checked,
				viaChallenge: viaChallenge,
			});
			//ADOBE ANALYTICS
			globalThis._satellite?.track("ctEvent", {
				ctEvent: {
					name: "Spiele::Wörtchen::Ende",
					position: "Spiele::Wörtchen",
					subPosition: (viaChallenge ? "Shared::" : "") +
						(hardModeCheckbox.checked
							? "Schwer"
							: (wholeWordsCheckbox.checked ? "Standard" : "Leicht")),
					element: "End",
					label: analyticsPayload.roundsUntilWin ? "Completed" : "Game over",
				},
			});
		}

		postCommunityStats({
			solution,
			attempts: (activeRow < 6) ? activeRow + 1 : "fail",
		});
	}
}

function showModal(text, duration) {
	modalElement.textContent = text;
	modalElement.classList.remove("hidden");

	if (duration > 0) {
		setTimeout(() => {
			modalElement.classList.add("hidden");
		}, duration);
	}
}

function toggleWindow(element) {
	const correctLetters = rowElements[activeRow].querySelectorAll(".correct");
	if (
		activeRow > 0 &&
		activeRow < 6 &&
		correctLetters.length !== 5 &&
		element.id === "settings" &&
		settingsIcon.dataset.allowDuringGame !== "true"
	) {
		showModal("Nicht während des Spiels möglich", 1000);
	} else {
		element.classList.toggle("hidden");
		backdrop.classList.toggle("hidden");
	}
}

function playWinAnimation(letters) {
	letters.forEach((letter) => letter.classList.add("jump"));
}

function playErrorAnimation() {
	rowElements[activeRow].classList.add("shake");
}

function stopAnyAnimation(event) {
	event.target.classList.remove("jump");
	event.target.classList.remove("shake");
}

function solve() {
	showModal(`Die Lösung lautet '${solution.toUpperCase()}'.`, 2000);
}

function saveSettings() {
	localStorage.setItem("wortsel_wholeWords", JSON.stringify(wholeWordsCheckbox.checked));
	localStorage.setItem("wortsel_hardMode", JSON.stringify(hardModeCheckbox.checked));
}

function resetGame() {
	isGameOver = false;
	removeInputListeners();
	clearGameState();
	const letters = document.querySelectorAll("main .letter");
	const keys = document.querySelectorAll(".key");

	howToSection.classList.add("hidden");
	settingsSection.classList.add("hidden");
	statsSection.classList.add("hidden");
	backdrop.classList.add("hidden");

	letters.forEach((letter) => {
		letter.textContent = "";
		letter.classList.remove("correct", "present", "absent", "active");
		letter.dataset.locked = "false";
	});
	keys.forEach((key) => {
		key.classList.remove("correct", "present", "absent", "disabled");
	});

	lockedLetters = [null, null, null, null, null];
	yellowBans = new Map();

	statsSection.classList.add("hidden");
	backdrop.classList.add("hidden");

	solution = curatedWords[getRandomInteger(0, curatedWords.length - 1)]
		.toLowerCase();
	viaChallenge = false;
	activeRow = 0;
	letterIndex = 0;
	updateActiveLetter();
	addInputListeners();
	if (nextFetchController) {
		nextFetchController.abort();
		nextFetchController = null;
	}
	fetchLeastPlayedSolution();
	showModal("Neue Runde, neues Glück", 1000);
}

// Manage keyboard input listeners (to disable input after game end)
let inputController;
function addInputListeners() {
	// prevent duplicate listeners
	if (inputController) return;
	inputController = new AbortController();
	const { signal } = inputController;
	document.addEventListener("keyup", typeKey, { signal });
	document.addEventListener("keydown", handleVirtualKeyFeedback, { signal });
	document.addEventListener("keyup", handleVirtualKeyFeedback, { signal });
	keyboardElement.addEventListener("click", typeKey, { signal });
	gameBoardEl.addEventListener("click", setLetterIndex, { signal });
}
function removeInputListeners() {
	// remove listeners
	inputController?.abort();
	inputController = null;
}

function getTextTemplate(element, replacements = {}) {
	const template = element.dataset.text;
	return Object.entries(replacements).reduce(
		(text, [placeholder, value]) => text.replace(`{{${placeholder}}}`, value),
		template,
	);
}

/* --------------------------------------------------------------------------------------------------
 * Community stats (UI + POST)
 ---------------------------------------------------------------------------------------------------*/

// Normalizes a word for consistent server communication.
function normalizeWord(s) {
	return (s ?? "").toString().trim().toUpperCase().normalize("NFC");
}

// Posts the result to the community stats endpoint and renders the returned stats.
async function postCommunityStats({ solution, attempts }) {
	try {
		const SOL = normalizeWord(solution);
		const endpoint = "https://wortsel.tehes.deno.net/stats";

		const res = await fetch(endpoint, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				solution: SOL,
				attempts: (attempts >= 1 && attempts <= 6) ? attempts : "fail",
			}),
			mode: "cors",
			keepalive: true,
		});

		if (!res.ok) {
			console.warn("Community stats request failed:", res.status);
			return;
		}

		const response = await res.json(); // { ok: true, stats: {...} }

		if (response.stats && typeof renderCommunityStats === "function") {
			renderCommunityStats(response.stats, {
				myResult: (attempts >= 1 && attempts <= 6) ? String(attempts) : "fail",
			});
		} else {
			console.log("Community stats:", response.stats);
		}
	} catch (e) {
		console.warn("community stats failed", e);
	}
}

// Renders the community stats in the stats section.
function renderCommunityStats(dist, { myResult } = {}) {
	const meta = statsSection.querySelector(".stats-meta");
	const list = statsSection.querySelector(".stats-list");

	meta.textContent = getTextTemplate(meta, {
		SOLUTION: solution.toUpperCase(),
		TOTAL: dist.total,
	});

	const rows = Array.from(list.querySelectorAll(".stats-row"));
	const counts = rows.map((r) => Number(dist.counts?.[r.dataset.key] || 0));
	const max = Math.max(0, ...counts);

	rows.forEach((r) => r.classList.remove("mine"));

	rows.forEach((row) => {
		const fill = row.querySelector(".stats-fill");
		fill.style.width = "0%";
	});

	statsSection.classList.remove("hidden");
	backdrop.classList.remove("hidden");

	void statsSection.offsetWidth;

	rows.forEach((row) => {
		const key = row.dataset.key;
		const count = Number(dist.counts?.[key] || 0);
		const fill = row.querySelector(".stats-fill");
		fill.style.width = max && count ? (count / max) * 100 + "%" : "0%";

		const pct = dist.total ? Math.round((count / dist.total) * 100) : 0;
		const cntEl = row.querySelector(".stats-count");
		cntEl.textContent = `${pct}%`;

		const isMine = String(myResult) === key;
		row.classList.toggle("mine", isMine);
	});
}

/* --------------------------------------------------------------------------------------------------
 * Sharing (challenge)
 ---------------------------------------------------------------------------------------------------*/

// Builds an emoji grid representing the played rows.
function buildEmojiGrid() {
	// Collect rows that were actually played (0..activeRow-1 if win earlier)
	const rows = Array.from(document.querySelectorAll("main .row")).slice(
		0,
		Math.min(activeRow + 1, 6),
	);
	const mapCell = (el) => {
		if (el.classList.contains("correct")) return "🟩";
		if (el.classList.contains("present")) return "🟨";
		return "⬜";
	};
	return rows
		// only include rows that have 5 filled letters
		.filter((r) => Array.from(r.querySelectorAll(".letter")).every((c) => c.textContent !== ""))
		.map((r) => Array.from(r.querySelectorAll(".letter")).map(mapCell).join(""))
		.join("\n");
}

// Shares the challenge URL and emoji grid via Web Share API or clipboard.
function shareChallenge() {
	const idx = curatedWords.findIndex((w) => w.toLowerCase() === solution.toLowerCase());
	const token = encodeIdx(idx);

	const url = new URL(location.href);
	url.searchParams.set("t", token);
	const shareUrl = url.toString();

	const grid = buildEmojiGrid();
	const msgtext = getTextTemplate(shareBtn, {});
	const msg = `${msgtext}
${grid}
Jetzt Herausforderung annehmen: ${shareUrl}`;

	if (navigator.share) {
		navigator.share({ text: msg })
			.catch((error) => {
				if (error.name !== "AbortError") {
					return navigator.share({ url: shareUrl });
				}
			});
	} else if (navigator.clipboard?.writeText) {
		navigator.clipboard.writeText(msg).then(() => {
			showModal("Challenge-Text kopiert", 1000);
		});
	}
}

/* --------------------------------------------------------------------------------------------------
 * Persist: Game State (word-centric) + TTL purge (Challenge only)
 ---------------------------------------------------------------------------------------------------*/
const keyFor = (word) => STATE_PREFIX + normalizeWord(word);

function collectGuesses() {
	const guesses = [];

	for (let i = 0; i < activeRow; i++) {
		const letters = [...rowElements[i].querySelectorAll(".letter")]
			.map((cell) => cell.textContent.toLowerCase());
		guesses.push(letters.join(""));
	}

	return guesses;
}

function saveGameState() {
	if (activeRow === 0 || isGameOver) return; // only unfinished games
	const payload = { guesses: collectGuesses(), ts: Date.now() };
	if (viaChallenge) {
		localStorage.setItem(keyFor(solution), JSON.stringify(payload));
	} else {
		localStorage.setItem(
			CURRENT_KEY,
			JSON.stringify({
				solution: normalizeWord(solution),
				...payload,
			}),
		);
	}
}

function clearGameState() {
	if (viaChallenge) {
		localStorage.removeItem(keyFor(solution));
	} else {
		const raw = localStorage.getItem(CURRENT_KEY);
		if (raw) {
			const s = JSON.parse(raw);
			if (s?.solution === normalizeWord(solution)) {
				localStorage.removeItem(CURRENT_KEY);
			}
		}
	}
}

function purgeExpiredChallengeStates(maxAgeDays = STATE_TTL_DAYS) {
	const cutoff = Date.now() - maxAgeDays * 86400e3;
	for (let i = 0; i < localStorage.length; i++) {
		const k = localStorage.key(i);
		if (!k || !k.startsWith(STATE_PREFIX)) continue; // only challenge saves
		try {
			const s = JSON.parse(localStorage.getItem(k) || "null");
			if (!s || !s.ts || s.ts < cutoff) {
				localStorage.removeItem(k);
				i--;
			}
		} catch {
			localStorage.removeItem(k);
			i--;
		}
	}
}

function replayByTyping(guesses = []) {
	if (!Array.isArray(guesses) || guesses.length === 0) return;

	guesses.forEach((word) => {
		word.split("").forEach((ch) => typeKey({ key: ch }));
		typeKey({ key: "enter" });
	});
}

function promptResume(message = "Du hast eine begonnene Runde. Fortsetzen?") {
	// Text ggf. setzen
	const p = resumeSection.querySelector("p");
	if (p) p.textContent = message;

	return new Promise((resolve) => {
		const onContinue = () => done(true);
		const onClose = () => done(false);
		const onBackdrop = () => done(false);

		function done(result) {
			resumeContinueBtn.removeEventListener("click", onContinue);
			resumeSection.querySelector(".close")?.removeEventListener("click", onClose);
			backdrop.removeEventListener("click", onBackdrop);
			resumeSection.classList.add("hidden");
			backdrop.classList.add("hidden");
			resolve(result);
		}

		resumeContinueBtn.addEventListener("click", onContinue, { once: true });
		resumeSection.querySelector(".close")?.addEventListener("click", onClose, { once: true });
		backdrop.addEventListener("click", onBackdrop, { once: true });

		// anzeigen
		resumeSection.classList.remove("hidden");
		backdrop.classList.remove("hidden");
	});
}

function maybeResume(key) {
	const raw = localStorage.getItem(key);
	if (!raw) return false;
	toggleWindow(resumeSection);
	return true;
}

/* --------------------------------------------------------------------------------------------------
 * Initialization
 ---------------------------------------------------------------------------------------------------*/
function initGame() {
	purgeExpiredChallengeStates();

	if (firstVisit === true) {
		howToSection.classList.remove("hidden");
		backdrop.classList.remove("hidden");
		localStorage.setItem("wortsel_firstVisit", JSON.stringify(false));
	}

	document.addEventListener("touchstart", () => {}, false);
	addInputListeners();

	gameBoardEl.addEventListener("animationend", stopAnyAnimation, false);
	headlineElement?.addEventListener("click", resetGame, false);
	restartButtons.forEach((btn) => btn.addEventListener("click", resetGame, false));
	shareBtn?.addEventListener("click", shareChallenge, false);

	howToIcon.addEventListener("click", () => toggleWindow(howToSection), false);
	settingsIcon.addEventListener("click", () => toggleWindow(settingsSection), false);
	closeIcons.forEach((icon) => {
		icon.addEventListener("click", () => {
			toggleWindow(icon.parentElement);
		}, false);
	});

	// Fortsetzen-Button
	resumeContinueBtn.addEventListener("click", () => {
		// passenden Speicher lesen
		const raw = localStorage.getItem(viaChallenge ? keyFor(solution) : CURRENT_KEY);
		if (!raw) {
			toggleWindow(resumeSection);
			return;
		}

		const data = JSON.parse(raw);

		// Non-Challenge: gespeichertes Lösungswort wiederherstellen
		if (!viaChallenge && data.solution) {
			solution = data.solution.toLowerCase();
			viaChallenge = false;
		}

		replayByTyping(data.guesses);
		toggleWindow(resumeSection); // Modal zu
	}, false);

	// Restart-Button (du hast bereits .restart-Logik; falls nicht global: so)
	document.querySelector("#resume-restart")?.addEventListener("click", () => {
		toggleWindow(resumeSection);
		resetGame();
	}, false);

	backdrop.addEventListener("click", () => {
		[howToSection, settingsSection, statsSection, resumeSection].forEach((section) => {
			if (section && !section.classList.contains("hidden")) {
				toggleWindow(section);
			}
		});
	}, false);

	wholeWordsCheckbox.addEventListener("change", saveSettings, false);
	hardModeCheckbox.addEventListener("change", saveSettings, false);

	// Save settings + game state on leave/tab switch
	globalThis.addEventListener("pagehide", () => {
		saveSettings();
		saveGameState();
	}, { capture: true });
	globalThis.addEventListener("beforeunload", () => {
		saveSettings();
		saveGameState();
	}, { capture: true });
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			saveSettings();
			saveGameState();
		}
	}, { capture: true });

	// Keep UI in sync across tabs/windows
	globalThis.addEventListener("storage", (e) => {
		if (e.key === "wortsel_wholeWords" && wholeWordsCheckbox) {
			wholeWordsCheckbox.checked = JSON.parse(e.newValue || "true");
		}
		if (e.key === "wortsel_hardMode" && hardModeCheckbox) {
			hardModeCheckbox.checked = JSON.parse(e.newValue || "false");
		}
	});

	// Resume logic:
	// If we came via Challenge (tokenParam already handled earlier and solution set),
	// check only the save for *this* word. Otherwise offer the single current non-challenge slot.
	(async () => {
		let shown = false;
		if (viaChallenge) {
			shown = maybeResume(keyFor(solution));
		} else {
			shown = maybeResume(CURRENT_KEY);
		}
		if (!shown) {
			await fetchLeastPlayedSolution();
		}
	})();

	console.log(`curated words: ${curatedWords.length}`);
	console.log(`additional words: ${additionalWords.length}`);
	console.log(`altogether: ${wordList.length}`);
}

/* --------------------------------------------------------------------------------------------------
 * Public members (exposed in window scope)
 ---------------------------------------------------------------------------------------------------*/
globalThis.wortsel = {
	initGame,
	solve,
	renderCommunityStats,
	/* Test with:
	wortsel.renderCommunityStats(
	  { total: 100, counts: { "1":5,"2":10,"3":20,"4":25,"5":20,"6":10,"fail":10 } },
	  { myResult: "3" });
	*/
};

globalThis.wortsel.initGame();

/* --------------------------------------------------------------------------------------------------
Service Worker configuration. Toggle 'useServiceWorker' to enable or disable the Service Worker.
---------------------------------------------------------------------------------------------------*/
const useServiceWorker = false; // Set to "true" if you want to register the Service Worker, "false" to unregister
const serviceWorkerVersion = "2025-09-21-v2"; // Increment this version to force browsers to fetch a new service-worker.js

async function registerServiceWorker() {
	try {
		// Force bypassing the HTTP cache so even Safari checks for a new
		// service-worker.js on every load.
		const registration = await navigator.serviceWorker.register(
			`./service-worker.js?v=${serviceWorkerVersion}`,
			{
				scope: "./",
				// updateViaCache is ignored by Safari but helps other browsers
				updateViaCache: "none",
			},
		);
		// Immediately ping for an update to catch fresh versions that may
		// have been cached by the browser.
		registration.update();
		console.log(
			"Service Worker registered with scope:",
			registration.scope,
		);
	} catch (error) {
		console.log("Service Worker registration failed:", error);
	}
}

async function unregisterServiceWorkers() {
	const registrations = await navigator.serviceWorker.getRegistrations();
	if (registrations.length === 0) return;

	await Promise.all(registrations.map((r) => r.unregister()));
	console.log("All service workers unregistered – reloading page…");
	// Hard reload to ensure starting without cache
	globalThis.location.reload();
}

if ("serviceWorker" in navigator) {
	globalThis.addEventListener("DOMContentLoaded", async () => {
		if (useServiceWorker) {
			await registerServiceWorker();
		} else {
			await unregisterServiceWorkers();
		}
	});
}

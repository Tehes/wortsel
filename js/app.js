/* --------------------------------------------------------------------------------------------------
 * Variables
 ---------------------------------------------------------------------------------------------------*/
import additionalWords from "../data/additional_words.json" with { type: "json" };
import curatedWords from "../data/curated_words.json" with { type: "json" };

const gameBoardEl = document.querySelector("main");
const keyboardElement = document.querySelector("#keyboard");
const restartButton = document.querySelector("#restartButton");
const shareBtn = document.getElementById("shareChallengeButton");
const rowElements = document.querySelectorAll(".row");
const modalElement = document.querySelector("aside.modal");
const headlineElement = document.querySelector("h1");
const howToIcon = document.querySelector("#howToIcon");
const howToSection = document.querySelector("#howTo");
const settingsIcon = document.querySelector("#settingsIcon");
const settingsSection = document.querySelector("#settings");
const statsSection = document.querySelector("#stats");
const backdrop = document.querySelector(".backdrop");
const closeIcons = document.querySelectorAll(".close");
const wholeWordsCheckbox = document.querySelector("#wholeWords");

const hardModeCheckbox = document.querySelector("#hardMode");

wholeWordsCheckbox.checked = JSON.parse(
	localStorage.getItem("wortsel_wholeWords") || "true",
);

hardModeCheckbox.checked = JSON.parse(
	localStorage.getItem("wortsel_hardMode") || "false",
);

let activeRow = 0;
let letterIndex = 0;
const firstVisit = JSON.parse(
	localStorage.getItem("wortsel_firstVisit") || "true",
);

const wordList = [...curatedWords, ...additionalWords];
const wordSet = new Set(wordList.map((w) => w.toLowerCase()));
let solution = curatedWords[getRandomInteger(0, curatedWords.length - 1)]
	.toLowerCase();

/* Allow overriding the solution via a URL parameter (?t=<token>) */
const currentUrl = new URL(globalThis.location?.href);
const tokenParam = currentUrl.searchParams.get("t");
let viaChallenge = false;

/* --- Base32 token encoding with offset ----------------------------------- */
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

// Hard mode state
let lockedLetters = [null, null, null, null, null]; // fixed, correct letters carried over
// In hard mode, prevent reusing yellow letters at the same position
// Key: position index (0..4), Value: Set of letters banned at that position
let yellowBans = new Map();

// Game state: block all input when true
let isGameOver = false;

/* --------------------------------------------------------------------------------------------------
 * Functions
 ---------------------------------------------------------------------------------------------------*/

/**
 * Returns a random integer between min and max (inclusive).
 */
function getRandomInteger(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sets the current letter index based on the clicked element.
 */
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

/**
 * Highlights the active letter in the current row.
 */
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

	// Move cursor left (skip locked cells in hard mode)
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
	// Move cursor right (skip locked cells in hard mode)
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
	// Submit the word
	if (pressedKey === "enter" || pressedKey === "eingabe") {
		if (letters.every((l) => l.textContent !== "")) {
			if (!inDatabase(letters) && wholeWordsCheckbox.checked) {
				playErrorAnimation();
				showModal("Kein zulässiges Wort", 1000);
				globalThis.umami?.track("Wortsel", {
					illegalWord: letters.map((l) => l.textContent).join(""),
				});
			} else {
				colorizeRow(letters);
				colorizeKeyboard(letters);
				checkEndCondition();
			}
		} else {
			showModal("Zu wenig Zeichen", 1000);
		}
		return;
	}
	// Type a letter
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

/**
 * Adds visual feedback on on-screen keys when physical keys are pressed.
 */
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

/**
 * Checks if the entered word is in the database.
 */
function inDatabase(letters) {
	const entered = letters.map((l) => l.textContent).join("").toLowerCase();
	return wordSet.has(entered);
}

/**
 * Colors each letter cell based on its relation to the solution.
 */
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

/**
 * Applies color states (correct/present/absent) to the on-screen keys.
 */
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

/**
 * Applies hard mode locked letters and disables to the given row element.
 */
function applyHardModeStateToRow(rowEl) {
	if (!hardModeCheckbox.checked) return;
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
	updateActiveLetter();
}

/**
 * Checks if the user has won or lost after a guess.
 */
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
			applyHardModeStateToRow(rowElements[activeRow]);
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

		if (analyticsPayload) {
			globalThis.umami?.track("Wortsel", {
				...analyticsPayload,
				usedDictionary: wholeWordsCheckbox.checked,
				activatedHardMode: hardModeCheckbox.checked,
				viaChallenge: viaChallenge,
			});
		}

		postCommunityStats({
			solution,
			attempts: (activeRow < 6) ? activeRow + 1 : "fail",
		});
	}
}

/**
 * Displays a message in the modal for a set duration (ms).
 */
function showModal(text, duration) {
	modalElement.textContent = text;
	modalElement.classList.remove("hidden");

	if (duration > 0) {
		setTimeout(() => {
			modalElement.classList.add("hidden");
		}, duration);
	}
}

/**
 * Toggles visibility of a given window (e.g. settings or how-to).
 */
function toggleWindow(element) {
	const correctLetters = rowElements[activeRow].querySelectorAll(".correct");
	if (
		activeRow > 0 &&
		activeRow < 6 &&
		correctLetters.length !== 5 &&
		element.id === "settings"
	) {
		showModal("Nicht während des Spiels möglich", 1000);
	} else {
		element.classList.toggle("hidden");
		backdrop.classList.toggle("hidden");
	}
}

/**
 * Adds a jump animation for the winning row.
 */
function playWinAnimation(letters) {
	letters.forEach((letter) => letter.classList.add("jump"));
}

/**
 * Adds a shake animation if the word is invalid or not found.
 */
function playErrorAnimation() {
	rowElements[activeRow].classList.add("shake");
}

/**
 * Removes jump/shake classes at the end of the animation.
 */
function stopAnyAnimation(event) {
	event.target.classList.remove("jump");
	event.target.classList.remove("shake");
}

/**
 * Shows the solution (for debugging or cheat).
 */
function solve() {
	showModal(`Die Lösung lautet '${solution.toUpperCase()}'.`, 2000);
}

/**
 * Saves settings to localStorage when the window is unloaded.
 */
function saveSettings() {
	localStorage.setItem("wortsel_wholeWords", JSON.stringify(wholeWordsCheckbox.checked));
	localStorage.setItem("wortsel_hardMode", JSON.stringify(hardModeCheckbox.checked));
}

/**
 * Resets the game board for a new round.
 */
function resetGame() {
	isGameOver = false;
	removeInputListeners();
	const letters = document.querySelectorAll("main .letter");
	const keys = document.querySelectorAll(".key");

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
	activeRow = 0;
	letterIndex = 0;
	updateActiveLetter();
	addInputListeners();
	showModal("Neue Runde, neues Glück", 1000);
}

// Manage keyboard input listeners (to disable input after game end)
let inputController;
function addInputListeners() {
	// Avoid duplicates
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
	// Abort (modern browsers, including iOS Safari)
	inputController?.abort();
	inputController = null;
}

// --- Community stats (UI renderer) -----------------------------------------
function renderCommunityStats(dist, { myResult } = {}) {
	const meta = statsSection.querySelector(".stats-meta");
	const list = statsSection.querySelector(".stats-list");

	// headline
	meta.textContent = `Das Wort "${solution.toUpperCase()}" wurde ${dist.total}-mal gespielt`;

	const rows = Array.from(list.querySelectorAll(".stats-row"));
	const counts = rows.map((r) => Number(dist.counts?.[r.dataset.key] || 0));
	const max = Math.max(0, ...counts);

	// reset highlighting
	rows.forEach((r) => r.classList.remove("mine"));

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

	statsSection.classList.remove("hidden");
	backdrop.classList.remove("hidden");
}

// --- Community stats (Deno Deploy) -----------------------------------------
// Normalize to match server (uppercase + NFC)
function normalizeWord(s) {
	return (s ?? "").toString().trim().toUpperCase().normalize("NFC");
}

// Send result and fetch distribution
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

// Build Wordle-like emoji grid from played rows
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

function shareChallenge() {
	const idx = curatedWords.findIndex((w) => w.toLowerCase() === solution.toLowerCase());
	const token = encodeIdx(idx);

	const url = new URL(location.href);
	url.searchParams.set("t", token);
	const shareUrl = url.toString();

	const grid = buildEmojiGrid();
	const msg = `Wortsel Challenge: Kannst du mich bei diesem Wort schlagen?
${grid}
${shareUrl}`;

	if (navigator.share) {
		navigator.share({ text: msg })
			.catch(() => navigator.share({ url: shareUrl }));
	} else if (navigator.clipboard?.writeText) {
		navigator.clipboard.writeText(msg).then(() => {
			showModal("Challenge-Text kopiert", 1000);
		});
	}
}

/**
 * Initializes the game and sets up event listeners.
 */
function initGame() {
	if (firstVisit === true) {
		howToSection.classList.remove("hidden");
		backdrop.classList.remove("hidden");
		localStorage.setItem("wortsel_firstVisit", JSON.stringify(false));
	}

	document.addEventListener("touchstart", () => {}, false);
	addInputListeners();

	gameBoardEl.addEventListener("animationend", stopAnyAnimation, false);
	headlineElement?.addEventListener("click", resetGame, false);
	restartButton.addEventListener("click", resetGame, false);
	shareBtn?.addEventListener("click", shareChallenge, false);

	howToIcon.addEventListener("click", () => toggleWindow(howToSection), false);
	settingsIcon.addEventListener("click", () => toggleWindow(settingsSection), false);
	closeIcons.forEach((icon) => {
		icon.addEventListener("click", () => {
			toggleWindow(icon.parentElement);
		}, false);
	});

	backdrop.addEventListener("click", () => {
		[howToSection, settingsSection, statsSection].forEach((section) => {
			if (section && !section.classList.contains("hidden")) {
				toggleWindow(section);
			}
		});
	}, false);

	wholeWordsCheckbox.addEventListener("change", saveSettings, false);
	hardModeCheckbox.addEventListener("change", saveSettings, false);

	globalThis.addEventListener("pagehide", saveSettings, { capture: true });
	globalThis.addEventListener("beforeunload", saveSettings, { capture: true });
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") saveSettings();
	});

	// Keep UI in sync across tabs/windows
	globalThis.addEventListener("storage", (e) => {
		if (e.key === "wortsel_wholeWords" && wholeWordsCheckbox) {
			wholeWordsCheckbox.checked = JSON.parse(e.newValue || "true");
		}
		if (e.key === "wortsel_hardMode" && hardModeCheckbox) {
			hardModeCheckbox.checked = JSON.parse(e.newValue || "false");
		}
	});

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
	  { myResult: "3" }
	); */
};

globalThis.wortsel.initGame();

/* --------------------------------------------------------------------------------------------------
Service Worker configuration. Toggle 'useServiceWorker' to enable or disable the Service Worker.
---------------------------------------------------------------------------------------------------*/
const useServiceWorker = true; // Set to "true" if you want to register the Service Worker, "false" to unregister
const serviceWorkerVersion = "2025-09-04-v2"; // Increment this version to force browsers to fetch a new service-worker.js

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

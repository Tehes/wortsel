/* --------------------------------------------------------------------------------------------------
 * Variables
 ---------------------------------------------------------------------------------------------------*/
import { curatedWords, additionalWords } from "./words.js";

const keyboardElement = document.querySelector("#keyboard");
const rowElements = document.querySelectorAll(".row");
const modalElement = document.querySelector("aside.modal");
const headlineElement = document.querySelector("h1");
const howToIcon = document.querySelector("#howToIcon");
const howToSection = document.querySelector("#howTo");
const settingsIcon = document.querySelector("#settingsIcon");
const settingsSection = document.querySelector("#settings");
const wholeWordsCheckbox = document.querySelector("#wholeWords");

wholeWordsCheckbox.checked = JSON.parse(localStorage.getItem("wortsel_wholeWords") || "true");

let activeRow = 0;
let letterIndex = 0;
let enteredWord = "";
let firstVisit = JSON.parse(localStorage.getItem("wortsel_firstVisit") || "true");

const wordList = [...curatedWords, ...additionalWords];
let solution = curatedWords[getRandomInteger(0, curatedWords.length - 1)].toLowerCase();

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
    if (event.target.parentElement === rowElements[activeRow]) {
        const letters = Array.from(rowElements[activeRow].querySelectorAll(".letter"));
        const index = letters.indexOf(event.target);
        letterIndex = index;
        updateActiveLetter();
    }
}

/**
 * Highlights the active letter in the current row.
 */
function updateActiveLetter() {
    const letters = Array.from(rowElements[activeRow].querySelectorAll(".letter"));
    letters.forEach(letter => letter.classList.remove("active"));
    if (letterIndex < letters.length) {
        letters[letterIndex].classList.add("active");
    }
}

/**
 * Handles key presses from both physical and on-screen keyboards.
 */
function typeKey(event) {
    let pressedKey;
    if (event.key) {
        pressedKey = event.key.toLowerCase();
    } else if (event.target.textContent && event.target.classList.contains("key")) {
        pressedKey = event.target.textContent.toLowerCase();
    } else {
        return;
    }

    const letters = [...rowElements[activeRow].querySelectorAll(".letter")];
    let i = letterIndex;

    // Move cursor left
    if (pressedKey === "arrowleft") {
        if (letterIndex > 0) {
            letterIndex--;
            updateActiveLetter();
        }
        return;
    }
    // Move cursor right
    if (pressedKey === "arrowright") {
        if (letterIndex < letters.length - 1) {
            letterIndex++;
            updateActiveLetter();
        }
        return;
    }
    // Delete last letter
    if (pressedKey === "back" || pressedKey === "backspace") {
        if (!letters[i - 1]) return;
        letters[i - 1].textContent = "";
        letterIndex--;
        updateActiveLetter();
        return;
    }
    // Delete current letter
    if (pressedKey === "delete") {
        if (!letters[i]) return;
        letters[i].textContent = "";
        return;
    }
    // Submit the word
    if (pressedKey === "enter") {
        if (letters.every(letter => letter.textContent !== "")) {
            if (indexInDatabase(letters) === -1 && wholeWordsCheckbox.checked === true) {
                playErrorAnimation();
                showModal("Kein zulässiges Wort", 1000);
                window.umami.track('illegal_word', {
                    illegalWord: letters.map(letter => letter.textContent).join('')
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
        letters[i].textContent = pressedKey;
        letterIndex++;
        updateActiveLetter();
    }
}

/**
 * Adds visual feedback on on-screen keys when physical keys are pressed.
 */
function handleVirtualKeyFeedback(event) {
    let key = event.key.toLowerCase();
    if (key === "backspace") {
        key = "back";
    } else if (key === "enter") {
        key = "enter";
    }

    const virtualKey = Array.from(document.querySelectorAll(".key"))
        .find(el => el.textContent.trim().toLowerCase() === key);

    if (virtualKey) {
        if (event.type === "keydown") {
            virtualKey.classList.add("pressed");
        } else if (event.type === "keyup") {
            virtualKey.classList.remove("pressed");
        }
    }
}

/**
 * Checks if the entered word is in the database and returns its index if found.
 */
function indexInDatabase(letters) {
    enteredWord = letters.map(l => l.textContent).join("");
    return wordList.findIndex(item => item.toLowerCase() === enteredWord.toLowerCase());
}

/**
 * Colors each letter cell based on its relation to the solution.
 */
function colorizeRow(letters) {
    let tempSolution = solution.split("");

    // Mark correct letters
    letters.forEach((letter, i) => {
        if (letter.textContent === solution[i]) {
            letter.classList.add("correct");
            letter.classList.remove("active");
            tempSolution[i] = "";
        }
    });

    // Mark present letters
    letters.forEach(letter => {
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
    letters.forEach(letter => {
        if (
            !letter.classList.contains("correct") &&
            !letter.classList.contains("present")
        ) {
            letter.classList.add("absent");
            letter.classList.remove("active");
        }
    });
}

/**
 * Applies color states (correct/present/absent) to the on-screen keys.
 */
function colorizeKeyboard(letters) {
    const keys = document.querySelectorAll(".key");
    const arrKeys = [...keys].map(key => key.textContent);

    letters.forEach(letter => {
        const j = arrKeys.indexOf(letter.textContent);
        if (j === -1) return;

        if (
            letter.classList.contains("absent") &&
            !keys[j].classList.contains("correct") &&
            !keys[j].classList.contains("present")
        ) {
            keys[j].classList.add("absent");
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
        "Puh, das war knapp."
    ];

    if (correctLetters.length === 5) {
        showModal(winText[activeRow], 3000);
        playWinAnimation(correctLetters);
        window.umami.track('rounds_until_win', {
            roundsUntilWin: activeRow + 1
        });
    } else {
        letterIndex = 0;
        activeRow++;
        updateActiveLetter();
    }

    if (activeRow === 6) {
        showModal(`Leider verloren. Gesucht wurde '${solution.toUpperCase()}'.`, 3000);
        window.umami.track('failed_word', {
            failedWord: solution.toUpperCase()
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
    }
}

/**
 * Adds a jump animation for the winning row.
 */
function playWinAnimation(letters) {
    letters.forEach(letter => letter.classList.add("jump"));
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
    localStorage.setItem("wortsel_firstVisit", JSON.stringify(false));
    localStorage.setItem("wortsel_wholeWords", JSON.stringify(wholeWordsCheckbox.checked));
}

/**
 * Resets the game board for a new round.
 */
function resetGame() {
    const letters = document.querySelectorAll("main .letter");
    const keys = document.querySelectorAll(".key");

    letters.forEach(letter => {
        letter.textContent = "";
        letter.classList.remove("correct", "present", "absent", "active");
    });
    keys.forEach(key => {
        key.classList.remove("correct", "present", "absent");
    });

    solution = curatedWords[getRandomInteger(0, curatedWords.length - 1)].toLowerCase();
    activeRow = 0;
    letterIndex = 0;
    updateActiveLetter();
    showModal("Neue Runde, neues Glück", 1000);
}

/**
 * Initializes the game and sets up event listeners.
 */
function initGame() {
    if (firstVisit === true) {
        howToSection.classList.remove("hidden");
    }

    const gameBoard = document.querySelector("main");

    document.addEventListener("touchstart", () => { }, false);
    gameBoard.addEventListener("animationend", stopAnyAnimation, false);
    keyboardElement.addEventListener("click", typeKey, false);
    gameBoard.addEventListener("click", setLetterIndex, false);
    document.addEventListener("keyup", typeKey, false);
    document.addEventListener("keydown", handleVirtualKeyFeedback);
    document.addEventListener("keyup", handleVirtualKeyFeedback);
    headlineElement.addEventListener("click", resetGame, false);

    howToSection.addEventListener("click", () => toggleWindow(howToSection), false);
    howToIcon.addEventListener("click", () => toggleWindow(howToSection), false);
    settingsIcon.addEventListener("click", () => toggleWindow(settingsSection), false);

    window.addEventListener("unload", saveSettings, false);

    console.log(`curated words: ${curatedWords.length}`);
    console.log(`additional words: ${additionalWords.length}`);
    console.log(`altogether: ${wordList.length}`);
}

/* --------------------------------------------------------------------------------------------------
 * Public members (exposed in window scope)
 ---------------------------------------------------------------------------------------------------*/
window.wortsel = {
    initGame,
    solve
};

window.wortsel.initGame();

/* --------------------------------------------------------------------------------------------------
 * Service Worker configuration
 ---------------------------------------------------------------------------------------------------*/
const useServiceWorker = true;
const currentPath = window.location.pathname;

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        if (useServiceWorker) {
            navigator.serviceWorker.register(`${currentPath}service-worker.js`)
                .then((registration) => {
                    console.log("Service Worker registered with scope:", registration.scope);
                })
                .catch((error) => {
                    console.log("Service Worker registration failed:", error);
                });
        } else {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach(reg => {
                    reg.unregister().then(success => {
                        if (success) {
                            console.log("Service Worker successfully unregistered.");
                        }
                    });
                });
            });
        }
    });
}
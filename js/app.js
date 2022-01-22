var app = (function() {
    /* --------------------------------------------------------------------------------------------------
    Variables
    ---------------------------------------------------------------------------------------------------*/
    var keyboard = document.querySelector("#keyboard");
    var rows = document.querySelectorAll(".row");
    var modal = document.querySelector("aside.modal");
    var howTo = document.querySelector("#howto");
    var activeRow = 0;
    var enteredWord = "";
    var firstVisit = localStorage.getItem("wortsel_firstVisit") || true;

    /* --------------------------------------------------------------------------------------------------
    functions
    ---------------------------------------------------------------------------------------------------*/
    function getRndInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function typeKey(wordList, solution) {
        var letters, i;

        letters = rows[activeRow].querySelectorAll(".letter");
        i = 0;

        while (i < letters.length && letters[i].textContent !== "") {
            i++;
        }

        // WHEN BACK-BUTTON IS PRESSED
        if (event.target.textContent === "back") {
            if (!letters[i - 1]) {
                return;
            }
            letters[i - 1].textContent = "";
        }

        // WHEN ENTER-BUTTON IS PRESSED
        else if (event.target.textContent === "enter") {
            if (i === letters.length) {
                if (indexInDatabase(letters, wordList) !== -1) {
					colorizeRow(letters, solution);
                	colorizeKeyboard(letters);
                	hasEnded(solution);
                }
                else {
					playErrorAnimation();
					showModal("Kein zulässiges Wort", 1000);
                }
            }
            else {
                showModal("Zu wenig Zeichen", 1000);
            }
        }

        // WHEN ANY LETTER IS PRESSED
        else if (i < letters.length && event.target.classList.contains('key')) {
            letters[i].textContent = event.target.textContent;
        }
    }

	function indexInDatabase(letters, wordList) {
		var index;

		enteredWord = [...letters].map(letters => letters.textContent);
        enteredWord = enteredWord.toString();
        enteredWord = enteredWord.replace(/,/g, "");

        index = wordList.findIndex(element => {
        	return element.toLowerCase() === enteredWord.toLowerCase();
		});

		return index;
	}

    function colorizeRow(letters, solution) {
        var i, j, tempSolution;

        i = 0;
        tempSolution = solution.split("");

        for (i = 0; i < letters.length; i++) {
            if (letters[i].textContent === solution[i]) {
                letters[i].classList.add("correct");
                tempSolution[i] = "";
            }
        }

        for (i = 0; i < letters.length; i++) {
            if (!letters[i].classList.contains("correct")) {
                j = tempSolution.indexOf(letters[i].textContent);
                if (j !== -1) {
                    letters[i].classList.add("present");
                    tempSolution[j] = "";
                }
            }
        }

        for (i = 0; i < letters.length; i++) {
            if (!letters[i].classList.contains("correct") && !letters[i].classList.contains("present")) {
                letters[i].classList.add("absent");
            }
        }
    }

    function colorizeKeyboard(letters) {
        var i, j, keys;
        i = 0;
        keys = document.querySelectorAll(".key");
        arrkeys = [...keys].map(keys => keys.textContent);

        for (i = 0; i < letters.length; i++) {
            j = arrkeys.indexOf(letters[i].textContent);

            if (letters[i].classList.contains("absent") &&
                !keys[j].classList.contains("correct") &&
                !keys[j].classList.contains("present")) {
                keys[j].classList.add("absent");
            }

            if (letters[i].classList.contains("present") &&
                !keys[j].classList.contains("correct")) {
                keys[j].classList.add("present");
                keys[j].classList.remove("absent");
            }

            if (letters[i].classList.contains("correct")) {
                keys[j].classList.add("correct");
                keys[j].classList.remove("present");
                keys[j].classList.remove("absent");
            }
        }
    }

    function hasEnded(solution) {
        var correctLetters;
        correctLetters = rows[activeRow].querySelectorAll(".correct");

        if (correctLetters.length === 5) {
            showModal("Yay, gewonnen!", 3000);
            playWinAnimation(correctLetters);
        }
        else {
            activeRow++;
        }

        if (activeRow === 6) {
            showModal("Leider verloren. Gesucht wurde '" + solution.toUpperCase() + "'.", 3000);
        }
    }

    function showModal(text, duration) {
        modal.textContent = text;
        modal.classList.remove("hidden");

        if (duration > 0) {
            setTimeout(function() {
                modal.classList.add("hidden");
            }, duration);
        }
    }

    function hideWindow() {
        event.currentTarget.classList.add("hidden");
    }

    function playWinAnimation(letters) {
        var i;

        for (i = 0; i < letters.length; i++) {
            letters[i].classList.add("jump");
        }
    }

	function playErrorAnimation() {
		rows[activeRow].classList.add("shake");
    }

    function stopAnyAnimation() {
        event.target.classList.remove("jump");
		event.target.classList.remove("shake");
    }

    function solve() {
        showModal("Die Lösung lautet '" + solution.toUpperCase() + "'.", 2000);
    }

    function saveSettings() {
        localStorage.setItem("wortsel_firstVisit", false);
    }

    function init() {
        if (firstVisit === true) { howTo.classList.remove("hidden"); }

        var gameBoard = document.querySelector("main");
        document.addEventListener("touchstart", function() {}, false);
        gameBoard.addEventListener("animationend", stopAnyAnimation, false);
        window.addEventListener("unload", saveSettings, false);

		fetch('database/words.json')
    	.then(response => response.json())
    	.then(data => {
    		var wordList = data.curatedWords.concat(data.additionalWords);
    		var solution = data.curatedWords[getRndInteger(0, data.curatedWords.length - 1)].toLowerCase();

			keyboard.addEventListener("click", typeKey.bind(null, wordList, solution), false);
			howTo.addEventListener("click", hideWindow, false);

			console.log("curated words: " + data.curatedWords.length);
        	console.log("additional words: "+ data.additionalWords.length);
        	console.log("altogether: "+wordList.length);
    	});
    }

    /* --------------------------------------------------------------------------------------------------
    public members, exposed with return statement
    ---------------------------------------------------------------------------------------------------*/
    return {
        init: init,
        solve: solve
    };

})();

app.init();

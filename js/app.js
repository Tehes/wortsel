var app = (function() {
    /* --------------------------------------------------------------------------------------------------
    Variables
    ---------------------------------------------------------------------------------------------------*/
    var keyboard = document.querySelector("#keyboard");
    var rows = document.querySelectorAll(".row");
    var activeRow = 0;
    var wordList = ["pferd", "insel", "knopf", "hafer", "feuer"];
    var solution = wordList[getRndInteger(0, wordList.length-1)];
    console.log(solution);

    /* --------------------------------------------------------------------------------------------------
    functions
    ---------------------------------------------------------------------------------------------------*/
    function getRndInteger(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function typeKey() {
        var letters, i;

        letters = rows[activeRow].querySelectorAll(".letter");
        i = 0;

        while (i < letters.length && letters[i].textContent !== "") {
            i++;
        }

        if (event.target.textContent === "back") {
            if (!letters[i-1]) {
                return;
            }
            letters[i-1].textContent = "";
        }

        else if (event.target.textContent === "enter") {
            if (i === letters.length) {
                checkSolution(letters);
            }
        }

        else if (i < letters.length && event.target.classList.contains('key')) {
            letters[i].textContent = event.target.textContent;
        }
    }

    function checkSolution(letters) {
        var i, j, tempSolution;

        i = 0;
        tempSolution = solution.split("");

        for (i = 0; i < letters.length; i++) {
            if (letters[i].textContent === solution[i]) {
                letters[i].classList.add("correct");
                tempSolution[i] = "";
            }
        }
        console.log(tempSolution);

        for (i = 0; i < letters.length; i++) {
            if (!letters[i].classList.contains("correct")) {
                j = tempSolution.indexOf(letters[i].textContent);
                if (j !== -1 ) {
                    letters[i].classList.add("present");
                    tempSolution[j] = "";
                }
            }

        }
        console.log(tempSolution);

        for (i = 0; i < letters.length; i++) {
            if (!letters[i].classList.contains("correct") && !letters[i].classList.contains("present")) {
                letters[i].classList.add("absent");
            }
        }
        console.log(tempSolution);

        activeRow++;
    }


    function init() {
        document.addEventListener("touchstart", function() {}, false);
        keyboard.addEventListener("click", typeKey, false);
    }

    /* --------------------------------------------------------------------------------------------------
    public members, exposed with return statement
    ---------------------------------------------------------------------------------------------------*/
    return {
        init: init
    };

})();

app.init();

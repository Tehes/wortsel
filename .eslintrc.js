// .eslintrc.js example
module.exports = {
    "env": {
        "browser": true,
        "node": true,
        "es2021": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "globals": {
        "app": "readonly" // Beispiel für globale Variable
    },
    "rules": {
        "semi": ["error", "always"], // Erzwingt Semikolons
        "quotes": ["error", "double"], // Erzwingt doppelte Anführungszeichen
        "indent": ["error", 4], // Erzwingt eine Einrückung von 2 Leerzeichen
    }
};
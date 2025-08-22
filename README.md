# Wortsel - A Word Game

Wortsel is a browser-based word game inspired by Wordle, allowing players to guess a hidden word within six attempts. 
The game is designed as a Progressive Web App (PWA) and can be played on both mobile devices and desktop browsers.

🔗 **Play Here:** [Wortsel](https://tehes.github.io/wortsel/)

## 📜 Disclaimer
Wortsel is an independent, non-commercial project created for fun and personal use. It is inspired by Wordle but has no direct affiliation with Wordle or its developers. All rights to Wordle belong to their respective owners. Wortsel is a unique interpretation of the game with additional features and is not an official Wordle product. The project does not provide downloadable software and is not intended for redistribution.
It has also been used as the basis for white-label deployments (e.g. FAZ). All brand assets in such deployments belong to their respective owners.

## What Makes Wortsel Unique?
- **Optional Word List**: Players can enable or disable dictionary verification for either a structured challenge or more flexible input.
- **Unlimited Rounds**: No daily limit – play as many puzzles as you like.
- **Support for German Characters**: Ä, Ö, and Ü are playable, making it perfect for German words.
- **Free Cursor Movement**: Instead of typing strictly from left to right, the cursor can be placed anywhere in the word.
- **Keyboard Animations & Arrow Keys**: Visual feedback and the ability to move the cursor using arrow keys.
- **Offline Play**: Thanks to an integrated service worker, the game can be played without an internet connection.
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Settings Persistence**: Last game options are stored in `localStorage`.

## How to Play
1. Enter a five-letter word.
2. Press **Enter** to check the word.
3. Colors indicate how close you are:
   - **Green**: Letter is correct and in the right position.
   - **Yellow**: Letter is in the word but in the wrong position.
   - **Gray**: Letter is not in the word.
4. Solve the word within six attempts.

## Install as a PWA
- For Chrome, Edge, or Firefox: Select "Add to Home Screen."
- For iOS: Open the page in Safari and use the "Share" menu to add it to the home screen.

## White-Label / Custom Deployments
Besides the public version, Wortsel has also been adapted as a white-label solution.  
For example, a custom build was created for the German newspaper **Frankfurter Allgemeine Zeitung (FAZ)**, embedded via `<iframe>` on their site.

The codebase is structured with a **core layer** (shared game logic and neutral styles) and **theme layers** (e.g. `theme-wortsel.css` and `theme-faz.css`).  
This separation allows different skins (branding, typography, colors, icons) while keeping one maintainable codebase.

Key aspects:
- Shared **game engine and UI components** in `core.css` and JavaScript.  
- **Theme overrides** for fonts, scaling, and color schemes.  
- Separate HTML entry points (`index.html` for Wortsel, `faz.html` for FAZ).  

## License
This project is licensed under the MIT License.

### White-Label / Brand Assets
The MIT License applies only to the **core codebase** of Wortsel.  
All third-party brand assets (e.g. FAZ logos, fonts, icons, color palettes, or other partner-specific themes) are **not** covered by this license.  
Such assets remain the property of their respective owners and may only be used with their permission.

Custom white-label deployments (e.g. the FAZ version of Wortsel) are based on the MIT-licensed core, but the branding layers are **proprietary** and excluded from open-source distribution.

Enjoy playing! 🎉

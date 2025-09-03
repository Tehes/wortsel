# Wortsel - A Word Game

Wortsel is a browser-based word game inspired by Wordle, allowing players to guess a hidden word
within six attempts. The game is designed as a Progressive Web App (PWA) and can be played on both
mobile devices and desktop browsers.

🔗 **Play Here:** [Wortsel](https://tehes.github.io/wortsel/)

## 📜 Disclaimer

Wortsel is an independent, non-commercial project created for fun and personal use. It is inspired
by Wordle but has no direct affiliation with Wordle or its developers. All rights to Wordle belong
to their respective owners. Wortsel is a unique interpretation of the game with additional features
and is not an official Wordle product. The project does not provide downloadable software and is not
intended for redistribution. It has also been used as the basis for white-label deployments (e.g.
FAZ). All brand assets in such deployments belong to their respective owners.

## What Makes Wortsel Unique?

- **Optional Word List**: Players can enable or disable dictionary verification for either a
  structured challenge or more flexible input.
- **Unlimited Rounds**: No daily limit – play as many puzzles as you like.
- **Support for German Characters**: Ä, Ö, and Ü are playable, making it perfect for German words.
- **Free Cursor Movement**: Instead of typing strictly from left to right, the cursor can be placed
  anywhere in the word.
- **Keyboard Animations & Arrow Keys**: Visual feedback and the ability to move the cursor using
  arrow keys.
- **Offline Play**: Thanks to an integrated service worker, the game can be played without an
  internet connection.
- **Responsive Design**: Optimized for both desktop and mobile devices.
- **Settings Persistence**: Last game options are stored in `localStorage`.
- **Shareable Puzzles**: Append `?word=<index>` to the URL to set a specific solution,
  useful for custom challenges.
- **Hard Mode (strict)**: Once enabled, green letters are locked in place, gray keys cannot be used
  again, and yellow letters may not be placed again at the same position. This stricter variant
  reduces trial‑and‑error and forces more deduction, going beyond Wordle’s hard mode.
  * **Community stats** — after each game, a dialog shows the global attempt distribution (1–6 and **X**). Your own result row is highlighted.


## How to Play

1. Enter a five-letter word.
2. Press **Enter** to check the word.
3. Colors indicate how close you are:
   - **Green**: Letter is correct and in the right position.
   - **Yellow**: Letter is in the word but in the wrong position.
   - **Gray**: Letter is not in the word.
4. Solve the word within six attempts.

### Settings

- **Whole words only** (`wholeWords`): If enabled, guesses must be valid dictionary words; invalid
  guesses are rejected.
- **Hard Mode (strict)** (`hardMode`): Locks green letters, disables gray keys, and forbids
  repeating a yellow letter at the same position in later guesses.

## Community Statistics (Privacy‑friendly)

* After game end, Wortsel sends the outcome (attempt **1–6** or **fail**) and fetches the aggregated distribution for the specific solution.
* The server replies **atomically with the updated stats**.
* The modal shows seven rows (1–6 and **X**), scaled by the largest bucket; your row is highlighted.
* **No personal data** is transmitted; only the normalized solution key and bucket counts are stored.

> **Offline:** When offline, the game works normally but stats cannot be updated or displayed. (Optional backlog/flush can be added in future.)

## Install as a PWA

- For Chrome, Edge, or Firefox: Select "Add to Home Screen."
- For iOS: Open the page in Safari and use the "Share" menu to add it to the home screen.

## White-Label / Custom Deployments

Besides the public version, Wortsel has also been adapted as a white-label solution.\
For example, a custom build was created for the German newspaper **Frankfurter Allgemeine Zeitung
(FAZ)**, embedded via `<iframe>` on their site.

The codebase is structured with a **core layer** (shared game logic and neutral styles) and **theme
layers** (e.g. `theme-wortsel.css` and `theme-faz.css`).\
This separation allows different skins (branding, typography, colors, icons) while keeping one
maintainable codebase.

Key aspects:

- Shared **game engine and UI components** in `core.css` and JavaScript.
- **Theme overrides** for fonts, scaling, and color schemes.
- Separate HTML entry points (`index.html` for Wortsel, `faz.html` for FAZ).

## License

This project is licensed under the MIT License.

### White-Label / Brand Assets

The MIT License applies only to the **core codebase** of Wortsel.\
All third-party brand assets (e.g. FAZ logos, fonts, icons, color palettes, or other
partner-specific themes) are **not** covered by this license.\
Such assets remain the property of their respective owners and may only be used with their
permission.

Custom white-label deployments (e.g. the FAZ version of Wortsel) are based on the MIT-licensed core,
but the branding layers are **proprietary** and excluded from open-source distribution.

Enjoy playing! 🎉

## FAQ

**How is Hard Mode different from Wordle’s?**\
NYT Wordle’s hard mode requires using revealed hints but still allows reusing gray letters and
placing yellow letters again at the same position. Wortsel’s **strict Hard Mode** disables gray keys
and also forbids repeating a yellow letter at the same position, making it intentionally tougher.

**What data does the community stats feature store?**
Only aggregated counts per solution (attempt buckets 1–6 and fail). No user IDs, IPs, or timestamps are published. The server updates counts atomically and returns the new distribution immediately for display.

**Does everything work offline?**
Gameplay does. Stats and analytics require a connection and are skipped when offline.
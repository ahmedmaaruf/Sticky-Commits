# 🧩 Add your sticker to the wall

Welcome! You're about to make a real **pull request**: the same way people contribute to
open-source projects every day. By the end you'll have used a fork, a clone, a branch, commits
and a pull request, and your sticker will be on [the wall](https://stickycommits.vercel.app). 🎉

> **Good to know:** everything you add goes in **your own folder**,
> `cards/<your-github-username>/`, all **lowercase**. That's how the bot that checks every
> pull request knows which sticker is yours. 🙂 Inside your folder, anything goes!

**Contents**
[0. What you need](#0-what-you-need-) ·
[1. Fork](#1-fork-the-repo-) ·
[2. Clone](#2-clone-your-fork-) ·
[3. Branch](#3-make-a-branch-) ·
[4. Make your sticker](#4-make-your-sticker-) ·
[5. Preview](#5-preview-it-) ·
[6. Commit & push](#6-commit-and-push-) ·
[7. Pull request](#7-open-a-pull-request-) ·
[8. The bot](#8-wait-for-the-bot-) ·
[No-install way](#-the-no-install-way-github-website-only) ·
[card.json reference](#-cardjson-reference) ·
[Custom CSS](#-custom-css-advanced) ·
[Problems?](#-common-problems)

---

## 0. What you need 🧰

- A **GitHub account**. Your username decides your folder name.
- **[Git](https://git-scm.com/downloads)** installed. Check with `git --version`.
- **[Node.js](https://nodejs.org) 18 or newer**, to preview your sticker. Check with `node --version`.
- **[VS Code](https://code.visualstudio.com)** (recommended). It autocompletes every sticker option for you.

Can't install anything? Skip to [the no-install way](#-the-no-install-way-github-website-only).

## 1. Fork the repo 🍴

A **fork** is your own copy of this project on GitHub. You can change it however you like
without touching the original.

1. Open **https://github.com/ahmedmaaruf/Sticky-Commits**.
2. Click **Fork** (top-right), then **Create fork**.

You now have `https://github.com/<your-username>/Sticky-Commits`.

## 2. Clone your fork 💻

**Cloning** downloads your fork to your computer. Open a terminal (on Windows: *Git Bash* or
*PowerShell*) and run, using **your** username:

```bash
git clone https://github.com/<your-username>/Sticky-Commits.git
cd Sticky-Commits
```

> Make sure you clone **your fork**, not `ahmedmaaruf/Sticky-Commits`. Otherwise you won't be
> allowed to push.

## 3. Make a branch 🌿

A **branch** keeps your work separate from `main`. Name it after what you're doing:

```bash
git switch -c add-my-sticker
```

## 4. Make your sticker 🎨

Copy the template into a folder named after **your GitHub username, in lowercase**.
For example, if your username is `Ahmed-Dev`, the folder is `cards/ahmed-dev`.

```bash
# macOS, Linux or Git Bash
cp -r cards/_template cards/<your-username>
```

```powershell
# Windows PowerShell
Copy-Item -Recurse cards/_template cards/<your-username>
```

Now open `cards/<your-username>/card.json` and make it yours. Here's the template:

```json
{
  "$schema": "../../card.schema.json",
  "name": "Your Name",
  "title": "a short tagline ✨",
  "emoji": "🌸",
  "shape": "classic",
  "finish": "holo",
  "pattern": "dots",
  "font": "Fredoka",
  "colors": {
    "background": "#ffd6ec",
    "text": "#3b1f4a",
    "accent": "#ff5fa2"
  },
  "attach": "tape",
  "about": "Say hi! What do you love building? What are you learning right now?",
  "facts": ["☕ fun fact one", "🎧 fun fact two", "🐛 fun fact three"]
}
```

- Every option is in the [reference table below](#-cardjson-reference).
- **Picture:** put an image in your folder (for example `photo.png`) and add `"image": "photo.png"`.
  If you leave `image` out, your GitHub profile picture is used.
- Need ideas? Look at the examples in `demo-cards/`.

> 💡 **In VS Code**, press <kbd>Ctrl</kbd>+<kbd>Space</kbd> inside the quotes to see every choice
> (shapes, finishes, fonts…). Mistakes get a red underline while you type.

## 5. Preview it 👀

In the project folder, run:

```bash
npm run dev
```

Then open **http://localhost:5173/wall.html#sticker-&lt;your-username&gt;** to fly straight to your
sticker. Change `card.json`, save, and refresh the page to see it update. Press
<kbd>Ctrl</kbd>+<kbd>C</kbd> in the terminal to stop the preview.

Before you commit, run the same checks the bot will run:

```bash
npm run check
```

✨ *All good* means you're ready. If something is wrong, it tells you exactly what to fix.

## 6. Commit and push 📦

A **commit** saves a snapshot of your changes. **Pushing** uploads it to your fork on GitHub.

```bash
git add cards/<your-username>
git commit -m "Add <your-username>'s sticker ✨"
git push -u origin add-my-sticker
```

The first time you push, Git may ask you to sign in to GitHub. Follow the steps it shows.

## 7. Open a pull request 🚀

A **pull request** (PR) asks for your changes to be added to the original project.

1. Open your fork on GitHub. A yellow banner says *add-my-sticker had recent pushes*.
   Click **Compare & pull request**.
2. Check the top line. It should read:
   **base repository: `ahmedmaaruf/Sticky-Commits`, base: `main`** ←
   **head repository: `<your-username>/Sticky-Commits`, compare: `add-my-sticker`**.
3. Give it a title like *Add Ahmed's sticker ✨*, tick the checklist, and fill in the
   "one thing I learned" line.
4. Click **Create pull request**.

## 8. Wait for the bot ✅

Within a minute, the **🧩 Check sticker** bot reviews your pull request:

- ✅ **Green check:** your sticker is ready to be merged. Once it's merged, it appears on
  [the wall](https://stickycommits.vercel.app) about a minute later and enters the contest. 🏆
- ❌ **Red cross:** click **Details** to see what to fix. Fix it on your computer, then:
  ```bash
  git add cards/<your-username>
  git commit -m "Fix my sticker"
  git push
  ```
  Your pull request updates automatically and the bot checks it again. No need to open a new one!

After it's merged, share your sticker. Flip it and press **🔗 Share** to copy its link. 💌

---

## 🌐 The no-install way (GitHub website only)

1. **Fork** the repo (step 1 above).
2. In **your fork**, click **Add file → Create new file**.
3. Type the name `cards/<your-username>/card.json`. Typing `/` creates the folder.
4. Paste in the [template](#4-make-your-sticker-), and edit it.
5. Click **Commit changes…**, choose **Create a new branch**, and confirm.
6. To add a picture: open `cards/<your-username>/` on that branch → **Add file → Upload files**.
7. Click **Compare & pull request** and continue from [step 7](#7-open-a-pull-request-).

You can't preview your sticker this way, so read the bot's feedback carefully.

## 🔁 Changing your sticker later

Your fork doesn't update by itself. Before changing your sticker again:

1. On your fork's GitHub page, click **Sync fork → Update branch**.
2. On your computer:
   ```bash
   git switch main
   git pull
   git switch -c update-my-sticker
   ```
3. Edit your files, then commit, push and open a new pull request, just like before.

---

## 📝 `card.json` reference

| Field | Required | What it does | Example |
|---|---|---|---|
| `name` | ✅ | Big name on your sticker (max 40) | `"Ahmed"` |
| `title` | | Tagline under the name (max 60) | `"merge conflict survivor"` |
| `image` | | Picture file in your folder, a `https://` link, or `"none"` for emoji-only. **Leave it out to use your GitHub picture.** | `"photo.png"` |
| `imageFit` | | `"cover"` (fill) or `"contain"` (show it all) | `"cover"` |
| `imagePosition` | | Which part of the picture to focus on | `"top"` |
| `emoji` | | Little emoji badge (or your whole picture in emoji mode) | `"🚀"` |
| `shape` | | `classic` · `polaroid` · `badge` · `ticket` · `blob` · `cutout` | `"badge"` |
| `finish` | | `matte` · `glossy` · `holo` · `glitter` | `"holo"` |
| `pattern` | | `none` · `dots` · `grid` · `stripes` · `checker` · `hearts` · `stars` · `waves` · `rays` | `"hearts"` |
| `font` | | A preset font (see below) or any [Google Font](https://fonts.google.com) name | `"Pacifico"` |
| `colors.background` | | Any CSS colour **or gradient** | `"#ffd6ec"` |
| `colors.text` | | Text colour | `"#3b1f4a"` |
| `colors.accent` | | Accent colour (badge ring, labels, pin, tape) | `"#ff5fa2"` |
| `colors.name` | | A different colour just for your name | `"#ffffff"` |
| `attach` | | `tape` · `pin` · `none` | `"tape"` |
| `tilt` | | Rotation from -12 to 12 degrees (leave out for random) | `-4` |
| `about` | | Text on the back of your sticker (max 220) | `"I love games and Rust"` |
| `facts` | | Up to 3 fun facts on the back (max 50 each) | `["☕ coffee", "🎧 lofi"]` |
| `css` | | Your own CSS file, for total freedom (see below) | `"style.css"` |

**Tips**
- Transparent PNGs look *amazing* with `"shape": "cutout"`. The white die-cut border follows your picture's outline.
- Keep pictures under **1 MB**. [squoosh.app](https://squoosh.app) shrinks them in your browser.
- File names are **case-sensitive** on the website: `Photo.PNG` ≠ `photo.png`.
- Gradients work for the background: `"linear-gradient(160deg, #ffb17a, #ff6fae)"`.
- Names in Arabic or any other language work great. Try the *Arabic + Latin* fonts.

**Preset fonts** (or type any other [Google Font](https://fonts.google.com) name)

| Style | Fonts |
|---|---|
| Bubbly | `Fredoka` · `Chewy` · `Bagel Fat One` · `Sniglet` · `Mochiy Pop One` · `Baloo 2` · `Comfortaa` |
| Handwritten | `Caveat` · `Pacifico` · `Permanent Marker` · `Gloria Hallelujah` · `Indie Flower` · `Gaegu` |
| Retro | `Press Start 2P` · `Silkscreen` · `Bungee` · `Monoton` · `Righteous` · `Orbitron` |
| Bold | `Shrikhand` · `Lobster` · `Abril Fatface` · `Rubik Mono One` · `Archivo Black` |
| Code | `Space Mono` · `JetBrains Mono` |
| Arabic + Latin | `Lalezar` · `Marhey` · `Baloo Bhaijaan 2` · `Cairo` · `Tajawal` · `Reem Kufi` · `Rakkas` |

## 🧪 Custom CSS (advanced)

Add `"css": "style.css"` to your card and put a `style.css` next to it. Your CSS lives inside your
sticker's own [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM),
so it **only affects your sticker**. Go wild!

```css
/* cards/<your-username>/style.css */
.name {
  text-shadow: 0 0 .3em #fff, 0 0 .8em hotpink;
  letter-spacing: .05em;
}
.sticker { border-radius: 2em 0.4em; }
.photo img { filter: saturate(1.4) hue-rotate(-10deg); }
.surface { background-image: url("sparkles.png"); }   /* a picture from your folder */
```

Things you can style: `.sticker` `.surface` `.photo` `.name` `.title` `.emoji-bubble` `.label` `.sub`
`.ring` (badge) `.tape` `.pin` `.card-back` `.about` `.facts li`.
You can also change the colour variables on `.sticker`. For example, `.sticker { --edge: gold; }`
turns the white die-cut border gold (others: `--bg`, `--ink`, `--accent`).

**Good to know**
- Pictures and fonts in your CSS must come from **your own folder**, like `url("sparkles.png")`.
  Links to other websites aren't allowed (the bot will tell you).
- Your sticker stays in its own spot on the wall. Anything drawn far outside it gets cut off.
- Keep `style.css` under 20 KB. `@import` doesn't work.

## 🆘 Common problems

| The bot says… | Fix |
|---|---|
| *card.json is not valid JSON (line X)* | Usually a missing or extra comma, or curly quotes `“ ”`. VS Code underlines it in red, or paste it into [jsonlint.com](https://jsonlint.com). |
| *Folder names must be lowercase* | Rename `cards/Ahmed` → `cards/ahmed`. |
| *You can only add or edit your own folder* | Undo changes outside `cards/<your-username>/`: `git restore --source=main <file>` |
| *Image … not found* | Commit the picture too, and check the exact spelling and capital letters. |
| *… isn't an option. Did you mean …?* | Use one of the values from the table above. |
| *Custom CSS can't load files from other websites* | Download the picture into your folder and use `url("picture.png")`. |

| Git says… | Fix |
|---|---|
| *Permission denied* / *403* when pushing | You cloned the original instead of your fork. Run `git remote set-url origin https://github.com/<your-username>/Sticky-Commits.git` and push again. |
| *not a git repository* | You're in the wrong folder. `cd Sticky-Commits` first. |
| *'npm' is not recognized* | Install [Node.js](https://nodejs.org), then close and reopen the terminal. |

Still stuck? Open an [issue](https://github.com/ahmedmaaruf/Sticky-Commits/issues), or ask in class. 🙂

## 💡 Want to do more than a sticker?

Improving the website itself is very welcome! Ideas: a new sticker shape, a new finish, sound
effects, a "sticker of the week", keyboard shortcuts… Open an issue first to discuss your idea,
then send a pull request.

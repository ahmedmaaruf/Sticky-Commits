# 🧩 Add your sticker to the wall

Welcome! You're about to make your first (or fiftieth) **pull request**. By the end you'll have
used forks, branches, commits and PRs — exactly how real open-source projects work.

> **The one rule:** everything you add goes in **your own folder**:
> `cards/<your-github-username>/` — all lowercase.
> A bot checks every pull request, and it will politely refuse changes to other people's folders. 🙂

---

## 1. Get your own copy 🍴

1. Click **Fork** (top-right of the repo page) to copy the repo into your account.
2. Clone **your fork** and make a branch for your change:

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
git switch -c add-my-sticker
```

## 2. Make your sticker 🎨

Copy the template into a folder named after **your GitHub username** (lowercase):

```bash
cp -r cards/_template cards/<you>
```

Now open `cards/<you>/card.json` and make it yours — every option is in the
[reference table below](#-cardjson-reference). Add a picture to the same folder if you want one
(or leave `image` out to use your GitHub avatar).

> 💡 **Use VS Code.** The template points to `card.schema.json`, so VS Code autocompletes every
> option (shapes, finishes, fonts…) and underlines mistakes *while you type*. Press
> <kbd>Ctrl</kbd>+<kbd>Space</kbd> inside the quotes to see the choices.

**Preview it** on your own computer (needs [Node.js](https://nodejs.org) 18+):

```bash
npm run dev        # open http://localhost:5173 — refresh after every change
npm run check      # runs the same checks as the PR bot
```

Tip: open `http://localhost:5173/wall.html#sticker-<you>` to fly straight to your sticker on the wall.

> 🏆 **There's a prize!** Once your sticker is merged it enters the contest automatically — the
> sticker with the most likes at the end of the month wins. Make it one people want to ❤️.

## 3. Commit, push, pull request 🚀

```bash
git add cards/<you>
git commit -m "Add <you>'s sticker ✨"
git push -u origin add-my-sticker
```

Open your fork on GitHub and click **Compare & pull request**. Fill in the short checklist and submit.

<details>
<summary>Can't install anything? You can do it all on github.com</summary>

1. In **your fork**, click **Add file → Create new file**.
2. Type the name `cards/<you>/card.json` (typing `/` creates the folder).
3. Paste in the contents of `cards/_template/card.json`, edit it, then **Commit changes…** to a new branch.
4. To add a picture: open `cards/<you>/` on that branch → **Add file → Upload files**.
5. Click **Compare & pull request**.

You can't preview it this way, so read the bot's feedback carefully!
</details>

## 4. Wait for the bot ✅

Within a minute, the **🧩 Check sticker** bot reviews your pull request:

- ✅ **Green check** → a maintainer can merge it, and your sticker appears on the wall a minute later.
- ❌ **Red cross** → click **Details** to see exactly what to fix. Fix it, commit and push again
  to the *same branch* — the PR updates automatically and the bot re-checks.

---

## 📝 `card.json` reference

| Field | Required | What it does | Example |
|---|---|---|---|
| `name` | ✅ | Big name on your sticker (max 40) | `"Ahmed"` |
| `title` | | Tagline under the name (max 60) | `"merge conflict survivor"` |
| `image` | | Picture file in your folder, a `https://` link, or `"none"` for emoji-only. **Leave it out to use your GitHub avatar.** | `"photo.png"` |
| `imageFit` | | `"cover"` (fill) or `"contain"` (show it all) | `"cover"` |
| `imagePosition` | | Which part of the picture to focus on | `"top"` |
| `emoji` | | Little emoji badge (or your whole picture in emoji mode) | `"🚀"` |
| `shape` | | `classic` · `polaroid` · `badge` · `ticket` · `blob` · `cutout` | `"badge"` |
| `finish` | | `matte` · `glossy` · `holo` · `glitter` | `"holo"` |
| `pattern` | | `none` · `dots` · `grid` · `stripes` · `checker` · `hearts` · `stars` · `waves` · `rays` | `"hearts"` |
| `font` | | A preset font (see list below) or any [Google Font](https://fonts.google.com) name | `"Pacifico"` |
| `colors.background` | | Any CSS colour **or gradient** | `"#ffd6ec"` |
| `colors.text` | | Text colour | `"#3b1f4a"` |
| `colors.accent` | | Accent colour (badge ring, labels, pins, tape) | `"#ff5fa2"` |
| `colors.name` | | Different colour just for your name | `"#ffffff"` |
| `attach` | | `tape` · `pin` · `none` | `"tape"` |
| `tilt` | | Rotation from -12 to 12 degrees (leave out for random) | `-4` |
| `about` | | Text on the back of your sticker (max 220) | `"I love games and Rust"` |
| `facts` | | Up to 3 fun facts on the back (max 50 each) | `["☕ coffee", "🎧 lofi"]` |
| `css` | | Your own CSS file, for total freedom (see below) | `"style.css"` |

**Tips**
- Transparent PNGs look *amazing* with `"shape": "cutout"` — the white die-cut border follows your picture's outline.
- Keep pictures under **1 MB** — [squoosh.app](https://squoosh.app) shrinks them in your browser.
- File names are **case-sensitive** on the website: `Photo.PNG` ≠ `photo.png`.
- Names in Arabic or any other language work great — try the *Arabic + Latin* fonts.

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
so it **can only affect your sticker** — go wild!

```css
/* cards/<you>/style.css */
.name {
  text-shadow: 0 0 .3em #fff, 0 0 .8em hotpink;
  letter-spacing: .05em;
}
.sticker { border-radius: 2em 0.4em; }
.photo img { filter: saturate(1.4) hue-rotate(-10deg); }
```

Things you can style: `.sticker` `.surface` `.photo` `.name` `.title` `.emoji-bubble` `.label` `.sub`
`.ring` (badge) `.tape` `.pin` `.card-back` `.about` `.facts li`.
You can also override the colour variables on `.sticker`, e.g. `.sticker { --edge: gold; }`
turns the white die-cut border gold (others: `--bg`, `--ink`, `--accent`).

## 🆘 Common problems

| The bot says… | Fix |
|---|---|
| *card.json is not valid JSON (line X)* | Usually a missing/extra comma or curly quotes `“ ”`. VS Code underlines it in red, or paste it into [jsonlint.com](https://jsonlint.com). |
| *Folder names must be lowercase* | Rename `cards/Ahmed` → `cards/ahmed`. |
| *You can only add or edit your own folder* | Undo changes outside `cards/<you>/` (`git restore --source=main <file>`). |
| *Image … not found* | Commit the picture too, and check the exact spelling + capital letters. |
| *… isn't an option. Did you mean …?* | Use one of the values from the table above. |

## 💡 Want to do more than a sticker?

Improving the website itself is very welcome! Ideas: a new sticker shape, a new finish, sound effects,
a "sticker of the week", keyboard shortcuts… Open an issue first to discuss, then send a pull request.

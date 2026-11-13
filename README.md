# ✨ Sticky Commits — the Informatics sticker wall

A cute, 3D sticker wall where **every sticker is a pull request**.

You design your own sticker (your picture, shape, colours, font and a shiny finish), then add it
to the wall the way real open-source projects work: **fork → clone → branch → commit → pull request**.
Once your pull request is merged, your sticker slaps onto the wall for everyone to see.

### 👉 [See the wall](https://stickycommits.vercel.app) · 📖 [Step-by-step guide](CONTRIBUTING.md)

---

## 🏆 The contest

The sticker with the **most likes** wins **a one-month Claude subscription**.

- 🗓️ Voting is open from **November 13** until **December 13, 2026** (23:59, UTC+3).
- ❤️ One like per person on each sticker. You can like as many stickers as you want.
- 🤝 In a tie, the sticker that reached its total first wins.
- 🧩 Every merged sticker enters automatically. (The demo stickers don't count.)

The sooner your sticker is on the wall, the more time people have to like it. 😉

---

## 🚀 Add your sticker in 6 steps

The [full guide](CONTRIBUTING.md) explains every step in detail, including how to fix common
problems. Here's the short version:

1. **Fork** this repo: click **Fork** at the top-right of this page.
2. **Clone** your fork and make a branch:
   ```bash
   git clone https://github.com/<your-username>/Sticky-Commits.git
   cd Sticky-Commits
   git switch -c add-my-sticker
   ```
3. **Make your folder.** Copy the template into a folder named after your GitHub username, in **lowercase**:
   ```bash
   cp -r cards/_template cards/<your-username>
   ```
4. **Design your sticker** in `cards/<your-username>/card.json`, and add a picture if you like.
5. **Preview it** (needs [Node.js](https://nodejs.org) 18+), then open http://localhost:5173:
   ```bash
   npm run dev
   ```
6. **Commit, push and open a pull request:**
   ```bash
   git add cards/<your-username>
   git commit -m "Add <your-username>'s sticker ✨"
   git push -u origin add-my-sticker
   ```
   On GitHub, click **Compare & pull request**. A bot checks your sticker within a minute.

> **Good to know:** keep your files inside **your own folder**, `cards/<your-username>/`. That's
> how the bot knows which sticker is yours.

---

## 🎨 Make it yours

There's no right way to make a sticker. It's your own little piece of the wall, so make it
look like **you**: your face, your cat, a doodle, a meme, your favourite programming language,
your name in Arabic… anything.

The template gives you a few things to play with, if you want them: shapes (a badge where your
name curves around the ring, a polaroid, a ticket, a wobbly blob, a die-cut cutout…),
holographic and glitter finishes, patterns, hundreds of fonts, any colours or gradients, and a
back side for a short bio and fun facts.

And when that's not enough, **write your own CSS** and design the whole thing from scratch:
animations, effects, a totally new look. It only ever changes your own sticker, so go wild. ✨

Look at the stickers in `demo-cards/` for ideas, then make something nobody has seen before.
Everything you can set is listed in the [`card.json` reference](CONTRIBUTING.md#-cardjson-reference).

🤫 *Psst… there's a secret hidden somewhere on the wall. Can you find it?*

---

## 💻 Commands

Needs [Node.js](https://nodejs.org) 18+. There's nothing to install: the project has zero dependencies.

```bash
npm run dev      # preview the site at http://localhost:5173 (refresh after each change)
npm run check    # check every sticker, exactly like the pull request bot does
```

---

## 🗂️ Where things live

```
cards/<your-username>/   ← YOUR sticker: card.json (+ picture, + optional style.css)
cards/_template/         ← the starter sticker you copy
demo-cards/              ← example stickers, for ideas
card.schema.json         ← lets VS Code autocomplete card.json and spot mistakes
assets/js/sticker.js     ← how a sticker is drawn (3D tilt, flip, shapes, finishes)
assets/css/sticker.css   ← how a sticker looks
assets/js/schema.js      ← the sticker options (shared by the website and the bot)
scripts/build.mjs        ← checks every sticker and builds the site
```

## 💡 Want to do more than a sticker?

Improving the website itself is very welcome! Ideas: a new sticker shape or finish, sound effects
when you like a sticker, a "sticker of the week" banner, a timeline of when stickers were added,
or translating the site into another language. Open an issue first to talk about your idea,
then send a pull request.

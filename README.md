# Natnael Zerihun | Interactive 3D Portfolio

An infinite corridor with doors into four rooms (React Three Fiber + GSAP + Vite), built on the MIT-licensed code of
[portfolio-itom](https://github.com/ITomPoland/portfolio-itom). See `NOTICE.md`.

## Run
```bash
npm install
cp .env.example .env     # add your Web3Forms key so the contact form emails YOU
npm run dev              # then: npm run build && npm run preview to test performance
```
Node 20+. Add your deployed domain to `VITE_ALLOWED_ORIGINS` or the contact form will refuse to send.

## Where your data lives
| Room | Edit | Notes |
|---|---|---|
| Gallery (projects) | `src/components/canvas/rooms/Gallery/GalleryRoom.jsx` (`FALLBACK_PROJECTS`) | Set each project's real `url`; tech logos are placeholders (HTML/CSS/JS) |
| Studio (skills + links) | `src/components/canvas/rooms/Studio/contentData.js` | Monitors = projects, skill groups, GitHub, email |
| About | `AboutRoom.jsx` (`STORY_MILESTONES`) and `InfiniteSkyManager.jsx` (`AWARDS_DATA`, island labels) | Certificates / Awards / More are empty until you add items |
| Contact | `ContactRoom.jsx` (`SOCIAL_LINKS`) | LinkedIn, Facebook, Instagram are empty, so those barrels do nothing until filled |
| Page titles / SEO | `index.html`, `src/hooks/useDocumentMeta.js` | |

## Replace the placeholder art
Every file in `public/textures/**` is a labeled placeholder with the correct proportions. Replace files in place (same name,
same aspect ratio) with your own drawings/photos. Files ending in `_painted` are the colored reveal versions.
Highest impact first: `corridor/doors/*`, `corridor/avatar_anim/*`, `about/*balon*` (skill balloons: his slots are
Next.js/Three.js/GSAP/Figma etc., so make yours HTML/CSS/JS/React), `entrance/*`, `contact/*`, `studio/*`.
Sounds in `public/sounds` are silent; drop in your own files with the same names.

## Not included / removed
PostHog analytics, the Sanity CMS connection (fallback data in code is used), his SEO build plugin and domain.

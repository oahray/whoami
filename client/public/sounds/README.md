# Sound effects & music (MP3)

Drop MP3 files below. The app loads them from `/sounds/<name>.mp3`. Missing files are skipped. Add files when ready; they play when the matching preference is on in Your preferences.

## Sound effects

| File | Used for |
|------|----------|
| `go.mp3` | Multiplayer / solo: first round of a game or session |
| `clue-pop.mp3` | New clue revealed (multiplayer, solo, pass & play) |
| `correct.mp3` | Your own correct guess (multiplayer self only, solo) |
| `uh-oh.mp3` | Round miss: nobody scored (multiplayer) or timeout (solo) |
| `card-flip.mp3` | Later rounds (multiplayer / solo); next / previous card (pass & play) |
| `player-join.mp3` | Someone joins the lobby |
| `player-kick.mp3` | Someone is kicked from the lobby |
| `yay.mp3` | Winners / tied winners on multiplayer results; solo finish with at least one correct |

Pass & play does **not** play `go.mp3`.

## Music

| File | Used for |
|------|----------|
| `theme.mp3` | Soft loop on lobby and solo / pass & play setup screens |

Music is a separate preference from sound effects. It fades out when a game starts.

## Licensing

Theme music (`theme.mp3`): original composition by [Oare Arene](https://oarearene.com), produced for Who Am I? © 2026 Oare Arene. All rights reserved. You may not copy, redistribute, or reuse this recording outside this app without permission.

Sound effects use [Pixabay](https://pixabay.com/) clips under the [Pixabay Content License](https://pixabay.com/service/license/), some mixed with original audio by Oare Arene. Pixabay download filenames are typically `{username}-{title}-{id}.mp3` (the number is the Pixabay media id).

| App file | Pixabay source (download name) | Uploader |
|----------|--------------------------------|----------|
| `card-flip.mp3` | [flipcard / 91468](https://pixabay.com/sound-effects/film-special-effects-flipcard-91468/) (`freesound_community-flipcard-91468.mp3`) | freesound_community (Splashdust / Freesound) |
| `clue-pop.mp3` | bubble pop 08 / 351339 (`universfield-bubble-pop-08-351339.mp3`) | universfield |
| `uh-oh.mp3` | uh oh / 433108 (`wefgf-uh-oh-433108.mp3`), mixed with original audio | wefgf |
| `go.mp3` | epic swish / 346115 (`alexis_gaming_cam-epic-swish-346115.mp3`), mixed with original audio | alexis_gaming_cam |
| `correct.mp3` | Original mix by Oare Arene | — |

Pending SFX: `player-join.mp3`, `player-kick.mp3`, `yay.mp3`.

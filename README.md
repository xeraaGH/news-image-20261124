[![make.fun · news-image-20261124](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/xeraaGH/news-image-20261124/rank.svg)](https://make.fun/bounty/news-image-20261124/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/xeraaGH/news-image-20261124/reward.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)

# news-image-20261124

A zero-dependency Node 22 program that draws a newspaper front page summing up Tuesday 24 November 2026's world news in one 1024x1024 PNG: three tankers ablaze after mine strikes in the Strait of Hormuz, Trump restoring Jensen Huang as Nvidia chief, an Israeli strike killing Hamas's security chief in Gaza — 37 stories from 9 regions, each verified against reporting dated 24 November 2026.

The program draws every pixel itself (a built-in 5x7 bitmap font, hand-rolled PNG encoder, zlib from the standard library) from story data researched from wire reports of 24 November 2026. No network at runtime; two runs write byte-identical files.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png` (1024x1024, under 1 MiB, 28,842 bytes). Without `MAKEFUN_OUTPUT_DIR` it writes to `/output/entry.png`, as the grader expects. The program self-validates the PNG (signature, dimensions, size, IEND) before reporting success.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124) · AI agents build software for cash rewards</sub>

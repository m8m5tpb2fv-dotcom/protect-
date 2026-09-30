# Reels-ролик «Рядом» (15 с, 9:16)

Motion graphics без съёмки: вся анимация — `template.html`, кадр вычисляется функцией `render(t)`.

```bash
python3 marketing/reel/build.py                       # встраивает шрифт Inter и логотип → reel.html
node marketing/reel/render.mjs --stills out 0.5 1,4,8,12,14.8   # пробные кадры
node marketing/reel/render.mjs reel-4k.mp4 30 2 0 450           # 4K 2160×3840, 30 fps (кадры 0–449)
```

Нужны `playwright-core` (есть в зависимостях), Chromium (`CHROMIUM=/путь`) и ffmpeg с libx264 (`FFMPEG=/путь`).
Для ускорения рендерьте диапазоны кадров параллельно и склейте `ffmpeg -f concat -c copy`.

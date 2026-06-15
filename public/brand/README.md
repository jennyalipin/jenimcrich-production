# Brand assets — Jenny Mcrich Recruitment

Source logo files. The in-app mark is inlined in `src/components/ui/logo.tsx`
(`<LogoMark>`); these files are for everything outside React — og-images, email
headers, exports, print, favicons.

```
svg/   vector — preferred everywhere it's supported
png/   raster @1x — email clients, social cards, anywhere SVG won't render
```

Three lockups, each in three colour variants:

| File stem    | Lockup                              |
| ------------ | ----------------------------------- |
| `logomark`   | symbol only (the "j" figures)       |
| `horizontal` | symbol + wordmark, side by side     |
| `stacked`    | symbol over wordmark, centered      |

| Variant suffix | Colours                         | Use on…                    |
| -------------- | ------------------------------- | -------------------------- |
| *(none)*       | two-tone emerald + slate        | light backgrounds, default |
| `-light`       | monochrome slate `#0c172b`      | light backgrounds, 1-colour|
| `-dark`        | monochrome white                | dark backgrounds           |

Example: `svg/horizontal-dark.svg` = horizontal lockup, white, for dark surfaces.

Brand colours: emerald `#038f61`, slate `#0c182c`.

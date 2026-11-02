# Character assets

The jackpot songs (`s102`, `s103`, `s104`, `s105`) use Claude Girl instead of Ya,
and GPT Girl instead of Yu. Other songs keep their original cast.
Feng and Tu share the two middle positions, with cats and girls arranged outwards.

## Saved assets

- `claude.png`: transparent T-pose, generated from the user's orange-haired reference.
- `gpt.png`: transparent original-pose cutout from the user's white dragon-girl reference.
  The floating Sora2 cloud and its motion trails are removed; GPT knot emblems remain.
  The connected dress, sleeves and tail use whole-figure motion rather than separate
  limb deformation, preventing the long fabric from splitting while animated.

Both assets were made with the built-in imagegen tool, then copied into this directory.
Generated alpha is preserved by `tools/build_cast.py`. The original eight rigs remain
unchanged when adding a single asset:

```powershell
python tools/build_cast.py claude
python tools/build_cast.py gpt
```

## Final prompt specifications

Claude: preserve the reference's copper-orange hair, amber eyes, cream and rust-orange
floor-length dress, black panels, floral sunburst emblems, collar and ribbons. Repose
into a front-facing full-body symmetrical T-pose, arms horizontal, elbows straight,
hands empty, palms down. Remove the held book. Keep all hair, hands, hem and feet
inside the canvas. Produce transparent alpha with no floor, backdrop, labels or shadow.

GPT: clean cutout of the exact supplied full-body character, preserving the original
pose, white hair, violet eyes, segmented white dragon horns, pointed ears, intricate
white dress, long draping sleeves, extended hand, white scaled dragon tail and GPT
knot emblems. Remove only the white background and the floating blue Sora2 cloud
mascot and its motion trails. Do not re-pose or redesign the character. Keep the
complete head-to-toe silhouette without cropping; transparent alpha, no floor,
background, additional characters, labels or drop shadow.

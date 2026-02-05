from __future__ import annotations

import argparse
from collections import Counter
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageColor

# Allow very large rendered diagrams to be normalized without PIL bomb warnings.
Image.MAX_IMAGE_PIXELS = None


def _iter_images(paths: Iterable[Path]) -> list[Path]:
    out: list[Path] = []
    for p in paths:
        if p.is_dir():
            out.extend(sorted(p.glob("*.png")))
        else:
            out.append(p)
    # De-dup while preserving order
    seen: set[Path] = set()
    deduped: list[Path] = []
    for p in out:
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        deduped.append(p)
    return deduped


def _sample_background_rgb(img: Image.Image) -> tuple[int, int, int]:
    rgb = img.convert("RGB")
    w, h = rgb.size
    samples = [
        rgb.getpixel((0, 0)),
        rgb.getpixel((w - 1, 0)),
        rgb.getpixel((0, h - 1)),
        rgb.getpixel((w - 1, h - 1)),
        rgb.getpixel((w // 2, 0)),
        rgb.getpixel((w // 2, h - 1)),
        rgb.getpixel((0, h // 2)),
        rgb.getpixel((w - 1, h // 2)),
    ]
    return Counter(samples).most_common(1)[0][0]


def _diff_mask_max_channel(rgb: Image.Image, bg_rgb: tuple[int, int, int]) -> Image.Image:
    bg = Image.new("RGB", rgb.size, color=bg_rgb)
    diff = ImageChops.difference(rgb, bg)
    r, g, b = diff.split()
    return ImageChops.lighter(ImageChops.lighter(r, g), b)


def normalize_png(
    input_path: Path,
    output_path: Path,
    *,
    background: str | None,
    tolerance: int,
    crop_padding: int,
    outer_margin: int,
) -> bool:
    img = Image.open(input_path)
    try:
        force_transparent = background is not None and background.lower() == "transparent"
        if force_transparent or img.mode in ("RGBA", "LA"):
            rgba = img.convert("RGBA")
            alpha = rgba.split()[-1]
            alpha_mask = alpha.point(lambda p: 255 if p > tolerance else 0)
            bbox = alpha_mask.getbbox()
            if bbox is None:
                return False

            left, top, right, bottom = bbox
            left = max(0, left - crop_padding)
            top = max(0, top - crop_padding)
            right = min(rgba.width, right + crop_padding)
            bottom = min(rgba.height, bottom + crop_padding)

            cropped = rgba.crop((left, top, right, bottom))
            out_w = cropped.width + outer_margin * 2
            out_h = cropped.height + outer_margin * 2
            out = Image.new("RGBA", (out_w, out_h), color=(0, 0, 0, 0))
            out.paste(cropped, (outer_margin, outer_margin), cropped)

            output_path.parent.mkdir(parents=True, exist_ok=True)
            out.save(output_path, format="PNG", optimize=True)
            return True

        rgb = img.convert("RGB")
        bg_rgb = _sample_background_rgb(rgb)
        if background is not None:
            bg_rgb = ImageColor.getrgb(background)

        mask = _diff_mask_max_channel(rgb, bg_rgb)
        mask = mask.point(lambda p: 255 if p > tolerance else 0)
        bbox = mask.getbbox()
        if bbox is None:
            return False

        left, top, right, bottom = bbox
        left = max(0, left - crop_padding)
        top = max(0, top - crop_padding)
        right = min(rgb.width, right + crop_padding)
        bottom = min(rgb.height, bottom + crop_padding)

        cropped = rgb.crop((left, top, right, bottom))
        out_w = cropped.width + outer_margin * 2
        out_h = cropped.height + outer_margin * 2
        out = Image.new("RGB", (out_w, out_h), color=bg_rgb)
        out.paste(cropped, (outer_margin, outer_margin))

        output_path.parent.mkdir(parents=True, exist_ok=True)
        out.save(output_path, format="PNG", optimize=True)
        return True
    finally:
        img.close()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize rendered Mermaid PNGs: trim empty margins and add symmetric padding to center the chart.",
    )
    parser.add_argument(
        "paths",
        nargs="*",
        default=["docs/architecture/rendered"],
        help="PNG files or directories to process (default: docs/architecture/rendered).",
    )
    parser.add_argument(
        "--in-place",
        action="store_true",
        help="Overwrite input PNGs in place (default: false).",
    )
    parser.add_argument(
        "--out-dir",
        default="",
        help="Output directory (ignored when --in-place is set).",
    )
    parser.add_argument(
        "--background",
        default="",
        help="Force background color (e.g. 'white' or '#ffffff'). Default: auto-detect from corners.",
    )
    parser.add_argument(
        "--tolerance",
        type=int,
        default=4,
        help="Background difference tolerance (0-255). Higher means more aggressive trimming.",
    )
    parser.add_argument(
        "--crop-padding",
        type=int,
        default=6,
        help="Extra pixels to keep around detected content before re-padding.",
    )
    parser.add_argument(
        "--outer-margin",
        type=int,
        default=48,
        help="Symmetric padding (px) around the cropped content in the output image.",
    )
    args = parser.parse_args()

    paths = _iter_images([Path(p) for p in args.paths])
    if not paths:
        raise SystemExit("No PNG files found.")

    out_dir = Path(args.out_dir) if args.out_dir else None
    background = args.background or None

    processed = 0
    skipped = 0
    for p in paths:
        if args.in_place:
            out_path = p
        else:
            if out_dir is None:
                out_dir = p.parent / "normalized"
            out_path = out_dir / p.name

        ok = normalize_png(
            p,
            out_path,
            background=background,
            tolerance=args.tolerance,
            crop_padding=args.crop_padding,
            outer_margin=args.outer_margin,
        )
        if ok:
            processed += 1
        else:
            skipped += 1

    print(f"Processed: {processed}, skipped: {skipped}")


if __name__ == "__main__":
    main()

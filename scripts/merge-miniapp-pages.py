from __future__ import annotations

import argparse
import math
from pathlib import Path

from PIL import Image


DEFAULT_PAGE_BASENAMES = [
    "01-login",
    "02-home",
    "03-patent-map",
    "04-feeds",
    "05-detail",
    "06-message",
    "07-checkout-deposit-pay",
    "08-checkout-deposit-success",
    "09-checkout-final-pay",
    "10-checkout-final-success",
    "11-user-center",
    "12-publish-chooser",
    "13-publish-patent",
    "14-publish-demand",
    "15-publish-achievement",
]


def _resolve_input_paths(input_dir: Path, inputs: list[str]) -> list[Path]:
    if inputs:
        basenames_or_files = inputs
    else:
        basenames_or_files = DEFAULT_PAGE_BASENAMES

    paths: list[Path] = []
    for item in basenames_or_files:
        p = Path(item)
        if not p.suffix:
            p = p.with_suffix(".png")
        if not p.is_absolute():
            p = input_dir / p.name
        paths.append(p)
    return paths


def _compute_vertical_size(sizes: list[tuple[int, int]], margin: int) -> tuple[int, int]:
    widths = [w for w, _ in sizes]
    heights = [h for _, h in sizes]
    max_w = max(widths)
    total_h = sum(heights) + margin * (len(sizes) + 1)
    return (max_w + margin * 2, total_h)


def _merge_vertical(images: list[Image.Image], margin: int, background: str) -> Image.Image:
    sizes = [(im.width, im.height) for im in images]
    max_w = max(w for w, _ in sizes)
    out_w, out_h = _compute_vertical_size(sizes, margin)
    out = Image.new("RGB", (out_w, out_h), color=background)

    y = margin
    for im in images:
        x = margin + (max_w - im.width) // 2
        out.paste(im, (x, y))
        y += im.height + margin
    return out


def _layout_grid(sizes: list[tuple[int, int]], columns: int) -> tuple[list[int], list[int]]:
    if columns <= 0:
        raise ValueError("--columns must be >= 1")

    rows = (len(sizes) + columns - 1) // columns
    col_widths = [0] * columns
    row_heights = [0] * rows
    for idx, (w, h) in enumerate(sizes):
        row = idx // columns
        col = idx % columns
        col_widths[col] = max(col_widths[col], w)
        row_heights[row] = max(row_heights[row], h)
    return col_widths, row_heights


def _compute_grid_size(sizes: list[tuple[int, int]], margin: int, columns: int) -> tuple[int, int]:
    col_widths, row_heights = _layout_grid(sizes, columns)
    out_w = sum(col_widths) + margin * (len(col_widths) + 1)
    out_h = sum(row_heights) + margin * (len(row_heights) + 1)
    return out_w, out_h


def _merge_grid(
    images: list[Image.Image],
    margin: int,
    background: str,
    columns: int,
) -> Image.Image:
    sizes = [(im.width, im.height) for im in images]
    col_widths, row_heights = _layout_grid(sizes, columns)

    out_w = sum(col_widths) + margin * (len(col_widths) + 1)
    out_h = sum(row_heights) + margin * (len(row_heights) + 1)
    out = Image.new("RGB", (out_w, out_h), color=background)

    col_offsets = [margin]
    for w in col_widths[:-1]:
        col_offsets.append(col_offsets[-1] + w + margin)

    row_offsets = [margin]
    for h in row_heights[:-1]:
        row_offsets.append(row_offsets[-1] + h + margin)

    for idx, im in enumerate(images):
        row = idx // columns
        col = idx % columns

        cell_x = col_offsets[col]
        cell_y = row_offsets[row]

        x = cell_x + (col_widths[col] - im.width) // 2
        y = cell_y + (row_heights[row] - im.height) // 2
        out.paste(im, (x, y))

    return out


def _compute_scale(
    sizes: list[tuple[int, int]],
    *,
    mode: str,
    columns: int,
    margin: int,
    max_total_pixels: int,
) -> float:
    if max_total_pixels <= 0:
        return 1.0

    if mode == "vertical":
        out_w, out_h = _compute_vertical_size(sizes, margin)
    else:
        out_w, out_h = _compute_grid_size(sizes, margin, columns)

    pixels = out_w * out_h
    if pixels <= max_total_pixels:
        return 1.0

    return math.sqrt(max_total_pixels / pixels)


def _resize(im: Image.Image, scale: float) -> Image.Image:
    if scale >= 1.0:
        return im
    new_w = max(1, int(im.width * scale))
    new_h = max(1, int(im.height * scale))
    if new_w == im.width and new_h == im.height:
        return im
    return im.resize((new_w, new_h), Image.Resampling.LANCZOS)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Merge miniapp page PNGs (01-15) into a single image for review.",
    )
    parser.add_argument(
        "--input-dir",
        default="docs/demo/rendered",
        help="Directory containing rendered page PNGs (default: docs/demo/rendered).",
    )
    parser.add_argument(
        "--output",
        default="docs/demo/rendered/miniapp-pages-01-15.png",
        help="Output image path (default: docs/demo/rendered/miniapp-pages-01-15.png).",
    )
    parser.add_argument(
        "--mode",
        choices=("vertical", "grid"),
        default="vertical",
        help="Layout mode: vertical (long image) or grid.",
    )
    parser.add_argument(
        "--columns",
        type=int,
        default=3,
        help="Grid columns (only for --mode=grid).",
    )
    parser.add_argument(
        "--margin",
        type=int,
        default=40,
        help="Margin (px) between images and around the canvas.",
    )
    parser.add_argument(
        "--background",
        default="white",
        help="Background color (default: white).",
    )
    parser.add_argument(
        "--max-total-pixels",
        type=int,
        default=80_000_000,
        help="Auto downscale the output to stay under this pixel count (default: 80000000). Set 0 to disable.",
    )
    parser.add_argument(
        "images",
        nargs="*",
        help="Optional list of basenames or filenames to merge (default: 01-15 miniapp pages).",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    paths = _resolve_input_paths(input_dir, args.images)
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        raise SystemExit("Missing input images:\n" + "\n".join(missing))

    sizes: list[tuple[int, int]] = []
    for p in paths:
        im = Image.open(p)
        try:
            sizes.append(im.size)
        finally:
            im.close()

    scale = _compute_scale(
        sizes,
        mode=args.mode,
        columns=args.columns,
        margin=args.margin,
        max_total_pixels=args.max_total_pixels,
    )

    # Avoid borderline oversize due to rounding.
    if scale < 1.0:
        scaled_sizes = [(max(1, int(w * scale)), max(1, int(h * scale))) for w, h in sizes]
        scaled_margin = max(1, int(args.margin * scale))
        if args.mode == "vertical":
            out_w, out_h = _compute_vertical_size(scaled_sizes, scaled_margin)
        else:
            out_w, out_h = _compute_grid_size(scaled_sizes, scaled_margin, args.columns)
        pixels = out_w * out_h
        if args.max_total_pixels > 0 and pixels > args.max_total_pixels:
            scale *= math.sqrt(args.max_total_pixels / pixels)

    images = [_resize(Image.open(p).convert("RGB"), scale) for p in paths]
    try:
        margin = max(1, int(args.margin * scale)) if scale < 1.0 else args.margin
        if args.mode == "vertical":
            out = _merge_vertical(images, margin=margin, background=args.background)
        else:
            out = _merge_grid(
                images,
                margin=margin,
                background=args.background,
                columns=args.columns,
            )
        out.save(output_path, format="PNG")
    finally:
        for im in images:
            im.close()

    print(f"Wrote: {output_path} ({out.width}x{out.height})")


if __name__ == "__main__":
    main()

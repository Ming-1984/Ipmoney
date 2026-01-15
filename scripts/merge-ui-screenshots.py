from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


CLIENT_ORDER = [
    "home",
    "search",
    "patent-map",
    "patent-map-region-detail",
    "inventors",
    "listing-detail",
    "patent-detail",
    "organizations",
    "organization-detail",
    "trade-rules",
    "login",
    "onboarding-choose-identity",
    "onboarding-verification-form",
    "region-picker",
    "profile-edit",
    "messages",
    "chat",
    "publish",
    "publish-patent",
    "publish-demand",
    "publish-achievement",
    "my-listings",
    "favorites",
    "orders",
    "order-detail",
    "checkout-deposit-pay",
    "checkout-deposit-success",
    "checkout-final-pay",
    "checkout-final-success",
    "me",
]

ADMIN_ORDER = [
    "login",
    "dashboard",
    "verifications",
    "listings",
    "orders",
    "refunds",
    "settlements",
    "invoices",
    "config",
    "regions",
    "patent-map",
]


def _list_pngs(dir_path: Path) -> list[Path]:
    if not dir_path.exists():
        return []
    if not dir_path.is_dir():
        return []
    return sorted(dir_path.glob("*.png"))


def _sort_by_known_order(paths: list[Path], *, prefix: str, order: list[str]) -> list[Path]:
    rank = {name: idx for idx, name in enumerate(order)}

    def key(p: Path) -> tuple[int, str]:
        stem = p.stem
        name = stem
        if stem.startswith(prefix + "-"):
            name = stem[len(prefix) + 1 :]
        idx = rank.get(name, 10_000)
        return (idx, stem)

    return sorted(paths, key=key)


def _layout_grid(sizes: list[tuple[int, int]], columns: int) -> tuple[list[int], list[int]]:
    if columns <= 0:
        raise ValueError("columns must be >= 1")

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
    *,
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


def _resize(im: Image.Image, scale: float) -> Image.Image:
    if scale >= 1.0:
        return im
    new_w = max(1, int(im.width * scale))
    new_h = max(1, int(im.height * scale))
    if new_w == im.width and new_h == im.height:
        return im
    return im.resize((new_w, new_h), Image.Resampling.LANCZOS)


def _stack_vertical(
    images: list[Image.Image],
    *,
    background: str,
    gap: int,
) -> Image.Image:
    if not images:
        raise ValueError("stack_vertical requires at least 1 image")
    width = max(im.width for im in images)
    height = sum(im.height for im in images) + gap * (len(images) - 1)
    out = Image.new("RGB", (width, height), color=background)
    y = 0
    for idx, im in enumerate(images):
        x = (width - im.width) // 2
        out.paste(im, (x, y))
        y += im.height
        if idx != len(images) - 1:
            y += gap
    return out


@dataclass(frozen=True)
class SectionLayout:
    columns: int


def _compute_scale_for_combined(
    *,
    client_sizes: list[tuple[int, int]],
    admin_sizes: list[tuple[int, int]],
    margin: int,
    gap: int,
    client_columns: int,
    admin_columns: int,
    max_total_pixels: int,
) -> float:
    if max_total_pixels <= 0:
        return 1.0

    board_sizes: list[tuple[int, int]] = []
    if client_sizes:
        board_sizes.append(_compute_grid_size(client_sizes, margin, client_columns))
    if admin_sizes:
        board_sizes.append(_compute_grid_size(admin_sizes, margin, admin_columns))

    if not board_sizes:
        return 1.0

    out_w = max(w for w, _ in board_sizes)
    out_h = sum(h for _, h in board_sizes) + (gap if len(board_sizes) > 1 else 0)

    pixels = out_w * out_h
    if pixels <= max_total_pixels:
        return 1.0

    return math.sqrt(max_total_pixels / pixels)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Merge real UI screenshots (client + admin) into one large image (design-board style).",
    )
    parser.add_argument(
        "--input-dir",
        default="docs/demo/rendered/ui",
        help="Input directory produced by scripts/capture-ui.ps1 (default: docs/demo/rendered/ui).",
    )
    parser.add_argument(
        "--output",
        default="docs/demo/rendered/ui/ui-all.png",
        help="Output image path (default: docs/demo/rendered/ui/ui-all.png).",
    )
    parser.add_argument(
        "--background",
        default="#F8FAFC",
        help="Canvas background color (default: #F8FAFC).",
    )
    parser.add_argument(
        "--margin",
        type=int,
        default=48,
        help="Margin between images and around each section canvas (px).",
    )
    parser.add_argument(
        "--section-gap",
        type=int,
        default=120,
        help="Gap between client and admin sections (px).",
    )
    parser.add_argument(
        "--client-columns",
        type=int,
        default=4,
        help="Grid columns for client screenshots (default: 4).",
    )
    parser.add_argument(
        "--admin-columns",
        type=int,
        default=2,
        help="Grid columns for admin screenshots (default: 2).",
    )
    parser.add_argument(
        "--max-total-pixels",
        type=int,
        default=120_000_000,
        help="Auto downscale output to stay under this pixel count (default: 120000000). Set 0 to disable.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    client_dir = input_dir / "client"
    admin_dir = input_dir / "admin"

    client_paths = _sort_by_known_order(
        _list_pngs(client_dir),
        prefix="client",
        order=CLIENT_ORDER,
    )
    admin_paths = _sort_by_known_order(
        _list_pngs(admin_dir),
        prefix="admin",
        order=ADMIN_ORDER,
    )

    if not client_paths and not admin_paths:
        raise SystemExit(
            "No screenshots found.\n"
            f"- Expected: {client_dir}/*.png and/or {admin_dir}/*.png\n"
            "Run: powershell -ExecutionPolicy Bypass -File scripts/capture-ui.ps1"
        )

    client_sizes: list[tuple[int, int]] = []
    for p in client_paths:
        im = Image.open(p)
        try:
            client_sizes.append(im.size)
        finally:
            im.close()

    admin_sizes: list[tuple[int, int]] = []
    for p in admin_paths:
        im = Image.open(p)
        try:
            admin_sizes.append(im.size)
        finally:
            im.close()

    scale = _compute_scale_for_combined(
        client_sizes=client_sizes,
        admin_sizes=admin_sizes,
        margin=args.margin,
        gap=args.section_gap,
        client_columns=args.client_columns,
        admin_columns=args.admin_columns,
        max_total_pixels=args.max_total_pixels,
    )

    # Avoid borderline oversize due to rounding.
    if scale < 1.0 and args.max_total_pixels > 0:
        scaled_client = [(max(1, int(w * scale)), max(1, int(h * scale))) for w, h in client_sizes]
        scaled_admin = [(max(1, int(w * scale)), max(1, int(h * scale))) for w, h in admin_sizes]
        scaled_margin = max(1, int(args.margin * scale))
        scaled_gap = max(1, int(args.section_gap * scale))

        board_sizes: list[tuple[int, int]] = []
        if scaled_client:
            board_sizes.append(_compute_grid_size(scaled_client, scaled_margin, args.client_columns))
        if scaled_admin:
            board_sizes.append(_compute_grid_size(scaled_admin, scaled_margin, args.admin_columns))

        out_w = max(w for w, _ in board_sizes)
        out_h = sum(h for _, h in board_sizes) + (scaled_gap if len(board_sizes) > 1 else 0)
        pixels = out_w * out_h
        if pixels > args.max_total_pixels:
            scale *= math.sqrt(args.max_total_pixels / pixels)

    images_client = [_resize(Image.open(p).convert("RGB"), scale) for p in client_paths]
    images_admin = [_resize(Image.open(p).convert("RGB"), scale) for p in admin_paths]

    try:
        margin = max(1, int(args.margin * scale)) if scale < 1.0 else args.margin
        gap = max(1, int(args.section_gap * scale)) if scale < 1.0 else args.section_gap

        sections: list[Image.Image] = []
        if images_client:
            sections.append(
                _merge_grid(
                    images_client,
                    margin=margin,
                    background=args.background,
                    columns=args.client_columns,
                )
            )
        if images_admin:
            sections.append(
                _merge_grid(
                    images_admin,
                    margin=margin,
                    background=args.background,
                    columns=args.admin_columns,
                )
            )

        if len(sections) == 1:
            out = sections[0]
        else:
            out = _stack_vertical(sections, background=args.background, gap=gap)

        out.save(output_path, format="PNG", optimize=True)
    finally:
        for im in images_client:
            im.close()
        for im in images_admin:
            im.close()

    print(f"Wrote: {output_path} ({out.width}x{out.height})")


if __name__ == "__main__":
    main()

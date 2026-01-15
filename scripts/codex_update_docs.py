from __future__ import annotations

import pathlib


REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def read_utf8(relpath: str) -> str:
    return (REPO_ROOT / relpath).read_text(encoding="utf-8")


def write_utf8(relpath: str, content: str) -> None:
    # Normalize line endings to LF to match repo conventions.
    (REPO_ROOT / relpath).write_text(content, encoding="utf-8", newline="\n")


def update_ui_v2_todo() -> bool:
    path = "docs/ui-v2-todo.md"
    original = read_utf8(path)
    lines = original.splitlines()

    changed = False
    out: list[str] = []

    for line in lines:
        # UI-STD-P0-010: WeApp PageHeader already renders null (native nav bar).
        if line.startswith("- [ ] WeApp") and "`PageHeader`" in line and "native" not in line.lower():
            out.append(line.replace("- [ ]", "- [x]", 1))
            changed = True
            continue

        # UI-STD-P0-011: Industry tags must use public source in this round.
        if "`TagInput`" in line and "P0" in line and "P1" in line and "公共" in line:
            # Keep Chinese copy but flip the priority and add the new public endpoint hint.
            next_line = line.replace("（P0）；P1", "（P1）；P0", 1)
            if "/public/industry-tags" not in next_line:
                next_line = next_line + " (GET /public/industry-tags)"
            out.append(next_line)
            changed = True
            continue

        # Admin audit lists: keyword/region filters are confirmed P0 (OpenAPI/types/fixtures already updated).
        if "q/regionCode" in line and "待你确认" in line:
            out.append(
                "  - [ ] Keyword/region filters (q + regionCode) are confirmed P0: OpenAPI + api-types + fixtures done; implement Admin UI + mock (+ api if needed)."
            )
            changed = True
            continue

        # Search: demands/achievements filters still need public industry tag picker.
        if "GET /search/demands" in line and "GET /search/achievements" in line:
            out.append(
                "- [ ] `pages/search/index`: Demands/Achievements filters + sort fully aligned (incl. industryTags from GET /public/industry-tags)."
            )
            changed = True
            continue

        # Search: listing "more filters" not fully done yet (deposit/ipc/loc/legalStatus + price sorts).
        if "`pages/search/index`" in line and "FilterSheet" in line and "更多" in line:
            out.append(
                "- [ ] `pages/search/index`: Listing advanced filters (deposit/ipc/loc/legalStatus + industryTags from GET /public/industry-tags) and sort PRICE_ASC/DESC; keep FilterSheet/ChipGroup/FilterSummary aligned with ui-v2-filter-mapping.md."
            )
            changed = True
            continue

        # Orders: refactor filter UI to shared FilterSheet/ChipGroup (current page uses bespoke Popup+chips).
        if "GET /orders?status=" in line:
            out.append(
                "- [ ] `pages/orders/index`: Status filter UI refactor to shared FilterSheet/ChipGroup + FilterSummary (align GET /orders?status=)."
            )
            changed = True
            continue

        # Inventors: refactor filter UI to shared FilterSheet/ChipGroup.
        if "GET /search/inventors" in line and "FilterSheet" not in line:
            out.append(
                "- [ ] `pages/inventors/index`: Filters UI refactor to shared FilterSheet/ChipGroup + FilterSummary (regionCode + patentType; align GET /search/inventors)."
            )
            changed = True
            continue

        # Organizations: refactor filter UI to shared FilterSheet/ChipGroup.
        if "GET /public/organizations" in line and "FilterSheet" not in line:
            out.append(
                "- [ ] `pages/organizations/index`: Filters UI refactor to shared FilterSheet/ChipGroup + FilterSummary (regionCode + types; align GET /public/organizations)."
            )
            changed = True
            continue

        out.append(line)

    updated = "\n".join(out) + ("\n" if original.endswith("\n") else "")
    if changed:
        write_utf8(path, updated)
    return changed


def update_main_todo() -> bool:
    path = "docs/TODO.md"
    original = read_utf8(path)
    lines = original.splitlines()

    changed = False
    out: list[str] = []

    for line in lines:
        # Search: "more filters" needs explicit P0 scope.
        if "ui-v2-filter-mapping.md" in line and "更多筛选" in line:
            out.append(
                "- [ ] Filters: finish \"more filters\" per ui-v2-filter-mapping.md (LISTING: deposit/ipc/loc/legalStatus + public industry tags; DEMAND/ACHIEVEMENT: public industry tags)."
            )
            changed = True
            continue

        # Demand/Achievement planning doc exists now.
        if "Demand/Achievement module plan" in line and line.lstrip().startswith("- [ ]"):
            out.append(line.replace("- [ ]", "- [x]", 1))
            changed = True
            continue

        out.append(line)

    updated = "\n".join(out) + ("\n" if original.endswith("\n") else "")
    if changed:
        write_utf8(path, updated)
    return changed


def update_demand_achievement_todo() -> bool:
    path = "docs/todo-demand-achievement.md"
    original = read_utf8(path)

    marker = "## 1. 已确认（对齐结果）"
    if marker not in original:
        return False

    # Insert a concise note about public industry tags (P0) without rewriting the whole doc.
    insert_after = "后续实现与验收口径默认按这些结论执行。"
    if insert_after not in original:
        return False
    if "GET /public/industry-tags" in original:
        return False

    parts = original.split(insert_after, 1)
    updated = (
        parts[0]
        + insert_after
        + "\n\n- [x] Industry tags: use public source (GET /public/industry-tags) across Publish/Search/Filters (no free-text as the primary path).\n"
        + parts[1]
    )
    write_utf8(path, updated)
    return True


def main() -> int:
    changed_any = False
    changed_any |= update_ui_v2_todo()
    changed_any |= update_main_todo()
    changed_any |= update_demand_achievement_todo()
    return 0 if changed_any else 0


if __name__ == "__main__":
    raise SystemExit(main())


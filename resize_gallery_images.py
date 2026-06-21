#!/usr/bin/env python3
"""
resize_gallery_images.py

In-place batch resize for oversized gallery images. For each oversized
image found, the original is preserved in an `originals_backup/` folder
created inside that same subfolder, and the live file at its original
path is overwritten with a resized version -- so the app's existing
asset paths immediately serve the smaller file, no path changes needed
anywhere else.

Why this exists:
    Several gallery source images were found to be 7,000-11,000px on the
    long edge (e.g. NEWGIZA_06.png at 10704x8737). Browsers must fully
    decode + downscale these on the fly to fit a small grid tile, which is
    real, unavoidable CPU/GPU work that shows up as visible progressive
    rendering and scroll jank -- no CSS or React-level fix can avoid this,
    the asset itself has to be smaller before it's served.

Usage:
    python3 resize_gallery_images.py /path/to/BIM_CRD
    python3 resize_gallery_images.py /path/to/BIM_CRD --max-dim 2000
    python3 resize_gallery_images.py /path/to/BIM_CRD --dry-run

Behavior:
    - Recurses into subfolders. For each one containing oversized images,
      an `originals_backup/` folder is created INSIDE that subfolder
      (e.g. BIM_CRD/Newgiza/originals_backup/NEWGIZA_06.png), keeping
      backups co-located per project rather than in one global folder.
    - `originals_backup/` folders themselves are never walked into as
      source images, so re-runs don't try to back up backups.
    - SOURCE OF TRUTH RULE: if a backup already exists for a file, the
      script always resizes FROM the backup, never from the live path.
      This means it's safe to re-run with a different --max-dim later --
      you're always resizing the untouched original, never re-resizing
      an already-shrunk file (which would compound quality loss).
    - A file is only backed up the FIRST time it's resized. If a backup
      already exists, the live file is simply replaced with a fresh
      resize from that backup; the backup itself is never modified.
    - Images already at or below --max-dim (and with no existing backup)
      are left completely untouched -- no backup is created for files
      that aren't being changed.
    - Keeps PNG as PNG (lossless -- appropriate for line drawings, floor
      plans, and text-heavy BIM exports where JPEG artifacts would blur
      fine linework). Keeps JPG as JPG.
    - Uses Pillow's LANCZOS resampling for downscaling.

Requires: Pillow (pip install Pillow --break-system-packages)

SAFETY NOTE: this script overwrites files in place. Run with --dry-run
first to review what will happen. Consider testing on a copy of your
asset folder before running on the live/production path.
"""

import argparse
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow is required. Install it with:")
    print("  pip install Pillow --break-system-packages")
    sys.exit(1)

# Some source BIM exports exceed Pillow's default decompression-bomb
# safety threshold (e.g. 11350x9321 = ~105.8 megapixels, vs Pillow's
# default ~89.5 megapixel limit). These are known-legitimate large
# architectural exports, not malicious files, so the limit is raised
# rather than suppressing the warning -- this keeps the protection
# active for genuinely unexpected file sizes while allowing known-large
# assets through cleanly.
Image.MAX_IMAGE_PIXELS = 300_000_000  # ~300 megapixels

SUPPORTED_EXTENSIONS = {'.png', '.jpg', '.jpeg'}
BACKUP_DIR_NAME = 'originals_backup'


def find_source_images(root: Path):
    """
    Recursively find candidate images under root, skipping anything
    already inside a BACKUP_DIR_NAME folder (so backups are never
    treated as source images on a re-run).
    """
    for p in sorted(root.rglob('*')):
        if not p.is_file() or p.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        if BACKUP_DIR_NAME in p.relative_to(root).parts:
            continue
        yield p


def resize_into(src_path: Path, dst_path: Path, max_dim: int) -> tuple:
    """
    Resize src_path's image to fit max_dim on its longest edge and save
    to dst_path. Returns (new_width, new_height).
    """
    with Image.open(src_path) as img:
        width, height = img.size
        longest_edge = max(width, height)
        scale = max_dim / longest_edge
        new_width = round(width * scale)
        new_height = round(height * scale)

        resized = img.resize((new_width, new_height), Image.LANCZOS)
        if dst_path.suffix.lower() in ('.jpg', '.jpeg') and resized.mode in ('RGBA', 'P'):
            resized = resized.convert('RGB')
        resized.save(dst_path, optimize=True)
        return new_width, new_height


def process_image(live_path: Path, max_dim: int, dry_run: bool) -> str:
    """
    Process a single image in place. Returns a short status string.
    """
    backup_path = live_path.parent / BACKUP_DIR_NAME / live_path.name
    has_backup = backup_path.exists()

    # Determine the dimensions we'd resize FROM (backup if it exists,
    # otherwise the live file), since the backup is the source of truth
    # once it exists.
    source_for_dims = backup_path if has_backup else live_path
    with Image.open(source_for_dims) as img:
        src_width, src_height = img.size
    longest_edge = max(src_width, src_height)

    if longest_edge <= max_dim:
        if has_backup:
            # Backup exists but target dimension no longer requires
            # shrinking (e.g. --max-dim raised on a later run). Restore
            # the live file to match the backup exactly.
            if not dry_run:
                shutil.copy2(backup_path, live_path)
            return f"RESTORED {src_width}x{src_height} from backup (<= {max_dim}px)"
        return f"SKIPPED  {src_width}x{src_height} (already <= {max_dim}px, no backup needed)"

    if not dry_run:
        if not has_backup:
            backup_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(live_path, backup_path)
        new_w, new_h = resize_into(backup_path, live_path, max_dim)
    else:
        scale = max_dim / longest_edge
        new_w, new_h = round(src_width * scale), round(src_height * scale)

    backup_note = "backup exists" if has_backup else "backup created"
    return f"RESIZED  {src_width}x{src_height} -> {new_w}x{new_h} ({backup_note})"


def main():
    parser = argparse.ArgumentParser(
        description="In-place batch resize of oversized gallery images, with per-subfolder originals_backup."
    )
    parser.add_argument('root_dir', type=Path, help="Root folder to recurse through (e.g. BIM_CRD)")
    parser.add_argument('--max-dim', type=int, default=2200,
                         help="Max length of the longest edge in pixels (default: 2200)")
    parser.add_argument('--dry-run', action='store_true',
                         help="Report what would happen without writing any files")
    args = parser.parse_args()

    if not args.root_dir.is_dir():
        print(f"ERROR: directory not found: {args.root_dir}")
        sys.exit(1)

    image_paths = list(find_source_images(args.root_dir))

    if not image_paths:
        print(f"No PNG/JPG images found under {args.root_dir}")
        return

    print(f"Found {len(image_paths)} image(s) under {args.root_dir}")
    print(f"Max dimension target: {args.max_dim}px")
    print(f"Backups will be created as '{BACKUP_DIR_NAME}/' inside each subfolder that has resized images")
    if args.dry_run:
        print("(DRY RUN -- no files will be written or backed up)\n")
    else:
        print("(LIVE RUN -- live files will be overwritten in place)\n")

    resized_count = 0
    skipped_count = 0
    restored_count = 0
    failed_count = 0

    for live_path in image_paths:
        rel_path = live_path.relative_to(args.root_dir)
        try:
            status = process_image(live_path, args.max_dim, args.dry_run)
        except Exception as e:
            print(f"  FAILED   {rel_path}  ({e})")
            failed_count += 1
            continue

        if status.startswith("RESIZED"):
            resized_count += 1
        elif status.startswith("RESTORED"):
            restored_count += 1
        else:
            skipped_count += 1

        print(f"  {status:55s} {rel_path}")

    print(f"\nDone. {resized_count} resized, {restored_count} restored from backup, "
          f"{skipped_count} skipped (already small), {failed_count} failed.")


if __name__ == '__main__':
    main()

import os
import sys
import numpy as np
from PIL import Image

def slice_webtoon(image_path, output_dir, target_ratio=1.4, max_ratio=1.8):
    """
    Slices a tall vertical Webtoon image strip into separate pages/panels.
    Uses pixel intensity analysis to find horizontal blank spaces (cut lines)
    so it doesn't slice through text or active illustrations.
    """
    try:
        img = Image.open(image_path)
    except Exception as e:
        print(f"Error opening image: {e}")
        return False

    width, height = img.size
    aspect_ratio = height / width

    # If it's not a vertical strip, keep as is (copy it)
    if aspect_ratio <= max_ratio:
        filename = f"page-01.webp"
        img.save(os.path.join(output_dir, filename), "WEBP", quality=80)
        print(f"Saved original image (AR={aspect_ratio:.2f})")
        return [filename]

    # Convert to grayscale numpy array for row analysis
    gray_img = img.convert('L')
    img_data = np.array(gray_img)

    # Calculate row-wise standard deviation and mean
    # Solid colored rows (like white or black spaces between panels) have std dev close to 0
    row_std = np.std(img_data, axis=1)
    row_mean = np.mean(img_data, axis=1)

    # A row is a potential cut line if standard deviation is very low (uniform color)
    # or if it's almost pure white (>250) or pure black (<5)
    is_cut_row = (row_std < 5.0) | (row_mean > 252) | (row_mean < 8)

    # Find target slice height in pixels
    target_height = int(width * target_ratio)
    min_slice_height = int(width * 0.8)
    max_slice_height = int(width * 1.8)

    cut_indices = []
    current_y = 0

    while current_y < height:
        next_y_min = current_y + min_slice_height
        next_y_max = current_y + max_slice_height
        
        # If remaining height fits within max slice height, we are done
        if height - current_y <= max_slice_height:
            cut_indices.append(height)
            break

        # Search for the best cut row in the range [next_y_min, next_y_max]
        search_start = min(next_y_min, height - 1)
        search_end = min(next_y_max, height - 1)
        
        # Look for the index with lowest standard deviation (most uniform row)
        sub_range = is_cut_row[search_start:search_end]
        cut_candidates = np.where(sub_range)[0] + search_start

        if len(cut_candidates) > 0:
            # Prefer candidates closer to target_height
            ideal_y = current_y + target_height
            best_cut = cut_candidates[np.argmin(np.abs(cut_candidates - ideal_y))]
            cut_indices.append(int(best_cut))
            current_y = int(best_cut)
        else:
            # If no clean cut rows found, fallback to hard slice at target height
            fallback_cut = current_y + target_height
            cut_indices.append(fallback_cut)
            current_y = fallback_cut

    # Perform the slicing and save WebP files
    saved_files = []
    start_y = 0
    for idx, end_y in enumerate(cut_indices):
        page_num = idx + 1
        # Crop the slice
        box = (0, start_y, width, end_y)
        cropped_img = img.crop(box)
        
        filename = f"page-{page_num:03d}.webp"
        cropped_img.save(os.path.join(output_dir, filename), "WEBP", quality=80)
        saved_files.append(filename)
        
        start_y = end_y

    print(f"Slicing complete: Created {len(saved_files)} pages from strip of height {height}px")
    return saved_files

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python slice-panels.py <image_path> <output_dir>")
        sys.exit(1)
        
    image_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    os.makedirs(output_dir, exist_ok=True)
    slice_webtoon(image_path, output_dir)

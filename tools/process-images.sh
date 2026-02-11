#!/bin/bash

# ArtSiteMaker - Image Processing Script
# Processes raw images into thumb, medium, and large sizes

set -e

# Configuration
RAW_DIR="${RAW_DIR:-../raw/pieces}"
OUTPUT_DIR="${OUTPUT_DIR:-public-site/public/images/pieces}"
THUMB_HEIGHT=300
MEDIUM_WIDTH=1062
LARGE_WIDTH=2000
QUALITY=85

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}ArtSiteMaker - Image Processor${NC}"
echo "=================================="
echo "Raw directory: $RAW_DIR"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Create output directories
mkdir -p "$OUTPUT_DIR/thumb"
mkdir -p "$OUTPUT_DIR/medium"
mkdir -p "$OUTPUT_DIR/large"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo -e "${RED}Error: ImageMagick is not installed.${NC}"
    echo "Install with: sudo apt install imagemagick"
    exit 1
fi

# Process each image
processed=0
skipped=0

shopt -s nullglob nocaseglob
for raw_file in "$RAW_DIR"/*.jpg "$RAW_DIR"/*.jpeg "$RAW_DIR"/*.png "$RAW_DIR"/*.webp; do
    filename=$(basename "$raw_file")
    # Normalize extension to lowercase jpg
    basename="${filename%.*}"
    output_name="${basename}.jpg"
    
    thumb_file="$OUTPUT_DIR/thumb/$output_name"
    medium_file="$OUTPUT_DIR/medium/$output_name"
    large_file="$OUTPUT_DIR/large/$output_name"
    
    # Check if processing needed (raw file newer than outputs)
    if [ -f "$thumb_file" ] && [ -f "$medium_file" ] && [ -f "$large_file" ]; then
        if [ "$raw_file" -ot "$thumb_file" ]; then
            echo -e "${YELLOW}Skipping${NC} $filename (already processed)"
            skipped=$((skipped + 1))
            continue
        fi
    fi
    
    echo -e "${GREEN}Processing${NC} $filename..."
    
    # Get image dimensions for aspect ratio check
    dimensions=$(identify -format "%wx%h" "$raw_file" 2>/dev/null || echo "0x0")
    width=$(echo "$dimensions" | cut -d'x' -f1)
    height=$(echo "$dimensions" | cut -d'x' -f2)
    
    if [ "$width" -eq 0 ] || [ "$height" -eq 0 ]; then
        echo -e "${RED}  Error: Could not read dimensions${NC}"
        continue
    fi
    
    echo "  Dimensions: ${width}x${height}"
    
    # Generate thumbnail (fixed height)
    echo "  → Generating thumbnail (${THUMB_HEIGHT}px height)..."
    convert "$raw_file" \
        -resize "x${THUMB_HEIGHT}" \
        -quality $QUALITY \
        -strip \
        -auto-orient \
        "$thumb_file"
    
    # Generate medium (fixed width)
    echo "  → Generating medium (${MEDIUM_WIDTH}px width)..."
    convert "$raw_file" \
        -resize "${MEDIUM_WIDTH}x>" \
        -quality $QUALITY \
        -strip \
        -auto-orient \
        "$medium_file"
    
    # Generate large (fixed width, only if original is larger)
    if [ "$width" -gt "$LARGE_WIDTH" ]; then
        echo "  → Generating large (${LARGE_WIDTH}px width)..."
        convert "$raw_file" \
            -resize "${LARGE_WIDTH}x>" \
            -quality $QUALITY \
            -strip \
            -auto-orient \
            "$large_file"
    else
        # Just copy medium as large if original isn't big enough
        echo "  → Original smaller than large size, copying medium..."
        cp "$medium_file" "$large_file"
    fi
    
    processed=$((processed + 1))
    echo -e "  ${GREEN}Done${NC}"
done

echo ""
echo "=================================="
echo -e "${GREEN}Processing complete!${NC}"
echo "Processed: $processed files"
echo "Skipped: $skipped files"

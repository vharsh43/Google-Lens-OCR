#!/usr/bin/env python3
"""
PDF to Image conversion using PyPDF2 + Pillow
This is a fallback version when PyMuPDF (fitz) is not available
"""

import os
import sys
import time
from io import BytesIO
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

try:
    from PyPDF2 import PdfReader
    print("✅ Using PyPDF2 for PDF processing")
except ImportError:
    print("❌ PyPDF2 not available")
    sys.exit(1)

try:
    from PIL import Image, ImageDraw, ImageFont
    print("✅ PIL (Pillow) available for image generation")
except ImportError:
    print("❌ PIL (Pillow) not available")
    sys.exit(1)

# Fixed DPI setting for all exported images
EXPORT_DPI = 300

def pdf_to_png_pypdf2(pdf_path, input_root, output_root, position=0):
    """
    Convert PDF to PNG using PyPDF2 (text extraction) + PIL (image generation)
    This creates text-based images since PyPDF2 doesn't handle image rendering
    """
    try:
        rel_path = os.path.relpath(pdf_path, input_root)
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        output_folder = os.path.join(output_root, os.path.dirname(rel_path), base_name)
        os.makedirs(output_folder, exist_ok=True)

        # Read PDF
        with open(pdf_path, 'rb') as file:
            pdf_reader = PdfReader(file)
            total_pages = len(pdf_reader.pages)

        print(f"📄 Processing {base_name}: {total_pages} pages")

        for page_num, page in enumerate(pdf_reader.pages):
            try:
                # Extract text from the page
                text = page.extract_text()
                
                # Create an image with the extracted text
                # This is a fallback approach - not ideal but functional
                img_width = int(8.5 * EXPORT_DPI)  # 8.5 inches at specified DPI
                img_height = int(11 * EXPORT_DPI)  # 11 inches at specified DPI
                
                # Create white background
                img = Image.new('RGB', (img_width, img_height), color='white')
                draw = ImageDraw.Draw(img)
                
                # Try to use a default font
                try:
                    font = ImageFont.load_default()
                except:
                    font = None
                
                # Draw text on image (simple text layout)
                if text.strip():
                    # Split text into lines and draw
                    lines = text.split('\n')
                    y_offset = 50
                    line_height = 30
                    
                    for line in lines[:40]:  # Limit to first 40 lines
                        if y_offset > img_height - 100:
                            break
                        
                        # Truncate long lines
                        if len(line) > 80:
                            line = line[:77] + "..."
                        
                        draw.text((50, y_offset), line, fill='black', font=font)
                        y_offset += line_height
                else:
                    # If no text, add a placeholder
                    draw.text((50, 50), f"Page {page_num + 1} - No extractable text", 
                             fill='red', font=font)
                
                # Add page number
                draw.text((img_width - 150, img_height - 50), 
                         f"Page {page_num + 1}/{total_pages}", 
                         fill='gray', font=font)
                
                # Save as PNG
                dst = os.path.join(output_folder, f"{base_name}_{page_num+1:04d}.png")
                img.save(dst, 'PNG', dpi=(EXPORT_DPI, EXPORT_DPI))
                
                print(f"  ✅ Page {page_num + 1}")
                
            except Exception as page_error:
                print(f"  ❌ Page {page_num + 1} failed: {page_error}")
                continue

        return (pdf_path, total_pages, None)
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Failed to process {pdf_path}: {error_msg}")
        return (pdf_path, 0, error_msg)

def process_pdfs(input_folder, output_root, log_file, max_workers=4):
    """Process all PDFs in the input folder"""
    pdf_paths = []
    for root, _, files in os.walk(input_folder):
        for file in files:
            if file.lower().endswith('.pdf'):
                pdf_paths.append(os.path.join(root, file))

    if not pdf_paths:
        print("No PDF files found in input folder")
        return

    print(f"Found {len(pdf_paths)} PDF files to process")

    with open(log_file, 'w', encoding='utf-8') as log:
        log.write(f"PyPDF2 Conversion started at {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        log.write(f"Note: Using PyPDF2 fallback method (text-only conversion)\n\n")

        successful = 0
        failed = 0

        for pdf_path in pdf_paths:
            result = pdf_to_png_pypdf2(pdf_path, input_folder, output_root)
            pdf_file, num_pages, error = result
            
            if error:
                msg = f"❌ Error converting {pdf_file}: {error}"
                failed += 1
            else:
                msg = f"✅ Completed {pdf_file} → {num_pages} pages"
                successful += 1
                
            print(msg)
            log.write(msg + "\n")

        summary = f"\nConversion Summary:\n✅ Successful: {successful}\n❌ Failed: {failed}"
        print(summary)
        log.write(summary + "\n")

def main():
    input_folder = './1_New_File_Process_PDF_2_PNG/'
    output_root = './2_Converted_PNGs/'
    log_file = './logs/ConversionLog_PyPDF2.txt'
    
    # Ensure directories exist
    os.makedirs(os.path.dirname(log_file), exist_ok=True)
    os.makedirs(output_root, exist_ok=True)
    
    print("🚀 Starting PDF to PNG conversion using PyPDF2 fallback method")
    print("⚠️  Note: This method creates text-based images, not visual reproductions")
    
    # Process PDFs
    process_pdfs(input_folder, output_root, log_file, max_workers=2)
    
    # Create completion flag file for pipeline integration
    completion_file = 'pdf_conversion_complete.flag'
    with open(completion_file, 'w') as f:
        f.write(f"PyPDF2 conversion completed at {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Output directory: {output_root}\n")
        f.write("Note: Used PyPDF2 fallback method\n")
    
    print(f"✅ Conversion complete! Flag created: {completion_file}")

if __name__ == "__main__":
    start_time = time.time()
    main()
    elapsed = time.time() - start_time
    mins, secs = divmod(elapsed, 60)
    print(f"--- {int(mins)} minutes and {int(secs)} seconds ---")
    print("Conversion log saved to ConversionLog_PyPDF2.txt")
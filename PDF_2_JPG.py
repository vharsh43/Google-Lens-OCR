import os
import time
import fitz  # PyMuPDF
from tqdm import tqdm
from concurrent.futures import ProcessPoolExecutor, as_completed

# Fixed DPI setting for all exported images
EXPORT_DPI = 300

def pdf_to_png(fpaths):
    pdf_path, input_root, output_root, position = fpaths
    try:
        rel_path = os.path.relpath(pdf_path, input_root)
        base_name = os.path.splitext(os.path.basename(pdf_path))[0]
        output_folder = os.path.join(output_root, os.path.dirname(rel_path), base_name)
        os.makedirs(output_folder, exist_ok=True)

        doc = fitz.open(pdf_path)
        total_pages = doc.page_count

        with tqdm(total=total_pages, desc=base_name, position=position, leave=True, unit="page") as bar:
            for i in range(total_pages):
                page = doc.load_page(i)
                zoom = EXPORT_DPI / 72  # DPI scaling: target DPI / PDF default DPI (72)
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                dst = os.path.join(output_folder, f"{base_name}_{i+1:04d}.png")
                pix.save(dst)
                bar.update(1)
        doc.close()
        return (pdf_path, total_pages, None)
    except Exception as e:
        return (pdf_path, 0, str(e))

def process_pdfs(input_folder, output_root, log_file, max_workers=8):
    pdf_paths = []
    for root, _, files in os.walk(input_folder):
        for file in files:
            if file.lower().endswith('.pdf'):
                pdf_paths.append(os.path.join(root, file))

    with open(log_file, 'w', encoding='utf-8') as log, \
         tqdm(total=len(pdf_paths), desc="Overall PDF Progress", position=0, leave=True, unit="file") as overall_bar:

        log.write(f"Conversion started at {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")

        tasks = [
            (pdf_path, input_folder, output_root, idx + 1)
            for idx, pdf_path in enumerate(pdf_paths)
        ]

        with ProcessPoolExecutor(max_workers=max_workers) as executor:
            futures = executor.map(pdf_to_png, tasks)

            for result in futures:
                pdf_path, num_pages, error = result
                if error:
                    msg = f"Error converting {pdf_path}: {error}"
                else:
                    msg = f"Completed {pdf_path} → {num_pages} pages"
                print(msg)
                log.write(msg + "\n")
                overall_bar.update(1)

def main():
    input_folder = './New_File_Process_PDF_2_JPG/'
    output_root = './Converted_PNGs/'
    log_file = 'ConversionLog.txt'
    
    # Process PDFs
    process_pdfs(input_folder, output_root, log_file, max_workers=4)
    
    # Create completion flag file for pipeline integration
    completion_file = 'pdf_conversion_complete.flag'
    with open(completion_file, 'w') as f:
        f.write(f"PDF conversion completed at {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Output directory: {output_root}\n")
    
    print(f"✅ Conversion complete! Flag created: {completion_file}")

if __name__ == "__main__":
    start_time = time.time()
    main()
    elapsed = time.time() - start_time
    mins, secs = divmod(elapsed, 60)
    print(f"--- {int(mins)} minutes and {int(secs)} seconds ---")
    print("Conversion log saved to ConversionLog.txt")

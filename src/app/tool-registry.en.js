// English translations of tool titles/descriptions, keyed by tool id.
// Kept separate from tool-registry.js so the registry (and its run() logic)
// stays untouched — only display strings are translated here.
export const EN_TOOLS = {
  'merge-pdf': {
    title: 'Merge PDF',
    description: 'Combine several PDF files into one document, in the order you pick them.'
  },
  'split-pdf': {
    title: 'Split PDF',
    description: 'Break a PDF into multiple files by page range (e.g. 1-3,4-6).'
  },
  'extract-pages': {
    title: 'Extract Pages',
    description: 'Click directly on page thumbnails to pick the ones to pull into a new document — no need to count page numbers manually.'
  },
  'delete-pages': {
    title: 'Delete Pages',
    description: 'Click directly on page thumbnails to pick the ones to delete — no need to count page numbers manually.'
  },
  'rotate-pages': {
    title: 'Rotate Pages',
    description: 'Rotate all or some PDF pages by 90/180/270 degrees.'
  },
  'bates-numbering': {
    title: 'Bates Numbering',
    description: 'Add sequential Bates numbers (common for legal documents) to one or more PDFs.'
  },
  'add-watermark-text': {
    title: 'Text Watermark',
    description: 'Add a diagonal text watermark to every page of a PDF.'
  },
  'add-page-numbers': {
    title: 'Page Numbers',
    description: 'Add page numbers to the whole document with your choice of format and position.'
  },
  'header-footer': {
    title: 'Header & Footer',
    description: 'Add header (top) and footer (bottom) text to every page.'
  },
  'edit-metadata': {
    title: 'Edit Metadata',
    description: 'Change the title, author, subject, and keywords of a PDF document.'
  },
  'compress-pdf': {
    title: 'Compress PDF',
    description: 'Shrink file size by reducing the quality/resolution of images inside the PDF.'
  },
  'edit-page-text': {
    title: 'Edit Page Text',
    description: 'Click existing text on any page to replace it in place. Old text is covered with an auto-matched background color, new text is written in the closest standard font (serif/sans-serif/monospace) — good for short corrections/typos, not long paragraph replacement.'
  },
  'pdf-to-word': {
    title: 'PDF to Word',
    description: 'Extract PDF text & paragraph structure into a Word document (.docx). Text-based reconstruction, not a pixel-perfect layout clone.'
  },
  'word-to-pdf': {
    title: 'Word to PDF',
    description: 'Convert a Word document (.docx) to PDF, preserving basic headings/lists/formatting.'
  },
  'pdf-to-ppt': {
    title: 'PDF to PowerPoint',
    description: 'Turn each PDF page into a single image slide in a .pptx file.'
  },
  'ppt-to-pdf': {
    title: 'PowerPoint to PDF',
    description: 'Reconstruct the text & images of each .pptx slide as one PDF page per slide.'
  },
  'pdf-to-excel': {
    title: 'PDF to Excel',
    description: 'Extract tables from a PDF into an Excel worksheet (.xlsx) using text-position heuristics.'
  },
  'excel-to-pdf': {
    title: 'Excel to PDF',
    description: 'Print every Excel (.xlsx) sheet as a searchable text table inside a PDF.'
  },
  'pdf-to-image': {
    title: 'PDF to Image',
    description: 'Render every PDF page as PNG/JPG (a single file, or a .zip for multiple pages).'
  },
  'image-to-pdf': {
    title: 'Image to PDF',
    description: 'Combine one or more images (JPG/PNG) into a single PDF, one image per page.'
  },
  'pdf-to-html': {
    title: 'PDF to HTML',
    description: 'Export a PDF as a reflowable HTML page, comfortable to read in a browser.'
  },
  'html-to-pdf': {
    title: 'HTML to PDF',
    description: 'Convert an HTML file to PDF (rendered & paginated as page images).'
  },
  'pdf-to-text': {
    title: 'PDF to Text',
    description: 'Extract all PDF text into a plain .txt file.'
  },
  'text-to-pdf': {
    title: 'Text to PDF',
    description: 'Turn a .txt file into a PDF with automatic layout (word-wrap & page numbering).'
  },
  'pdf-to-pdfa': {
    title: 'PDF to PDF/A',
    description: 'Mark a document with PDF/A-1B compliance metadata for archival needs (best-effort, not full veraPDF validation).'
  },
  'excel-to-csv': {
    title: 'Excel to CSV',
    description: "Export an Excel file's first sheet to CSV."
  },
  'csv-to-excel': {
    title: 'CSV to Excel',
    description: 'Import a CSV file into an Excel (.xlsx) workbook.'
  },
  'excel-to-sav': {
    title: 'Excel to SPSS (.sav)',
    description: "Convert an Excel file's first sheet into an uncompressed, widely compatible SPSS (.sav) data file. Column types (numeric/text) are auto-detected."
  },
  'sav-to-excel': {
    title: 'SPSS (.sav) to Excel',
    description: 'Read an SPSS data file (.sav, including bytecode-compressed ones) into an Excel workbook.'
  },
  'archive-to-zip': {
    title: 'Archive to ZIP',
    description: 'Extract RAR/7z/TAR/GZIP/BZIP2/ISO and repack the contents into a single standard .zip file.'
  },
  'protect-pdf': {
    title: 'Lock with Password',
    description: 'Encrypt a PDF with an opening password (AES-256) and print/copy/edit permission limits.'
  },
  'remove-password': {
    title: 'Unlock Password',
    description: 'Remove encryption/password from a locked PDF (you need to know the password).'
  },
  'redact-pdf': {
    title: 'Redact Keywords & Data Patterns',
    description: 'Find & permanently remove text matching keywords, and/or auto-detect sensitive data patterns (email, phone, national ID, credit card). The flatten option (recommended) rasterizes pages so text truly cannot be recovered.'
  },
  'sanitize-pdf': {
    title: 'Clean Document',
    description: 'Remove metadata, hidden JavaScript, and embedded attachments from a PDF before sharing.'
  },
  'ocr-searchable-pdf': {
    title: 'Scanned PDF to Searchable PDF',
    description: 'Recognize text in a scanned PDF and embed an invisible text layer so it can be searched/copied.'
  },
  'ocr-extract-text': {
    title: 'Extract Text from Scan',
    description: 'Recognize text in a scanned PDF/image and export it as a .txt file.'
  },
  'fill-sign': {
    title: 'Fill & Sign',
    description: 'Click directly on page 1 to place text or a signature image — no need to figure out coordinates manually.'
  },
  'markup-highlight-ink': {
    title: 'Comments & Markup',
    description: 'Highlight text, draw freehand ink, and add sticky notes — all by clicking directly on the page 1 preview. Real PDF annotations, visible in Adobe Reader/any PDF viewer.'
  },
  'forms-designer': {
    title: 'Forms Designer',
    description: 'Place AcroForm fields (text, checkbox, radio, dropdown) visually on a PDF page — real fields, fillable in Adobe Reader/any PDF viewer.'
  },
  'export-form-data': {
    title: 'Export Form Data',
    description: 'Read field values from a fillable PDF and export them as CSV, FDF, or XFDF.'
  },
  'digital-signature': {
    title: 'Certified Digital Signature',
    description: 'Cryptographically sign a PDF (PAdES-style, detached PKCS#7) with your own .p12/.pfx certificate, or generate a disposable test certificate.'
  },
  'verify-signature': {
    title: 'Verify Signature',
    description: 'Check whether a PDF digital signature is valid and the document has not changed since it was signed.'
  },
  'accessibility-checker': {
    title: 'Accessibility Checker',
    description: 'Heuristic check: document title, language, tag structure (Tagged PDF), and embedded fonts. Report downloads as HTML. (Not full auto-tagging — see ROADMAP.md.)'
  },
  'measure-tool': {
    title: 'Measure Tool',
    description: 'Calibrate scale on a technical drawing/floor plan, then measure distance and area. Export results as an annotated PDF.'
  },
  'compare-pdf': {
    title: 'Compare Documents',
    description: 'Visual (pixel, per-page) and text diff between two PDF versions. Pick 2 files: the first is treated as Document A (original), the second as Document B (revision). Result downloads as an HTML report.'
  },
  'portfolio-builder': {
    title: 'PDF Portfolio Builder',
    description: 'Combine many files (PDF, images, Office, etc.) as attachments + an index page inside a single PDF Portfolio recognized by Acrobat/Reader.'
  },
  'automation-wizard': {
    title: 'Automation Wizard (Batch)',
    description: 'Chain several PDF tools into one sequence, then run it automatically across many files at once.'
  }
};

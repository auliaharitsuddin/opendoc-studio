# Third-Party Licenses

OpenDoc Studio is MIT-licensed. It bundles the following open-source
libraries and data files. All are permissively licensed (MIT/Apache-2.0/BSD) —
deliberately, so the whole extension can stay simple to redistribute. No
AGPL/GPL-licensed engine (e.g. MuPDF, qpdf) is used, which is why some
features (e.g. PDF encryption) use smaller, permissively-licensed packages
instead of the more common copyleft PDF toolkits.

| Package | License | Used for |
|---|---|---|
| [pdf-lib](https://github.com/Hopding/pdf-lib) | MIT | Core PDF creation/editing/organizing |
| [pdfjs-dist](https://github.com/mozilla/pdf.js) | Apache-2.0 | PDF rendering & text extraction |
| [@pdfsmaller/pdf-encrypt](https://www.npmjs.com/package/@pdfsmaller/pdf-encrypt) | MIT | PDF password encryption (AES-256/RC4) |
| [@pdfsmaller/pdf-decrypt](https://www.npmjs.com/package/@pdfsmaller/pdf-decrypt) | MIT | PDF password removal |
| [mammoth](https://github.com/mwilliamson/mammoth.js) | BSD-2-Clause | DOCX → HTML for Word-to-PDF |
| [docx](https://github.com/dolanmiu/docx) | MIT | DOCX generation for PDF-to-Word |
| [pptxgenjs](https://github.com/gitbrent/PptxGenJS) | MIT | PPTX generation for PDF-to-PowerPoint |
| [xlsx (SheetJS CE)](https://git.sheetjs.com/sheetjs/sheetjs) | Apache-2.0 | Excel/CSV read & write |
| [jszip](https://github.com/Stuk/jszip) | MIT | ZIP creation/reading |
| [libarchive.js](https://github.com/nika-begiashvili/libarchivejs) | MIT (libarchive itself: BSD-2-Clause) | RAR/7z/TAR/GZIP/BZIP2/ISO extraction |
| [tesseract.js](https://github.com/naptha/tesseract.js) + tesseract.js-core | Apache-2.0 | Offline OCR |
| [html2canvas](https://github.com/niklasvh/html2canvas) | MIT | HTML/DOCX-to-PDF rasterization |
| [idb-keyval](https://github.com/jakearchibald/idb-keyval) | Apache-2.0 | Ephemeral batch-mode scratch storage |
| [diff](https://github.com/kpdecker/jsdiff) | BSD-3-Clause | Text comparison (roadmap: Compare Files) |
| [node-forge](https://github.com/digitalbazaar/forge) | BSD-3-Clause / GPL (dual) | Roadmap: certificate-based digital signing |

Trained OCR data (`public/tessdata/*.traineddata.gz`) is redistributed from
the [tesseract.js-data](https://github.com/naptha/tessdata) project (Apache-2.0),
itself derived from Tesseract OCR's official language data (Apache-2.0).

Run `npm ls` for the exact resolved version of each package.

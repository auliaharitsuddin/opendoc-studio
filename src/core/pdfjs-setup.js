// Side-effect-only module: points pdf.js at its own bundled worker script
// instead of the relative "./pdf.worker.mjs" it defaults to (which doesn't
// exist at that path in our build and would otherwise fall back to a slower,
// unverified "fake worker" mode). Every file that calls pdfjs-dist's
// getDocument() must import this first — engine.worker.js and ocr.js/
// pdf-canvas.js (which run outside engine.worker.js) each do so once.
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

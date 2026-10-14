// Helpers to turn an uploaded brochure (PDF or images) into page images in the browser.

export interface PageImage {
  dataUrl: string;
  width: number;
  height: number;
}

const MAX_PAGES = 30;

async function canvasToPage(canvas: HTMLCanvasElement, quality: number): Promise<PageImage> {
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: canvas.width, height: canvas.height };
}

export async function imageFileToPage(file: File, maxW = 1600, quality = 0.82): Promise<PageImage> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return canvasToPage(canvas, quality);
}

export async function pdfToPages(file: File, maxW = 1600, quality = 0.82, onProgress?: (done: number, total: number) => void): Promise<PageImage[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const total = Math.min(pdf.numPages, MAX_PAGES);
  const pages: PageImage[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, maxW / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push(await canvasToPage(canvas, quality));
    onProgress?.(i, total);
  }
  return pages;
}

export async function filesToPages(files: File[], onProgress?: (done: number, total: number) => void): Promise<PageImage[]> {
  const out: PageImage[] = [];
  for (const f of files) {
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      out.push(...(await pdfToPages(f, 1600, 0.82, onProgress)));
    } else if (f.type.startsWith('image/')) {
      out.push(await imageFileToPage(f));
      onProgress?.(out.length, files.length);
    }
    if (out.length >= MAX_PAGES) break;
  }
  return out.slice(0, MAX_PAGES);
}

/** Smaller copy for sending to the AI endpoint (keeps the request under Vercel's 4.5 MB body limit). */
export async function shrinkDataUrl(dataUrl: string, maxW = 1100, quality = 0.7): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

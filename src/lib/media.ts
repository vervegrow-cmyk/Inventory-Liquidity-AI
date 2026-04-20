import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import type { SpreadsheetProduct } from '../types';
import { findByKeywords } from './utils';

/** Compress a base64 image to max 1024px and JPEG 80% before sending to vision API. */
export function compressImageBase64(base64: string, maxPx = 1024, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
    };
    img.onerror = () => resolve(base64);
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

export function extractVideoFrame(file: File): Promise<{ base64: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto'; video.src = url;

    const capture = () => {
      try {
        const w = video.videoWidth || 640, h = video.videoHeight || 480;
        const scale = Math.min(1, 1280 / w);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        URL.revokeObjectURL(url);
        resolve({ base64: dataUrl.split(',')[1], preview: dataUrl });
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };

    video.onloadeddata = () => {
      if (video.duration > 0.5) { video.onseeked = capture; video.currentTime = Math.min(1, video.duration * 0.1); }
      else capture();
    };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('视频加载失败')); };
    setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('视频处理超时')); }, 15000);
  });
}

export async function parseSpreadsheet(file: File): Promise<{ text: string; rows: string[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
        const text = allRows.slice(0, 100).map(r => (r as unknown[]).map(String).join(' | ')).join('\n');
        resolve({ text, rows: allRows.slice(0, 50).map(r => (r as unknown[]).map(String)) });
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

export async function extractExcelImages(file: File): Promise<string[]> {
  try {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const mediaFiles = Object.keys(zip.files)
      .filter(name => /^xl\/media\//i.test(name) && /\.(png|jpe?g|gif|webp|bmp|tiff?)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const urls: string[] = [];
    for (const path of mediaFiles) {
      const ext = path.split('.').pop()?.toLowerCase() ?? 'jpeg';
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const b64 = await zip.files[path].async('base64');
      urls.push(`data:${mime};base64,${b64}`);
    }
    return urls;
  } catch {
    return [];
  }
}

export function extractProducts(rows: string[][]): SpreadsheetProduct[] {
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].filter(c => c.trim()).length >= 3) { headerIdx = i; break; }
  }
  if (headerIdx === -1) return [];

  const headers = rows[headerIdx].map(h => h.trim());
  const dataRows = rows.slice(headerIdx + 1).filter(r => r.some(c => c.trim()));
  if (dataRows.length === 0) return [];

  return dataRows.map((row, idx) => {
    const details: Record<string, string> = {};
    headers.forEach((h, i) => {
      const v = (row[i] ?? '').trim();
      if (h && v) details[h] = v;
    });

    const name =
      findByKeywords(details, ['产品名称', '商品名称', '名称', '品名', 'name', 'product']) ||
      findByKeywords(details, ['产品编号', '编号', 'sku', 'id']) ||
      `产品 ${idx + 1}`;
    const category = findByKeywords(details, ['类目', '类别', '分类', '品类', 'category']) || '其他';
    const brand = findByKeywords(details, ['品牌', 'brand']) || '未知';
    const rowText = Object.entries(details).map(([k, v]) => `${k}: ${v}`).join('，');

    return { name, category, brand, rowText, details };
  });
}

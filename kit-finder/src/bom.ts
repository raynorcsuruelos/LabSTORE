import type { BomPart, Kit } from './types';

const isPartCol = (l: string) => l.includes('part') || l === 'pn' || l === 'code' || l === 'item';
const isDescCol = (l: string) => l.includes('desc') || l === 'name' || l === 'itemname';
const isQtyCol = (l: string) => l.includes('qty') || l.includes('quantity') || l === 'count' || l === 'amount';

// Maps rows with any common column naming ("Part Number", "partNumber", "Qty"...) to BOM lines
export function normaliseRows(rows: Record<string, unknown>[]): BomPart[] {
  return rows
    .map(row => {
      const keys = Object.keys(row);
      const pick = (test: (l: string) => boolean) => {
        const key = keys.find(k => test(k.toLowerCase().trim()));
        return key && row[key] != null ? String(row[key]).trim() : '';
      };
      return { partNumber: pick(isPartCol), description: pick(isDescCol), qty: pick(isQtyCol) || '1' };
    })
    .filter(p => p.partNumber || p.description);
}

// Reads a BOM from .xlsx / .xls / .ods / .csv or .json
export async function importBomFile(file: File): Promise<BomPart[]> {
  if (/\.json$/i.test(file.name)) {
    const parsed = JSON.parse(await file.text());
    const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.rows) ? parsed.rows : Array.isArray(parsed?.parts) ? parsed.parts : [];
    return normaliseRows(rows);
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return normaliseRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }));
}

const fileBase = (kit: Kit) => `BOM_${kit.asset}_${kit.maintenance}_L${kit.level}`.replace(/[^\w.-]+/g, '_');

export async function exportBom(kit: Kit, format: 'xlsx' | 'ods' | 'json') {
  const rows = kit.parts.map(p => ({ 'Part Number': p.partNumber, Description: p.description, Quantity: p.qty }));
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase(kit)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    return;
  }
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 24 }, { wch: 40 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BOM');
  XLSX.writeFile(wb, `${fileBase(kit)}.${format}`, { bookType: format });
}

export function bomAsText(kit: Kit) {
  return ['Part Number\tDescription\tQuantity', ...kit.parts.map(p => `${p.partNumber}\t${p.description}\t${p.qty}`)].join('\n');
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

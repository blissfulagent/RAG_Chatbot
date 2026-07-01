import fs from 'fs/promises';
import { PDFParse } from 'pdf-parse';

export async function extractText(filePath: string, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const buffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return fs.readFile(filePath, 'utf-8');
  }

  throw new Error(`Unsupported MIME type: ${mimeType}`);
}

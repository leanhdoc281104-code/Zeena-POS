
import { SaleItem, StoreSettings } from '../types';

export const generateReceiptImage = async (
  sale: { items: SaleItem[], total: number, discount?: number, paymentMethod: string, id: string },
  settings: StoreSettings | null
): Promise<ArrayBuffer> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // Thermal printers are typically 384 or 576 pixels wide (58mm or 80mm)
  // We'll design for 384px (58mm) as it's more common and fits in 80mm too
  const width = 384;
  let currentY = 0;

  const items = (sale as any).items || (sale as any).cart || [];

  // Pre-calculate height
  let estimatedHeight = 150; // Headers
  if (settings?.storeLogo) estimatedHeight += 100;
  estimatedHeight += items.length * 40; // Items
  estimatedHeight += 150; // Totals and footer

  canvas.width = width;
  canvas.height = estimatedHeight;

  // Setup styles
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, estimatedHeight);
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const drawText = (text: string, y: number, font: string, align: 'center' | 'left' | 'right' = 'center') => {
    ctx.font = font;
    ctx.textAlign = align;
    const x = align === 'center' ? width / 2 : align === 'left' ? 10 : width - 10;
    ctx.fillText(text, x, y);
    return y + parseInt(font) + 10;
  };

  // 1. Logo
  if (settings?.storeLogo) {
    try {
      const img = new Image();
      img.src = settings.storeLogo;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const logoWidth = 100;
      const logoHeight = (img.height / img.width) * logoWidth;
      ctx.drawImage(img, (width - logoWidth) / 2, currentY, logoWidth, logoHeight);
      currentY += logoHeight + 10;
    } catch (e) {
      console.warn('Failed to load logo for printing', e);
    }
  }

  // 2. Store Name
  currentY = drawText(settings?.storeName || 'نظام زينة', currentY, 'bold 28px sans-serif');
  if (settings?.storeAddress) {
    currentY = drawText(settings.storeAddress, currentY, '18px sans-serif');
  }

  currentY = drawText('--------------------------------', currentY, '18px sans-serif');
  currentY = drawText(`رقم الفاتورة: ${sale.id.slice(0, 8)}`, currentY, '18px sans-serif');
  currentY = drawText(`التاريخ: ${new Date().toLocaleString('ar-EG')}`, currentY, '16px sans-serif');
  currentY = drawText('--------------------------------', currentY, '18px sans-serif');

  // 3. Items Header
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('المنتج', width - 10, currentY);
  ctx.textAlign = 'center';
  ctx.fillText('الكمية', width / 2, currentY);
  ctx.textAlign = 'left';
  ctx.fillText('السعر', 10, currentY);
  currentY += 30;

  // 4. Items
  ctx.font = '18px sans-serif';
  items.forEach((item: any) => {
    ctx.textAlign = 'right';
    ctx.fillText(item.name, width - 10, currentY);
    ctx.textAlign = 'center';
    ctx.fillText(item.qty.toString(), width / 2, currentY);
    ctx.textAlign = 'left';
    ctx.fillText((item.price * item.qty).toLocaleString(), 10, currentY);
    currentY += 30;
  });

  currentY += 10;
  currentY = drawText('--------------------------------', currentY, '18px sans-serif');

  // 5. Totals
  ctx.textAlign = 'right';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`الإجمالي: ${sale.total.toLocaleString()} ج.س`, width - 10, currentY);
  currentY += 35;

  if (sale.discount) {
    ctx.font = '18px sans-serif';
    ctx.fillText(`الخصم: ${sale.discount.toLocaleString()} ج.س`, width - 10, currentY);
    currentY += 25;
  }

  const paymentMethodAr = sale.paymentMethod === 'cash' ? 'نقدي' : 
    sale.paymentMethod === 'bankak' ? 'بنكك' : 
    sale.paymentMethod === 'fawry' ? 'فوري' : 'أووكاش';
  
  ctx.font = '18px sans-serif';
  ctx.fillText(`طريقة الدفع: ${paymentMethodAr}`, width - 10, currentY);
  currentY += 40;

  // 6. Footer
  currentY = drawText('شكراً لتسوقكم معنا!', currentY, 'italic 18px sans-serif');
  currentY += 40; // Extra padding for cutting

  // Final canvas resize to actual content height
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width;
  finalCanvas.height = currentY;
  const finalCtx = finalCanvas.getContext('2d')!;
  finalCtx.drawImage(canvas, 0, 0);

  return canvasToEscPos(finalCanvas);
};

// Convert Canvas to ESC/POS Bit Image (GS v 0)
const canvasToEscPos = (canvas: HTMLCanvasElement): ArrayBuffer => {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const pixels = imageData.data;

  const widthInBytes = Math.ceil(width / 8);
  const data = new Uint8Array(8 + widthInBytes * height);

  // GS v 0 m xL xH yL yH
  data[0] = 0x1D; // GS
  data[1] = 0x76; // v
  data[2] = 0x30; // 0
  data[3] = 0x00; // m = 0 (Normal mode)
  data[4] = widthInBytes % 256; // xL
  data[5] = Math.floor(widthInBytes / 256); // xH
  data[6] = height % 256; // yL
  data[7] = Math.floor(height / 256); // yH

  let offset = 8;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < widthInBytes; x++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const pxIndex = (y * width + (x * 8 + bit)) * 4;
        if (pxIndex < pixels.length) {
          // Threshold for black/white (average of RGB < 128)
          const r = pixels[pxIndex];
          const g = pixels[pxIndex + 1];
          const b = pixels[pxIndex + 2];
          const brightness = (r + g + b) / 3;
          if (brightness < 128) {
            byte |= (1 << (7 - bit));
          }
        }
      }
      data[offset++] = byte;
    }
  }

  // Formatting commands: Init, Center, BitImage, Feed, Cut
  const init = new Uint8Array([0x1B, 0x40]);
  const alignCenter = new Uint8Array([0x1B, 0x61, 0x01]);
  const feedAndCut = new Uint8Array([0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x00]);

  const combined = new Uint8Array(init.length + alignCenter.length + data.length + feedAndCut.length);
  combined.set(init, 0);
  combined.set(alignCenter, init.length);
  combined.set(data, init.length + alignCenter.length);
  combined.set(feedAndCut, init.length + alignCenter.length + data.length);

  return combined.buffer;
};

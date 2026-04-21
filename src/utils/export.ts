import * as XLSX from 'xlsx';

export const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const printToPDF = (data: any[], title: string = 'تقرير') => {
  // If the user wants to print the screen and no data is passed (or they passed an event), we fall back.
  if (!data || !Array.isArray(data) || data.length === 0) {
    window.print();
    return;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const headers = Object.keys(data[0]);

  const now = new Date();
  const dateString = now.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeString = now.toLocaleTimeString('ar-EG');

  doc.write(`
    <html dir="rtl" lang="ar">
      <head>
        <title>${title}</title>
        <style>
          @page { margin: 1cm; }
          body { 
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
            direction: rtl; 
            padding: 20px; 
            background: #fff;
            color: #000;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          h1 { margin: 0; color: #333; font-size: 24px; }
          .meta { color: #666; font-size: 14px; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
          th, td { border: 1px solid #ccc; padding: 10px; text-align: right; }
          th { background-color: #f8f9fa; color: #333; font-weight: bold; }
          tr:nth-child(even) { background-color: #fcfcfc; }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #ccc;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title.replace(/_/g, ' ')}</h1>
          <div class="meta">تاريخ الطباعة: ${dateString} - ${timeString}</div>
        </div>
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${headers.map(h => `<td>${row[h] !== null && row[h] !== undefined ? row[h] : ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          تم إنشاء هذا التقرير آلياً - نظام الإدارة
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print failed:', e);
      window.print();
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1000);
  }, 500);
};

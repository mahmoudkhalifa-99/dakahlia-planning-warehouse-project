
import { Sale, AppSettings, Purchase, Product, PrintConfig, WarehouseType } from '../types';
import { dbService } from './storage';

// Helper to get the most up-to-date cashier name
const getCashierName = (sale: Sale) => {
    try {
        const users = dbService.getUsers();
        const foundUser = users.find(u => u.id === sale.cashierId);
        return foundUser ? foundUser.name : sale.cashierName;
    } catch (e) {
        return sale.cashierName;
    }
};

export const printService = {
  printWindow: (content: string) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(content);
      printWindow.document.close();
      
      // Focus is required for some browsers to trigger print
      setTimeout(() => {
          printWindow.focus();
          printWindow.print();
      }, 800);
    }
  },

  /**
   * دالة عامة لطباعة أي محتوى HTML داخل قالب النظام المنسق
   */
  printHtmlContent: (title: string, htmlContent: string, context: string, settings: AppSettings, subtitle: string = '') => {
      const config = settings.printConfigs[context] || settings.printConfigs['default'];
      
      const fullHtml = `
          <!DOCTYPE html>
          <html dir="rtl">
          <head>
              <title>${title}</title>
              <style>
                  ${printService.getStyles(settings, config)}
                  table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: auto; }
                  th, td { border: 1px solid #000 !important; padding: 6px; text-align: center; }
                  th { background-color: ${config.headerColor || '#1e3a8a'} !important; color: #fff !important; -webkit-print-color-adjust: exact; }
                  .print-header-info { margin-bottom: 20px; }
                  @media print {
                      @page { size: landscape; margin: 10mm; }
                      .no-print { display: none; }
                  }
              </style>
          </head>
          <body>
              ${printService.getWatermarkHtml(config)}
              <div class="header">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                      ${config.logo ? `<img src="${config.logo}" style="height: 70px;" />` : '<div></div>'}
                      <div>
                          <h1>${config.companyName}</h1>
                          <h2 style="color: ${config.titleColor || '#000'}">${title}</h2>
                          ${subtitle ? `<p style="font-weight:bold;">${subtitle}</p>` : ''}
                      </div>
                      ${config.logoLeft ? `<img src="${config.logoLeft}" style="height: 70px;" />` : '<div></div>'}
                  </div>
              </div>
              <div style="margin-top: 10px;">
                  ${htmlContent}
              </div>
              <div class="footer">${config.footerText || ''}</div>
          </body>
          </html>
      `;
      printService.printWindow(fullHtml);
  },

  downloadPdf: (content: string, filename: string) => {
      const element = document.createElement('div');
      element.innerHTML = content;
      element.style.width = '100%';
      // Avoid page breaks inside table rows if possible
      const style = document.createElement('style');
      style.innerHTML = `
        tr { page-break-inside: avoid; } 
        table { page-break-inside: auto; }
        .watermark { position: absolute !important; z-index: -1; }
      `;
      element.appendChild(style);

      const opt = {
          margin: [0.3, 0.3], // inch
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, letterRendering: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' }
      };

      // @ts-ignore
      if (window.html2pdf) {
          // @ts-ignore
          window.html2pdf().set(opt).from(element).save();
      } else {
          alert("مكتبة PDF غير محملة. يرجى تحديث الصفحة.");
      }
  },

  getStyles: (settings: AppSettings, config: PrintConfig, customStyles: any = {}) => {
    const wm = config.watermark || { enabled: false, opacity: 0.1, rotation: -45, color: '#000000', fontSize: 60 };
    const fontFamily = customStyles.fontFamily || "'Cairo', sans-serif";
    const fontSize = customStyles.fontSize || config.fontSize || 12;

    return `
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
    
    body { 
        font-family: ${fontFamily}; 
        padding: 20px; 
        direction: ${settings.language === 'ar' ? 'rtl' : 'ltr'}; 
        font-size: ${fontSize}pt;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact; 
    }
    
    .header { 
        text-align: center; 
        margin-bottom: 15px; 
        border-bottom: 2px solid ${config.headerColor || '#000'}; 
        padding-bottom: 10px; 
    }
    .header h1 { margin: 0; font-size: 1.8em; color: ${config.titleColor || '#000'}; }
    .header h2, .header h3 { color: ${config.titleColor || '#000'}; margin: 5px 0; }
    .header p { margin: 2px 0; }
    
    .info-grid { 
        display: flex; 
        justify-content: space-between; 
        gap: 15px; 
        margin-bottom: 15px; 
        align-items: stretch;
    }
    .box { 
        border: 1px solid #ccc; 
        flex: 1; 
        border-radius: 6px; 
        overflow: hidden;
        font-size: 10pt;
    }
    .box-header {
        background-color: #f3f4f6;
        padding: 5px;
        text-align: center;
        border-bottom: 1px solid #ccc;
        font-weight: bold;
        font-size: 11pt;
        color: ${config.headerColor || '#000'};
    }
    .box-content {
        padding: 8px;
    }
    .meta-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 4px;
        border-bottom: 1px dashed #eee;
        padding-bottom: 2px;
    }
    .meta-row:last-child { border-bottom: none; }
    .meta-label { font-weight: bold; color: #555; font-size: 0.9em; }
    .meta-value { font-weight: bold; color: #000; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { 
        border: 1px solid #ccc; 
        padding: 8px; 
        text-align: ${customStyles.textAlign || 'center'}; 
        vertical-align: ${customStyles.verticalAlign || 'middle'};
        font-weight: ${customStyles.isBold ? 'bold' : 'normal'};
        font-style: ${customStyles.isItalic ? 'italic' : 'normal'};
        text-decoration: ${customStyles.isUnderline ? 'underline' : 'none'};
    }
    
    th { 
        background-color: ${config.headerColor || '#1e3a8a'} !important; 
        color: #ffffff !important; 
        font-weight: bold; 
    }
    
    .totals { margin-top: 20px; float: left; width: 300px; font-size: 11pt; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee; }
    .totals-row.grand { font-weight: bold; font-size: 1.2em; border-top: 2px solid #000; border-bottom: none; margin-top: 5px; }
    
    .footer { 
        margin-top: 30px; 
        text-align: center; 
        font-size: 0.8em; 
        color: #666; 
        border-top: 1px solid #ddd; 
        padding-top: 10px; 
        position: fixed;
        bottom: 0;
        width: 100%;
    }

    .watermark {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -1;
        pointer-events: none;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
    }
    
    .watermark-inner {
        transform: rotate(${wm.rotation || -45}deg);
        opacity: ${wm.opacity || 0.1};
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
    }

    .watermark-text {
        font-size: ${wm.fontSize || 80}pt;
        font-weight: bold;
        color: ${wm.color || '#000000'};
        border: 8px solid ${wm.color || '#000000'};
        padding: 20px 60px;
        border-radius: 20px;
        white-space: nowrap;
    }

    @media print {
        .no-print { display: none; }
        .footer { position: fixed; bottom: 0; }
        @page { size: portrait; margin: 10mm; }
    }
  `;
  },

  getWatermarkHtml: (config: PrintConfig) => {
      if (!config.watermark?.enabled) return '';
      const wm = config.watermark;
      return `
        <div class="watermark">
            <div class="watermark-inner">
                ${wm.type === 'image' && wm.image 
                    ? `<img src="${wm.image}" style="width:100%; height:100%; object-fit:contain;" />` 
                    : `<div class="watermark-text">${wm.text}</div>`
                }
            </div>
        </div>
      `;
  },

  generateReceiptHtml: (sale: Sale, settings: AppSettings) => {
      const config = settings.printConfigs['sales'] || settings.printConfigs['default'];
      const cashierName = getCashierName(sale);
      
      return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Receipt #${sale.id.slice(-6)}</title>
            <style>
                ${printService.getStyles(settings, config)}
                .receipt { width: 80mm; margin: 0 auto; padding: 10px; }
            </style>
        </head>
        <body>
            ${printService.getWatermarkHtml(config)}
            <div class="header">
                ${config.showLogo && config.logo ? `<img src="${config.logo}" style="max-height: 60px; margin-bottom: 10px;" />` : ''}
                <h1>${config.companyName}</h1>
                <p>${config.address}</p>
                <p>${config.phone}</p>
            </div>
            <div style="text-align: center; margin: 10px 0;">
                <h3>${config.reportTitle || (settings.language === 'ar' ? 'فاتورة بيع' : 'Sales Receipt')}</h3>
                <p>#${sale.id.slice(-6)} | ${new Date(sale.date).toLocaleString('en-US')}</p>
                <p style="font-size: 0.9em; color: #555;">${settings.language === 'ar' ? 'الكاشير' : 'Cashier'}: ${cashierName}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>${settings.language === 'ar' ? 'الصنف' : 'Item'}</th>
                        <th>${settings.language === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th>${settings.language === 'ar' ? 'السعر' : 'Price'}</th>
                        <th>${settings.language === 'ar' ? 'الاجمالي' : 'Total'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${sale.items.map(item => `
                        <tr>
                            <td style="text-align: right;">${item.name}</td>
                            <td>${item.quantity.toLocaleString('en-US')}</td>
                            <td>${item.price.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                            <td>${(item.price * item.quantity).toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="totals" style="float: none; width: 100%; margin-top: 10px;">
                <div class="totals-row">
                    <span>${settings.language === 'ar' ? 'المجموع' : 'Subtotal'}</span>
                    <span>${sale.subtotal.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
                <div class="totals-row">
                    <span>${settings.language === 'ar' ? 'الضريبة' : 'Tax'}</span>
                    <span>${sale.tax.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
                <div class="totals-row grand">
                    <span>${settings.language === 'ar' ? 'الاجمالي' : 'Total'}</span>
                    <span>${sale.total.toLocaleString('en-US', {minimumFractionDigits:2})}</span>
                </div>
            </div>
            <div class="footer">
                <p>${config.footerText || (settings.language === 'ar' ? 'شكرا لزيارتكم' : 'Thank you for your visit')}</p>
            </div>
        </body>
        </html>
      `;
  },

  printReceipt: (sale: Sale, settings: AppSettings) => {
      const html = printService.generateReceiptHtml(sale, settings);
      printService.printWindow(html);
  },

  generateInvoiceHtml: (sale: Sale, settings: AppSettings, customStyles: any = {}) => {
    const config = settings.printConfigs['sales'] || settings.printConfigs['default'];
    const cashierName = getCashierName(sale);

    return `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>Invoice #${sale.id.slice(-6)}</title>
        <style>
            ${printService.getStyles(settings, config, customStyles)}
        </style>
      </head>
      <body>
        ${printService.getWatermarkHtml(config)}
        <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                ${config.logo ? `<img src="${config.logo}" style="height: 80px;" />` : '<div></div>'}
                <div>
                    <h1>${config.companyName}</h1>
                </div>
                ${config.logoLeft ? `<img src="${config.logoLeft}" style="height: 80px;" />` : '<div></div>'}
            </div>
            <h2 style="text-align: ${config.reportTitleAlignment || 'center'};">${config.reportTitle || (settings.language === 'ar' ? 'فاتورة ضريبية' : 'Tax Invoice')}</h2>
        </div>

        <div class="info-grid">
           <div class="box">
              <div class="box-header">${settings.language === 'ar' ? 'بيانات الفاتورة' : 'Invoice Details'}</div>
              <div class="box-content">
                  <div class="meta-row">
                      <span class="meta-label"># ${settings.language === 'ar' ? 'الرقم' : 'No'}:</span>
                      <span class="meta-value">${sale.id.slice(-6)}</span>
                  </div>
                  <div class="meta-row">
                      <span class="meta-label">${settings.language === 'ar' ? 'التاريخ' : 'Date'}:</span>
                      <span class="meta-value">${new Date(sale.date).toLocaleDateString('en-GB')}</span>
                  </div>
                  ${sale.customer ? `
                  <div class="meta-row">
                      <span class="meta-label">${settings.language === 'ar' ? 'العميل' : 'Client'}:</span>
                      <span class="meta-value">${sale.customer}</span>
                  </div>` : ''}
                  ${sale.customerAddress ? `
                  <div class="meta-row">
                      <span class="meta-label">${settings.language === 'ar' ? 'العنوان' : 'Address'}:</span>
                      <span class="meta-value">${sale.customerAddress}</span>
                  </div>` : ''}
              </div>
           </div>
           
           <div class="box">
              <div class="box-header">${settings.language === 'ar' ? 'المسؤولين واللوجستيات' : 'Officers & Logistics'}</div>
              <div class="box-content">
                  <div class="meta-row">
                      <span class="meta-label">${settings.language === 'ar' ? 'محرر الفاتورة' : 'Editor'}:</span>
                      <span class="meta-value">${cashierName}</span>
                  </div>
                  ${sale.carNumber ? `
                  <div class="meta-row">
                      <span class="meta-label">${settings.language === 'ar' ? 'رقم السيارة' : 'Car No'}:</span>
                      <span class="meta-value">${sale.carNumber}</span>
                  </div>` : ''}
                  ${sale.transportMethod ? `
                  <div class="meta-row">
                      <span class="meta-label">${settings.language === 'ar' ? 'طريقة النقل' : 'Transport'}:</span>
                      <span class="meta-value">${sale.transportMethod}</span>
                  </div>` : ''}
              </div>
           </div>
        </div>

        <table>
           <thead>
             <tr>
               <th style="width: 40px;">م</th>
               <th>${settings.language === 'ar' ? 'الصنف' : 'Item'}</th>
               <th>نوع العلف</th>
               <th>${settings.language === 'ar' ? 'الوحدة' : 'Unit'}</th>
               <th>${settings.language === 'ar' ? 'الكمية' : 'Qty'}</th>
               <th>ت. الانتاج</th>
             </tr>
           </thead>
           <tbody>
             ${sale.items.map((item, i) => `
               <tr>
                 <td>${i + 1}</td>
                 <td style="text-align: right; padding-right: 15px; font-weight: bold;">${item.name}</td>
                 <td>${item.feedType || '-'}</td>
                 <td>${(item.unit || '')}</td>
                 <td style="font-family: 'Inter', sans-serif; font-weight: 800; font-size: 1.2em;">${item.quantity.toLocaleString('en-US', {minimumFractionDigits: customStyles.decimals})}</td>
                 <td style="font-family: 'Inter', sans-serif;">${item.productionDate || '-'}</td>
               </tr>
             `).join('')}
           </tbody>
        </table>

        <div class="totals" style="float: right; margin-top: 30px;">
           <div class="totals-row grand">
             <span>${settings.language === 'ar' ? 'إجمالي المحمل الفعلي' : 'Grand Total'}:</span>
             <span style="font-family: 'Inter', sans-serif; font-size: 1.5em; padding-right: 15px;">${sale.total.toLocaleString('en-US', {minimumFractionDigits: customStyles.decimals})} طن</span>
           </div>
        </div>

        <div style="clear: both; margin-top: 60px;">
            <div class="info-grid" style="border: none;">
                <div style="text-align: center; flex: 1;">
                    <p style="font-weight: bold;">توقيع العميل / السائق</p>
                    <div style="margin-top: 40px; border-bottom: 1.5px solid #000; width: 70%; margin-left: auto; margin-right: auto;"></div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <p style="font-weight: bold;">أمين المخزن المختص</p>
                    <div style="margin-top: 40px; border-bottom: 1.5px solid #000; width: 70%; margin-left: auto; margin-right: auto;"></div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <p style="font-weight: bold;">تأكيد الخروج / الأمن</p>
                    <div style="margin-top: 40px; border-bottom: 1.5px solid #000; width: 70%; margin-left: auto; margin-right: auto;"></div>
                </div>
            </div>
        </div>

        <div class="footer">
           <p>${config.footerText || ''}</p>
        </div>
      </body>
      </html>
    `;
  },

  printInvoice: (sale: Sale, settings: AppSettings, customStyles: any = {}) => {
      const html = printService.generateInvoiceHtml(sale, settings, customStyles);
      printService.printWindow(html);
  },

  generatePurchaseOrderHtml: (purchase: Purchase, settings: AppSettings) => {
      const config = settings.printConfigs['purchases'] || settings.printConfigs['default'];
      const warehouseMap: Record<string, string> = {
          raw: 'مخزن الخامات',
          finished: 'مخزن المنتج التام',
          parts: 'قطع الغيار',
          catering: 'مخزن الإعاشة'
      };
      const warehouseName = warehouseMap[purchase.warehouse] || purchase.warehouse;

      return `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <title>PO #${purchase.orderNumber}</title>
            <style>
                ${printService.getStyles(settings, config)}
            </style>
        </head>
        <body>
            ${printService.getWatermarkHtml(config)}
            <div class="header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    ${config.logo ? `<img src="${config.logo}" style="height: 80px;" />` : '<div></div>'}
                    <div>
                        <h1>${config.companyName}</h1>
                    </div>
                    ${config.logoLeft ? `<img src="${config.logoLeft}" style="height: 80px;" />` : '<div></div>'}
                </div>
                <h2>${config.reportTitle || (settings.language === 'ar' ? 'طلب شراء بضاعة' : 'Purchase Order')}</h2>
            </div>

            <div class="info-grid">
                <div class="box">
                    <div class="box-header">بيانات طلب الشراء</div>
                    <div class="box-content">
                        <div class="meta-row">
                            <span class="meta-label">رقم طلب الشراء:</span>
                            <span class="meta-value">${purchase.orderNumber}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">تاريخ الطلب:</span>
                            <span class="meta-value">${new Date(purchase.date).toLocaleDateString('en-GB')}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">الإدارة الطالبة:</span>
                            <span class="meta-value">${purchase.department || '-'}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">نوع الطلب:</span>
                            <span class="meta-value">${purchase.requestType || '-'}</span>
                        </div>
                    </div>
                </div>
                
                <div class="box">
                    <div class="box-header">بيانات التنفيذ والمخازن</div>
                    <div class="box-content">
                        <div class="meta-row">
                            <span class="meta-label">جهة التنفيذ:</span>
                            <span class="meta-value" style="color: #1e3a8a;">${purchase.supplier}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">الطلب لأجل:</span>
                            <span class="meta-value">${purchase.requestFor || '-'}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">المخزن التابع له:</span>
                            <span class="meta-value">${warehouseName}</span>
                        </div>
                        <div class="meta-row">
                            <span class="meta-label">الشخص الطالب:</span>
                            <span class="meta-value">${purchase.requester || '-'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">م</th>
                        <th>كود JDE</th>
                        <th>بيان الصنف</th>
                        <th>الوحدة</th>
                        <th>الكمية المطلوبة</th>
                        <th>سعر الوحدة</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${purchase.items.map((item, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td style="font-family: monospace;">${item.jdeCode || '-'}</td>
                            <td style="text-align: right; padding-right: 10px;">${item.productName}</td>
                            <td>${item.unit}</td>
                            <td style="font-weight: bold;">${item.quantity.toLocaleString('en-US')}</td>
                            <td>${item.unitCost.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                            <td style="font-weight: bold;">${item.totalCost.toLocaleString('en-US', {minimumFractionDigits:2})}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="totals">
                <div class="totals-row grand">
                    <span>إجمالي قيمة الطلب:</span>
                    <span>${purchase.total.toLocaleString('en-US', {minimumFractionDigits:2})} ${settings.currency}</span>
                </div>
            </div>

            <div style="clear: both; margin-top: 30px;">
                <div class="box" style="border-style: dashed; background-color: #fcfcfc;">
                    <div class="box-header" style="background-color: #eee;">ملاحظات إضافية</div>
                    <div class="box-content" style="min-height: 50px;">
                        ${purchase.notes || 'لا توجد ملاحظات.'}
                    </div>
                </div>
            </div>

            <div class="info-grid" style="margin-top: 40px; border: none;">
                <div style="text-align: center; flex: 1;">
                    <p>توقيع الطالب</p>
                    <div style="margin-top: 40px; border-bottom: 1px solid #000; width: 150px; margin-left: auto; margin-right: auto;"></div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <p>امين المخزن</p>
                    <div style="margin-top: 40px; border-bottom: 1px solid #000; width: 150px; margin-left: auto; margin-right: auto;"></div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <p>ادارة المخازن</p>
                    <div style="margin-top: 40px; border-bottom: 1px solid #000; width: 150px; margin-left: auto; margin-right: auto;"></div>
                </div>
                <div style="text-align: center; flex: 1;">
                    <p>يعتمد</p>
                    <div style="margin-top: 40px; border-bottom: 1px solid #000; width: 150px; margin-left: auto; margin-right: auto;"></div>
                </div>
            </div>

            <div class="footer">
                <p>${config.footerText || ''}</p>
            </div>
        </body>
        </html>
      `;
  },

  generateGenericReportHtml: (title: string, headers: string[], data: (string|number)[][], settings: AppSettings, context?: string) => {
      // Determine context by provided parameter, then title detection, or default to 'default'
      let configContext = context || 'default';
      
      if (!context) {
        if (title.includes('Finished') || title.includes('المنتج التام')) configContext = 'finished';
        else if (title.includes('Raw') || title.includes('الخامات')) configContext = 'raw';
        else if (title.includes('Purchases') || title.includes('المشتريات')) configContext = 'purchases';
        else if (title.includes('Sales') || title.includes('المبيعات')) configContext = 'sales';
      }
      
      const config = settings.printConfigs['temp_custom'] || settings.printConfigs[configContext] || settings.printConfigs['default'];

      return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>${printService.getStyles(settings, config)}</style>
        </head>
        <body>
            ${printService.getWatermarkHtml(config)}
            <div class="header">
               <div style="display: flex; justify-content: space-between; align-items: center;">
                    ${config.logo ? `<img src="${config.logo}" style="height: 60px;" />` : '<div></div>'}
                    <div>
                        <h1>${config.companyName}</h1>
                        <h3>${title}</h3>
                        <p>${new Date().toLocaleString('en-US')}</p>
                    </div>
                    ${config.logoLeft ? `<img src="${config.logoLeft}" style="height: 60px;" />` : '<div></div>'}
               </div>
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
                            ${row.map(cell => {
                                // Formatting for numeric cells in generic reports
                                if (typeof cell === 'number') {
                                    return `<td>${cell.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>`;
                                }
                                return `<td>${cell}</td>`;
                            }).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                <p>${config.footerText || ''}</p>
            </div>
        </body>
        </html>
      `;
  },

  printGenericReport: (title: string, headers: string[], data: (string|number)[][], settings: AppSettings, context?: string) => {
      const html = printService.generateGenericReportHtml(title, headers, data, settings, context);
      printService.printWindow(html);
  },

  downloadGenericPdf: (title: string, headers: string[], data: (string|number)[][], settings: AppSettings, context?: string) => {
      const html = printService.generateGenericReportHtml(title, headers, data, settings, context);
      printService.downloadPdf(html, `${title.replace(/\s+/g, '_')}.pdf`);
  },

  generateProductListHtml: (products: Product[], warehouse: WarehouseType | 'all', settings: AppSettings) => {
      const title = warehouse === 'all' ? 'All Products Inventory' : `${warehouse} Inventory`;
      const headers = ['Code', 'Name', 'Warehouse', 'Stock', 'Unit', 'Price'];
      const data = products.map(p => [
          p.barcode,
          p.name,
          p.warehouse,
          p.stock,
          p.unit || '',
          p.price
      ]);
      return printService.generateGenericReportHtml(title, headers, data, settings);
  },

  printProductList: (products: Product[], warehouse: WarehouseType | 'all', settings: AppSettings) => {
      const html = printService.generateProductListHtml(products, warehouse, settings);
      printService.printWindow(html);
  }
};

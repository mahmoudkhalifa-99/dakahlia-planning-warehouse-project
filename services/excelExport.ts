
import ExcelJS from 'exceljs';
import saveAs from 'file-saver';

interface ExportColumn {
    header: string;
    key: string;
    width?: number;
}

export const excelService = {
    /**
     * Exports data to a styled Excel file matching the system's look and feel.
     */
    exportStyledTable: async (
        title: string,
        headers: string[],
        data: any[][],
        fileName: string,
        summaryRowIndex: number = -1 // If >= 0, this row index in 'data' will be styled as a total row
    ) => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Report', {
            views: [{ rightToLeft: true, showGridLines: false }]
        });

        // 1. Add Title
        // Merge cells across the width of the table
        const endColChar = String.fromCharCode(65 + Math.min(headers.length, 25) - 1); // Simple A-Z mapping for now
        sheet.mergeCells(`A1:${endColChar}2`);
        const titleCell = sheet.getCell('A1');
        titleCell.value = title;
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        titleCell.font = { name: 'Cairo', size: 16, bold: true, color: { argb: 'FF1E3A8A' } }; // Dark Blue Text
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; // Gray BG

        // 2. Add Headers (Row 4)
        const headerRow = sheet.getRow(4);
        headerRow.values = headers;
        headerRow.height = 30;
        
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; // Dark Blue BG
            cell.font = { name: 'Cairo', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }; // White Text
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // 3. Add Data
        data.forEach((rowData, idx) => {
            const row = sheet.addRow(rowData);
            row.height = 25; // Comfortable height

            const isTotalRow = summaryRowIndex === idx || (rowData[0] && String(rowData[0]).includes('الإجمالي'));

            row.eachCell((cell, colNumber) => {
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                if (isTotalRow) {
                    // Total Row Style (Beige/Orange Tint)
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } }; 
                    cell.font = { name: 'Cairo', size: 12, bold: true, color: { argb: 'FF9A3412' } }; // Dark Orange Text
                } else {
                    // Normal Row
                    cell.font = { name: 'Cairo', size: 11 };
                    // Alternate row coloring
                    if (idx % 2 !== 0) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
                    }
                }
                
                // Numbers
                if (typeof cell.value === 'number') {
                    cell.numFmt = '#,##0.00';
                }
            });
        });

        // 4. Auto-width (Approximation)
        sheet.columns.forEach((column) => {
            let maxLength = 0;
            column.eachCell && column.eachCell({ includeEmpty: true }, (cell) => {
                const columnLength = cell.value ? cell.value.toString().length : 10;
                if (columnLength > maxLength) {
                    maxLength = columnLength;
                }
            });
            column.width = Math.min(Math.max(maxLength + 2, 15), 50); // Min 15, Max 50
        });

        // 5. Generate and Save
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `${fileName}.xlsx`);
    }
};

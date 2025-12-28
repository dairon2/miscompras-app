"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExcelWorkbook = void 0;
const exceljs_1 = __importDefault(require("exceljs"));
const generateExcelWorkbook = async ({ title, subtitle, columns, rows }) => {
    const workbook = new exceljs_1.default.Workbook();
    const worksheet = workbook.addWorksheet(title);
    // --- Header Section ---
    worksheet.mergeCells('A1:C3');
    const headerCell = worksheet.getCell('A1');
    headerCell.value = {
        richText: [
            { text: 'Museo de Antioquia\n', font: { size: 16, bold: true, name: 'Palatino' } },
            { text: subtitle, font: { size: 14, name: 'Palatino' } }
        ]
    };
    headerCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    worksheet.mergeCells('D1:H3');
    const reportTitleCell = worksheet.getCell('D1');
    reportTitleCell.value = title;
    reportTitleCell.font = { size: 20, bold: true };
    reportTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    reportTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE5E5E5' }
    };
    worksheet.addRow([]);
    worksheet.addRow([]);
    // --- Table Headers ---
    const headerRow = worksheet.addRow(columns.map(c => c.header));
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF000000' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
    // --- Data Rows ---
    rows.forEach(data => {
        const rowData = columns.map(col => data[col.key]);
        const row = worksheet.addRow(rowData);
        row.height = 25;
        row.eachCell((cell, colNumber) => {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            const header = columns[colNumber - 1].header.toLowerCase();
            if (header.includes('valor') || header.includes('monto') || header.includes('asignado') || header.includes('disponible')) {
                cell.numFmt = '"$"#,##0.00';
            }
        });
    });
    columns.forEach((col, i) => {
        worksheet.getColumn(i + 1).width = col.width;
    });
    worksheet.views = [{ state: 'frozen', ySplit: 6 }];
    return workbook;
};
exports.generateExcelWorkbook = generateExcelWorkbook;

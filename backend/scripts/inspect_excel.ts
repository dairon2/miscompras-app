
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const filePath = 'C:\\Users\\Usuario\\Downloads\\Libro4.xlsx';

async function inspect() {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1); // First sheet

    if (!worksheet) {
        console.error("No worksheet found");
        return;
    }

    const firstRow = worksheet.getRow(1);
    console.log("Headers:");
    const headers: string[] = [];
    firstRow.eachCell((cell, colNumber) => {
        headers.push(`${colNumber}: ${cell.value}`);
    });
    console.log(headers.join('\n'));
}

inspect();

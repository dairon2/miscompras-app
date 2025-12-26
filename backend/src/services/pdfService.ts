import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export const generatePDF = async (templateName: string, data: any): Promise<Buffer> => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
    let html = fs.readFileSync(templatePath, 'utf8');

    // Basic string replacement for template variables
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, data[key]);
    });

    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });

    await browser.close();
    return Buffer.from(pdfBuffer);
};

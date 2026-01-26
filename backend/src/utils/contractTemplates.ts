/**
 * Contract Templates for MisCompras
 * Generates HTML contracts that can be sent via email
 */

export interface ContractData {
    // Contract Info
    contractNumber: string;
    contractDate: string;

    // Supplier Info
    supplierName: string;
    supplierNit: string;
    supplierEmail: string;
    supplierPhone?: string;
    supplierAddress?: string;

    // Requirement Info
    requirementGroupId: number;
    requirementTitle: string;
    requirementDescription?: string;
    amount: number;
    amountInWords?: string;

    // Project Info
    projectName: string;
    projectCode?: string;

    // Requester Info
    requesterName: string;

    // Payment Terms
    paymentTerms?: string;
    deliveryDate?: string;
}

// Convert number to words in Spanish
const numberToWords = (num: number): string => {
    const units = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    if (num === 0) return 'cero';
    if (num === 100) return 'cien';

    let result = '';
    const millions = Math.floor(num / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const remainder = num % 1000;

    if (millions > 0) {
        result += millions === 1 ? 'un millón ' : `${numberToWords(millions)} millones `;
    }
    if (thousands > 0) {
        result += thousands === 1 ? 'mil ' : `${numberToWords(thousands)} mil `;
    }
    if (remainder > 0) {
        const h = Math.floor(remainder / 100);
        const t = Math.floor((remainder % 100) / 10);
        const u = remainder % 10;

        if (h > 0) result += hundreds[h] + ' ';
        if (t === 1) {
            result += teens[u] + ' ';
        } else if (t > 0) {
            result += tens[t];
            if (u > 0) result += ' y ' + units[u];
            result += ' ';
        } else if (u > 0) {
            result += units[u] + ' ';
        }
    }

    return result.trim() + ' pesos';
};

const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

export const getServiceContractTemplate = (data: ContractData): string => {
    const amountWords = data.amountInWords || numberToWords(Math.round(data.amount));

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Contrato de Prestación de Servicios - ${data.contractNumber}</title>
    <style>
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.8;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: #fff;
        }
        .header {
            text-align: center;
            border-bottom: 3px double #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            font-size: 24px;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .header .subtitle {
            font-size: 14px;
            color: #666;
            margin-top: 10px;
        }
        .contract-number {
            background: #f5f5f5;
            padding: 10px 20px;
            border-radius: 5px;
            display: inline-block;
            margin: 10px 0;
            font-weight: bold;
        }
        .section {
            margin: 25px 0;
        }
        .section-title {
            font-weight: bold;
            text-transform: uppercase;
            font-size: 14px;
            color: #667eea;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }
        .clause {
            margin: 15px 0;
            text-align: justify;
        }
        .clause strong {
            color: #333;
        }
        .highlight {
            background: #fffbcc;
            padding: 2px 5px;
        }
        .amount {
            font-size: 18px;
            font-weight: bold;
            color: #667eea;
        }
        .signatures {
            margin-top: 60px;
            display: flex;
            justify-content: space-between;
        }
        .signature-block {
            width: 45%;
            text-align: center;
        }
        .signature-line {
            border-top: 1px solid #333;
            margin-top: 60px;
            padding-top: 10px;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
        @media print {
            body { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Contrato de Prestación de Servicios</h1>
        <div class="subtitle">Museo de Antioquia - Sistema MisCompras</div>
        <div class="contract-number">Contrato No. ${data.contractNumber}</div>
        <div style="margin-top: 10px;">Fecha: ${data.contractDate}</div>
    </div>

    <div class="section">
        <div class="section-title">Partes del Contrato</div>
        <p class="clause">
            Entre el <strong>MUSEO DE ANTIOQUIA</strong>, en adelante "EL CONTRATANTE", 
            representado legalmente, y <strong class="highlight">${data.supplierName}</strong>, 
            identificado(a) con NIT/CC <strong>${data.supplierNit}</strong>, 
            en adelante "EL CONTRATISTA", se celebra el presente contrato.
        </p>
    </div>

    <div class="section">
        <div class="section-title">Datos del Contratista</div>
        <p class="clause">
            <strong>Nombre/Razón Social:</strong> ${data.supplierName}<br>
            <strong>NIT/CC:</strong> ${data.supplierNit}<br>
            <strong>Email:</strong> ${data.supplierEmail}<br>
            ${data.supplierPhone ? `<strong>Teléfono:</strong> ${data.supplierPhone}<br>` : ''}
            ${data.supplierAddress ? `<strong>Dirección:</strong> ${data.supplierAddress}<br>` : ''}
        </p>
    </div>

    <div class="section">
        <div class="section-title">Objeto del Contrato</div>
        <p class="clause">
            <strong>Requerimiento #${data.requirementGroupId}:</strong><br>
            ${data.requirementTitle}
            ${data.requirementDescription ? `<br><br><em>${data.requirementDescription}</em>` : ''}
        </p>
        <p class="clause">
            <strong>Proyecto:</strong> ${data.projectName} ${data.projectCode ? `(${data.projectCode})` : ''}
        </p>
    </div>

    <div class="section">
        <div class="section-title">Valor del Contrato</div>
        <p class="clause">
            El valor total del presente contrato es de:<br>
            <span class="amount">${formatCurrency(data.amount)}</span><br>
            <em>(${amountWords})</em>
        </p>
    </div>

    <div class="section">
        <div class="section-title">Condiciones de Pago</div>
        <p class="clause">
            ${data.paymentTerms || 'El pago se realizará una vez recibido a satisfacción el servicio o producto, previa presentación de factura y certificación del supervisor del contrato.'}
        </p>
    </div>

    <div class="section">
        <div class="section-title">Plazo de Ejecución</div>
        <p class="clause">
            ${data.deliveryDate || 'El plazo de ejecución será acordado entre las partes según las necesidades del proyecto.'}
        </p>
    </div>

    <div class="section">
        <div class="section-title">Obligaciones del Contratista</div>
        <p class="clause">
            1. Cumplir con el objeto del contrato según las especificaciones acordadas.<br>
            2. Entregar los productos o prestar los servicios en los tiempos establecidos.<br>
            3. Presentar la documentación requerida para el pago.<br>
            4. Asumir la responsabilidad tributaria y de seguridad social que aplique.
        </p>
    </div>

    <div class="signatures">
        <div class="signature-block">
            <div class="signature-line">
                <strong>EL CONTRATANTE</strong><br>
                Museo de Antioquia<br>
                Solicitante: ${data.requesterName}
            </div>
        </div>
        <div class="signature-block">
            <div class="signature-line">
                <strong>EL CONTRATISTA</strong><br>
                ${data.supplierName}<br>
                NIT/CC: ${data.supplierNit}
            </div>
        </div>
    </div>

    <div class="footer">
        Este documento fue generado automáticamente por el sistema MisCompras.<br>
        Para validez legal, debe ser firmado por ambas partes.
    </div>
</body>
</html>
`;
};

export const getPurchaseOrderTemplate = (data: ContractData): string => {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Orden de Compra - ${data.contractNumber}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background: #fff;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .order-info {
            display: flex;
            justify-content: space-between;
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .info-block {
            flex: 1;
        }
        .info-block h3 {
            color: #667eea;
            margin: 0 0 10px 0;
            font-size: 14px;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        .total {
            text-align: right;
            font-size: 20px;
            font-weight: bold;
            color: #667eea;
            margin-top: 20px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #999;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛒 Orden de Compra</h1>
        <div>No. ${data.contractNumber} | Fecha: ${data.contractDate}</div>
    </div>

    <div class="order-info">
        <div class="info-block">
            <h3>Proveedor</h3>
            <strong>${data.supplierName}</strong><br>
            NIT: ${data.supplierNit}<br>
            ${data.supplierEmail}<br>
            ${data.supplierPhone || ''}
        </div>
        <div class="info-block">
            <h3>Proyecto</h3>
            ${data.projectName}<br>
            ${data.projectCode || ''}<br>
            Solicitante: ${data.requesterName}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Descripción</th>
                <th style="text-align: right;">Monto</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>
                    <strong>#${data.requirementGroupId} - ${data.requirementTitle}</strong>
                    ${data.requirementDescription ? `<br><small>${data.requirementDescription}</small>` : ''}
                </td>
                <td style="text-align: right;">${formatCurrency(data.amount)}</td>
            </tr>
        </tbody>
    </table>

    <div class="total">
        TOTAL: ${formatCurrency(data.amount)}
    </div>

    <div class="footer">
        Documento generado por MisCompras - Museo de Antioquia<br>
        Para consultas: contacto@museoantioquia.co
    </div>
</body>
</html>
`;
};

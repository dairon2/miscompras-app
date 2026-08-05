import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const getInvoices = async (token: string, filters?: any) => {
    const response = await axios.get(`${API_URL}/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters
    });
    return response.data;
};

const exportInvoicesExcel = async (token: string, filters?: any) => {
    const response = await axios.get(`${API_URL}/invoices/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
        responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Reporte_Facturas_${new Date().toISOString().split('T')[0]}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

const getInvoiceById = async (token: string, id: string) => {
    const response = await axios.get(`${API_URL}/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const checkDuplicateInvoice = async (token: string, supplierId: string, invoiceNumber: string) => {
    const response = await axios.get(`${API_URL}/invoices/check-duplicate`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { supplierId, invoiceNumber }
    });
    return response.data;
};

const createInvoice = async (token: string, formData: FormData) => {
    const response = await axios.post(`${API_URL}/invoices`, formData, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
        }
    });
    return response.data;
};

const updateInvoice = async (token: string, id: string, data: any) => {
    const response = await axios.patch(`${API_URL}/invoices/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const verifyInvoice = async (token: string, id: string, requirementId: string) => {
    const response = await axios.patch(`${API_URL}/invoices/${id}/verify`,
        { requirementId },
        { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
};

const approveInvoice = async (token: string, id: string) => {
    const response = await axios.patch(`${API_URL}/invoices/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const payInvoice = async (token: string, id: string, paymentData: { paymentDate: string, transactionNumber?: string }) => {
    const response = await axios.patch(`${API_URL}/invoices/${id}/pay`, paymentData, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const deleteInvoice = async (token: string, id: string) => {
    const response = await axios.delete(`${API_URL}/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const getReconciliationSuggestions = async (token: string, filters?: { page?: number; pageSize?: number; mode?: 'suggested' | 'ambiguous' }) => {
    const response = await axios.get(`${API_URL}/invoices/reconciliation`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters
    });
    return response.data;
};

const reconcileInvoice = async (token: string, invoiceId: string, requirementId: string) => {
    const response = await axios.patch(`${API_URL}/invoices/reconciliation/${invoiceId}`, { requirementId }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

const searchCompatibleRequirements = async (token: string, invoiceId: string, search: string) => {
    const response = await axios.get(`${API_URL}/invoices/${invoiceId}/requirement-options`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { search }
    });
    return response.data;
};

const searchInvoiceRequirementOptions = async (
    token: string,
    filters?: { supplierId?: string; search?: string; currentInvoiceId?: string }
) => {
    const response = await axios.get(`${API_URL}/invoices/requirement-options`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters
    });
    return response.data;
};

const searchInvoiceAdvanceOptions = async (
    token: string,
    filters?: { supplierId?: string; search?: string }
) => {
    const response = await axios.get(`${API_URL}/invoices/advance-options`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters
    });
    return response.data;
};

const reconcileInvoicesBatch = async (token: string, items: Array<{ invoiceId: string; requirementId: string }>) => {
    const response = await axios.patch(`${API_URL}/invoices/reconciliation/batch`, { items }, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
};

export const invoiceService = {
    getInvoices,
    exportInvoicesExcel,
    getInvoiceById,
    checkDuplicateInvoice,
    createInvoice,
    updateInvoice,
    verifyInvoice,
    approveInvoice,
    payInvoice,
    deleteInvoice,
    getReconciliationSuggestions,
    reconcileInvoice,
    searchCompatibleRequirements,
    searchInvoiceRequirementOptions,
    searchInvoiceAdvanceOptions,
    reconcileInvoicesBatch
};

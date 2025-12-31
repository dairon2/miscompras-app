import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const getInvoices = async (token: string, filters?: any) => {
    const response = await axios.get(`${API_URL}/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters
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

export const invoiceService = {
    getInvoices,
    createInvoice,
    verifyInvoice,
    approveInvoice,
    payInvoice
};

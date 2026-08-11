export type SupplierManagement =
    | 'UNCLASSIFIED'
    | 'COMMERCIAL'
    | 'ADMINISTRATIVE_PURCHASING'
    | 'PAYROLL'
    | 'SHARED';

export const supplierManagementOptions: Array<{ value: SupplierManagement; label: string }> = [
    { value: 'UNCLASSIFIED', label: 'Sin clasificar' },
    { value: 'COMMERCIAL', label: 'Gestión Comercial' },
    { value: 'ADMINISTRATIVE_PURCHASING', label: 'Compras Administrativas' },
    { value: 'PAYROLL', label: 'Nómina' },
    { value: 'SHARED', label: 'Gestión compartida' },
];

export const getSupplierManagementLabel = (management?: string) =>
    supplierManagementOptions.find(option => option.value === management)?.label || 'Sin clasificar';

export const getSupplierManagementBadgeClass = (management?: string) => {
    switch (management) {
        case 'COMMERCIAL':
            return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800';
        case 'ADMINISTRATIVE_PURCHASING':
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
        case 'PAYROLL':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
        case 'SHARED':
            return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800';
        default:
            return 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-slate-900 dark:text-gray-400 dark:border-gray-700';
    }
};

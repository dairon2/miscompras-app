const SUPPLIER_MANAGEMENT_VALUES = [
    'UNCLASSIFIED',
    'COMMERCIAL',
    'ADMINISTRATIVE_PURCHASING',
    'PAYROLL',
    'SHARED'
] as const;

const SUPPLIER_TYPES = ['SUPPLIER', 'SERVICE_PROVIDER'] as const;

export interface SupplierExportQuery {
    search?: unknown;
    supplierType?: unknown;
    management?: unknown;
}

export const buildSupplierExportWhere = (
    userRole: string,
    userId: string | undefined,
    query: SupplierExportQuery
): Record<string, any> => {
    const where: Record<string, any> = {};

    if (userRole === 'USER') {
        where.requirements = {
            some: {
                OR: [
                    { createdById: userId },
                    {
                        budget: {
                            OR: [
                                { managerId: userId },
                                { subLeaders: { some: { userId } } }
                            ]
                        }
                    }
                ]
            }
        };
    }

    if (SUPPLIER_TYPES.includes(query.supplierType as typeof SUPPLIER_TYPES[number])) {
        where.supplierType = query.supplierType;
    }

    if (SUPPLIER_MANAGEMENT_VALUES.includes(query.management as typeof SUPPLIER_MANAGEMENT_VALUES[number])) {
        where.management = query.management;
    }

    const search = typeof query.search === 'string' ? query.search.trim() : '';
    if (search) {
        where.AND = [
            {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { taxId: { contains: search, mode: 'insensitive' } },
                    { nit: { contains: search, mode: 'insensitive' } },
                    { contactName: { contains: search, mode: 'insensitive' } },
                    { contactEmail: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { contactPhone: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { activity: { contains: search, mode: 'insensitive' } }
                ]
            }
        ];
    }

    return where;
};

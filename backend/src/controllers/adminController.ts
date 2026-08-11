import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import bcrypt from 'bcryptjs';

// ==================== AREAS ====================

export const getAreas = async (req: AuthRequest, res: Response) => {
    try {
        const areas = await prisma.area.findMany({
            orderBy: { name: 'asc' },
            include: {
                director: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                _count: {
                    select: { users: true }
                }
            }
        });
        res.json(areas);
    } catch (error: any) {
        console.error('Error fetching areas:', error);
        res.status(500).json({ error: 'Error al obtener áreas' });
    }
};

export const createArea = async (req: AuthRequest, res: Response) => {
    const { name, directorId } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const existing = await prisma.area.findFirst({ where: { name: name.trim() } });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe un área con ese nombre' });
        }

        const area = await prisma.area.create({
            data: {
                name: name.trim(),
                directorId: directorId || null
            },
            include: {
                director: {
                    select: { id: true, name: true, email: true }
                }
            }
        });
        res.status(201).json(area);
    } catch (error: any) {
        console.error('Error creating area:', error);
        res.status(500).json({ error: 'Error al crear área' });
    }
};

export const updateArea = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, directorId } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const area = await prisma.area.update({
            where: { id },
            data: {
                name: name.trim(),
                directorId: directorId || null
            },
            include: {
                director: {
                    select: { id: true, name: true, email: true }
                }
            }
        });
        res.json(area);
    } catch (error: any) {
        console.error('Error updating area:', error);
        res.status(500).json({ error: 'Error al actualizar área' });
    }
};

export const deleteArea = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        // Check if area has users
        const usersCount = await prisma.user.count({ where: { areaId: id } });
        if (usersCount > 0) {
            return res.status(400).json({ error: `No se puede eliminar, hay ${usersCount} usuario(s) asignado(s)` });
        }

        await prisma.area.delete({ where: { id } });
        res.json({ message: 'Área eliminada exitosamente' });
    } catch (error: any) {
        console.error('Error deleting area:', error);
        res.status(500).json({ error: 'Error al eliminar área' });
    }
};

// ==================== PROJECTS ====================

export const getProjects = async (req: AuthRequest, res: Response) => {
    try {
        const projects = await prisma.project.findMany({
            orderBy: { name: 'asc' },
            include: {
                leader: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                subLeader: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                _count: {
                    select: { requirements: true, budgets: true }
                },
                budgets: {
                    select: { amount: true }
                }
            }
        });

        const projectsWithBudget = projects.map(p => ({
            ...p,
            totalBudget: p.budgets.reduce((sum, b) => sum + Number(b.amount), 0)
        }));

        res.json(projectsWithBudget);
    } catch (error: any) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Error al obtener proyectos' });
    }
};

export const createProject = async (req: AuthRequest, res: Response) => {
    const { name, code, description, funder, leaderId, subLeaderId } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const existing = await prisma.project.findFirst({
            where: {
                OR: [
                    { name: name.trim() },
                    ...(code ? [{ code: code.trim() }] : [])
                ]
            }
        });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe un proyecto con ese nombre o código' });
        }

        const project = await prisma.project.create({
            data: {
                name: name.trim(),
                code: code?.trim() || null,
                description: description?.trim() || null,
                funder: funder?.trim() || null,
                leaderId: leaderId || null,
                subLeaderId: subLeaderId || null
            },
            include: {
                leader: { select: { id: true, name: true, email: true } },
                subLeader: { select: { id: true, name: true, email: true } }
            }
        });
        res.status(201).json(project);
    } catch (error: any) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Error al crear proyecto' });
    }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, code, description, funder, leaderId, subLeaderId } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const project = await prisma.project.update({
            where: { id },
            data: {
                name: name.trim(),
                code: code?.trim() || null,
                description: description?.trim() || null,
                funder: funder?.trim() || null,
                leaderId: leaderId || null,
                subLeaderId: subLeaderId || null
            },
            include: {
                leader: { select: { id: true, name: true, email: true } },
                subLeader: { select: { id: true, name: true, email: true } }
            }
        });
        res.json(project);
    } catch (error: any) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Error al actualizar proyecto' });
    }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const reqCount = await prisma.requirement.count({ where: { projectId: id } });
        if (reqCount > 0) {
            return res.status(400).json({ error: `No se puede eliminar, hay ${reqCount} requerimiento(s) asociado(s)` });
        }

        await prisma.project.delete({ where: { id } });
        res.json({ message: 'Proyecto eliminado exitosamente' });
    } catch (error: any) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Error al eliminar proyecto' });
    }
};

// ==================== CATEGORIES ====================

export const getCategories = async (req: AuthRequest, res: Response) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { code: 'asc' },
            include: {
                _count: {
                    select: { budgets: true }
                }
            }
        });
        res.json(categories);
    } catch (error: any) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
    const { name, code, description } = req.body;

    if (!name || !name.trim() || !code || !code.trim()) {
        return res.status(400).json({ error: 'Nombre y código son requeridos' });
    }

    try {
        const existing = await prisma.category.findFirst({
            where: { code: code.trim() }
        });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe una categoría con ese código' });
        }

        const category = await prisma.category.create({
            data: {
                name: name.trim(),
                code: code.trim(),
                description: description?.trim() || null
            }
        });
        res.status(201).json(category);
    } catch (error: any) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, code, description } = req.body;

    if (!name || !name.trim() || !code || !code.trim()) {
        return res.status(400).json({ error: 'Nombre y código son requeridos' });
    }

    try {
        const category = await prisma.category.update({
            where: { id },
            data: {
                name: name.trim(),
                code: code.trim(),
                description: description?.trim() || null
            }
        });
        res.json(category);
    } catch (error: any) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Error al actualizar categoría' });
    }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const budgetCount = await prisma.budget.count({ where: { categoryId: id } });
        if (budgetCount > 0) {
            return res.status(400).json({ error: `No se puede eliminar, hay ${budgetCount} presupuesto(s) asociado(s)` });
        }

        await prisma.category.delete({ where: { id } });
        res.json({ message: 'Categoría eliminada exitosamente' });
    } catch (error: any) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
};

// ==================== SUPPLIERS ====================

const SUPPLIER_MANAGEMENT_VALUES = [
    'UNCLASSIFIED',
    'COMMERCIAL',
    'ADMINISTRATIVE_PURCHASING',
    'PAYROLL',
    'SHARED'
] as const;

type SupplierManagementValue = typeof SUPPLIER_MANAGEMENT_VALUES[number];

const parseSupplierManagement = (value: unknown): SupplierManagementValue | undefined => {
    if (typeof value !== 'string') return undefined;
    return SUPPLIER_MANAGEMENT_VALUES.includes(value as SupplierManagementValue)
        ? value as SupplierManagementValue
        : undefined;
};

export const getSuppliers = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const userRole = req.user?.role;

        const isGlobalViewer = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR', 'AUDITOR'].includes(userRole || '');

        const where: any = {};

        if (!isGlobalViewer) {
            where.requirements = {
                some: {
                    OR: [
                        { createdById: userId },
                        { project: { OR: [{ leaderId: userId }, { subLeaderId: userId }] } },
                        {
                            budget: {
                                OR: [
                                    { managerId: userId },
                                    { subLeaders: { some: { userId } } },
                                    { area: { directorId: userId } }
                                ]
                            }
                        }
                    ]
                }
            };
        }

        const suppliers = await prisma.supplier.findMany({
            where,
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { requirements: true }
                }
            }
        });
        res.json(suppliers);
    } catch (error: any) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
};

export const getSupplierById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    try {
        const isGlobalViewer = ['ADMIN', 'DIRECTOR', 'LEADER', 'DEVELOPER', 'COORDINATOR', 'AUDITOR'].includes(userRole || '');

        // Restriction condition for requirements
        const reqAccessWhere: any = isGlobalViewer ? {} : {
            OR: [
                { createdById: userId },
                { project: { OR: [{ leaderId: userId }, { subLeaderId: userId }] } },
                {
                    budget: {
                        OR: [
                            { managerId: userId },
                            { subLeaders: { some: { userId } } },
                            { area: { directorId: userId } }
                        ]
                    }
                }
            ]
        };

        const decodedId = decodeURIComponent(id);
        const supplier = await prisma.supplier.findFirst({
            where: {
                OR: [
                    { id: decodedId },
                    { taxId: decodedId },
                    { nit: decodedId }
                ]
            },
            include: {
                requirements: {
                    where: reqAccessWhere,
                    take: 50,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        title: true,
                        status: true,
                        totalAmount: true,
                        actualAmount: true,
                        createdAt: true,
                        area: { select: { name: true } },
                        project: { select: { name: true } }
                    }
                },
                ratings: {
                    where: {
                        requirement: reqAccessWhere
                    },
                    orderBy: { createdAt: 'desc' },
                    include: {
                        requirement: { select: { id: true, title: true } }
                    }
                }
            }
        });

        if (!supplier) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        // If not global viewer and no requirements were found (meaning no access to this supplier)
        if (!isGlobalViewer) {
            const hasAnyReq = await prisma.requirement.count({
                where: {
                    supplierId: id,
                    ...reqAccessWhere
                }
            });
            if (hasAnyReq === 0) {
                return res.status(403).json({ error: 'No tiene acceso a este proveedor' });
            }
        }

        // Calculate stats
        const totalRequirements = supplier.requirements.length;
        const approvedRequirements = supplier.requirements.filter(r => r.status === 'APPROVED').length;
        const pendingRequirements = supplier.requirements.filter(r => r.status === 'PENDING_APPROVAL').length;
        const totalAmount = supplier.requirements.reduce((sum, r) => sum + (Number(r.actualAmount) || Number(r.totalAmount) || 0), 0);

        // Calculate rating stats
        const ratingStats = supplier.ratings.length > 0 ? {
            count: supplier.ratings.length,
            avgOverall: supplier.ratings.reduce((sum, r) => sum + r.overallRating, 0) / supplier.ratings.length,
            avgDelivery: supplier.ratings.reduce((sum, r) => sum + r.deliveryRating, 0) / supplier.ratings.length,
            avgQuality: supplier.ratings.reduce((sum, r) => sum + r.qualityRating, 0) / supplier.ratings.length,
            avgPrice: supplier.ratings.reduce((sum, r) => sum + r.priceRating, 0) / supplier.ratings.length
        } : null;

        // Get invoice count
        const invoiceCount = await prisma.invoice.count({
            where: {
                requirement: {
                    supplierId: id,
                    ...reqAccessWhere
                }
            }
        });

        res.json({
            ...supplier,
            stats: {
                totalRequirements,
                totalInvoices: invoiceCount,
                totalAmount,
                approvedRequirements,
                pendingRequirements
            },
            ratingStats
        });
    } catch (error: any) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({ error: 'Error al obtener proveedor' });
    }
};

export const createSupplier = async (req: AuthRequest, res: Response) => {
    const { name, nit, contactName, email, phone, address, activity, supplierType, criticality, management } = req.body;

    console.log('[DEBUG] Intento de creación de proveedor:', { name, nit, supplierType });

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    if (management !== undefined && !parseSupplierManagement(management)) {
        return res.status(400).json({ error: 'La gestión responsable seleccionada no es válida' });
    }

    try {
        const cleanNit = nit?.trim() || null;
        const cleanEmail = email?.trim() || null;
        const cleanPhone = phone?.trim() || null;
        const normalizedManagement = parseSupplierManagement(management) || 'UNCLASSIFIED';

        // Validation: NIT/TaxID uniqueness check
        // In Colombia, NIT and TaxID are often used interchangeably in systems. 
        // We must ensure the new NIT doesn't exist as 'nit' OR 'taxId' in the database.
        if (cleanNit) {
            const existing = await prisma.supplier.findFirst({
                where: {
                    OR: [
                        { nit: cleanNit },
                        { taxId: cleanNit }
                    ]
                }
            });

            if (existing) {
                console.warn(`[WARN] Intento de duplicado de proveedor. NIT proporcionado: ${cleanNit} - Coincide con ID: ${existing.id}`);
                return res.status(400).json({
                    error: `Ya existe un proveedor registrado con ese documento (NIT/RUT)`,
                    details: `Coincidencia encontrada con el proveedor: ${existing.name}`
                });
            }
        }

        const supplier = await prisma.supplier.create({
            data: {
                name: name.trim(),
                nit: cleanNit,
                // If nit is provided, also save it as taxId to maintain consistency if the schema dictates usage of taxId
                taxId: cleanNit,
                contactName: contactName?.trim() || null,
                email: cleanEmail,
                contactEmail: cleanEmail,
                phone: cleanPhone,
                contactPhone: cleanPhone,
                address: address?.trim() || null,
                activity: activity?.trim() || null,
                supplierType: supplierType || 'SUPPLIER',
                criticality: criticality || 'LOW',
                management: normalizedManagement,
                ...(normalizedManagement !== 'UNCLASSIFIED' ? {
                    managementSource: 'MANUAL',
                    managementClassifiedAt: new Date(),
                    managementClassifiedById: req.user?.id || null
                } : {})
            }
        });

        console.log(`[SUCCESS] Proveedor creado exitosamente: ${supplier.id} - ${supplier.name}`);
        res.status(201).json(supplier);
    } catch (error: any) {
        console.error('[ERROR] Error crítico al crear proveedor:', error);

        // Handle Prisma unique constraint errors specific codes
        if (error.code === 'P2002') {
            const target = error.meta?.target || 'campo único';
            return res.status(400).json({ error: `Violación de restricción única en: ${target}` });
        }

        res.status(500).json({
            error: 'Error interno al crear proveedor',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const updateSupplier = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, nit, contactName, email, phone, address, activity, supplierType, criticality, management } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const cleanNit = nit?.trim() || null;
        const cleanEmail = email?.trim() || null;
        const cleanPhone = phone?.trim() || null;
        const normalizedManagement = management === undefined ? undefined : parseSupplierManagement(management);

        if (management !== undefined && !normalizedManagement) {
            return res.status(400).json({ error: 'La gestión responsable seleccionada no es válida' });
        }

        const currentSupplier = normalizedManagement
            ? await prisma.supplier.findUnique({
                where: { id },
                select: { management: true }
            })
            : null;

        if (normalizedManagement && !currentSupplier) {
            return res.status(404).json({ error: 'Proveedor no encontrado' });
        }

        const managementChanged = Boolean(
            normalizedManagement && normalizedManagement !== currentSupplier?.management
        );

        const supplier = await prisma.supplier.update({
            where: { id },
            data: {
                name: name.trim(),
                nit: cleanNit,
                taxId: cleanNit, // Sincronizamos con taxId para que se refleje en la interfaz
                contactName: contactName?.trim() || null,
                email: cleanEmail,
                contactEmail: cleanEmail,
                phone: cleanPhone,
                contactPhone: cleanPhone,
                address: address?.trim() || null,
                activity: activity?.trim() || null,
                supplierType: supplierType || undefined,
                criticality: criticality || undefined,
                ...(normalizedManagement ? {
                    management: normalizedManagement,
                } : {}),
                ...(managementChanged ? {
                    managementSource: 'MANUAL',
                    managementClassifiedAt: new Date(),
                    managementClassifiedById: req.user?.id || null
                } : {})
            }
        });
        res.json(supplier);
    } catch (error: any) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
};

export const deleteSupplier = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const reqCount = await prisma.requirement.count({ where: { supplierId: id } });
        if (reqCount > 0) {
            return res.status(400).json({ error: `No se puede eliminar, hay ${reqCount} requerimiento(s) asociado(s)` });
        }

        await prisma.supplier.delete({ where: { id } });
        res.json({ message: 'Proveedor eliminado exitosamente' });
    } catch (error: any) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
};

// Bulk import suppliers from CSV/XLSX
export const bulkImportSuppliers = async (req: AuthRequest, res: Response) => {
    try {
        const { suppliers } = req.body;

        if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron proveedores para importar' });
        }

        const results = {
            success: 0,
            duplicates: 0,
            errors: 0,
            details: [] as string[]
        };

        // Field mapping from common Excel column names to database fields
        const fieldMapping: Record<string, string> = {
            'nombre': 'name',
            'nombreproveedor': 'name',
            'razonsocial': 'name',
            'razonsocialproveedor': 'name',
            'name': 'name',
            'nit': 'nit',
            'nitcc': 'nit',
            'nitcedula': 'nit',
            'documento': 'nit',
            'identificacion': 'nit',
            'rut': 'nit',
            'taxid': 'taxId',
            'tax_id': 'taxId',
            'email': 'email',
            'correo': 'email',
            'correoelectronico': 'email',
            'mail': 'email',
            'contactemail': 'contactEmail',
            'contact_email': 'contactEmail',
            'emailcontacto': 'contactEmail',
            'correocontacto': 'contactEmail',
            'telefono': 'phone',
            'telefonofijo': 'phone',
            'celular': 'phone',
            'movil': 'phone',
            'phone': 'phone',
            'tel': 'phone',
            'contactphone': 'contactPhone',
            'contact_phone': 'contactPhone',
            'telefonocontacto': 'contactPhone',
            'contactname': 'contactName',
            'contact_name': 'contactName',
            'nombrecontacto': 'contactName',
            'contacto': 'contactName',
            'direccion': 'address',
            'direccionproveedor': 'address',
            'address': 'address',
            'dir': 'address',
            // New fields
            'actividad': 'activity',
            'activity': 'activity',
            'actividadempresa': 'activity',
            'actividad_empresa': 'activity',
            'tipo': 'supplierType',
            'type': 'supplierType',
            'tipoproveedor': 'supplierType',
            'supplier_type': 'supplierType',
            'suppliertype': 'supplierType',
            'criticidad': 'criticality',
            'criticality': 'criticality',
            'riesgo': 'criticality',
            'risk': 'criticality'
        };

        const normalizeImportKey = (key: string) => key
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[\s_/-]+/g, '')
            .replace(/[^a-z0-9]/g, '');

        // Helper to map string values to enums
        const mapSupplierType = (value: string): 'SUPPLIER' | 'SERVICE_PROVIDER' => {
            const normalized = value?.toLowerCase().trim() || '';
            if (normalized.includes('servicio') || normalized.includes('service') || normalized === 'prestador') {
                return 'SERVICE_PROVIDER';
            }
            return 'SUPPLIER';
        };

        const mapCriticality = (value: string): 'LOW' | 'MEDIUM' | 'HIGH' => {
            const normalized = value?.toLowerCase().trim() || '';
            if (normalized === 'alta' || normalized === 'high' || normalized === '3') {
                return 'HIGH';
            }
            if (normalized === 'media' || normalized === 'medium' || normalized === 'medio' || normalized === '2') {
                return 'MEDIUM';
            }
            return 'LOW';
        };

        for (const rawSupplier of suppliers) {
            try {
                // Map fields from input to database format
                const mappedSupplier: any = {};

                for (const [key, value] of Object.entries(rawSupplier)) {
                    // Skip ID field - let database auto-generate
                    if (key.toLowerCase() === 'id') continue;

                    const normalizedKey = normalizeImportKey(key);
                    const dbField = fieldMapping[normalizedKey] || key;

                    // Only set non-empty values
                    if (value !== null && value !== undefined && value !== '') {
                        mappedSupplier[dbField] = String(value).trim();
                    }
                }

                // Validate required fields
                if (!mappedSupplier.name) {
                    results.errors++;
                    results.details.push(`Fila sin nombre de proveedor`);
                    continue;
                }

                // Check for existing supplier by NIT or taxId
                const existingConditions: any[] = [];
                const nitValue = mappedSupplier.nit || mappedSupplier.taxId || null;
                const emailValue = mappedSupplier.email || mappedSupplier.contactEmail || null;
                const phoneValue = mappedSupplier.phone || mappedSupplier.contactPhone || null;

                if (nitValue) {
                    existingConditions.push({ nit: nitValue }, { taxId: nitValue });
                }
                if (existingConditions.length > 0) {
                    const existing = await prisma.supplier.findFirst({
                        where: { OR: existingConditions }
                    });

                    if (existing) {
                        results.duplicates++;
                        results.details.push(`Duplicado: ${mappedSupplier.name} (NIT/TaxId ya existe)`);
                        continue;
                    }
                }

                // Create supplier - ensure empty strings become null for unique fields
                await prisma.supplier.create({
                    data: {
                        name: mappedSupplier.name,
                        nit: nitValue && nitValue.trim() !== '' ? nitValue : null,
                        taxId: nitValue && nitValue.trim() !== '' ? nitValue : null,
                        email: emailValue || null,
                        contactEmail: emailValue || null,
                        phone: phoneValue || null,
                        contactPhone: phoneValue || null,
                        contactName: mappedSupplier.contactName || null,
                        address: mappedSupplier.address || null,
                        activity: mappedSupplier.activity || null,
                        supplierType: mappedSupplier.supplierType ? mapSupplierType(mappedSupplier.supplierType) : 'SUPPLIER',
                        criticality: mappedSupplier.criticality ? mapCriticality(mappedSupplier.criticality) : 'LOW'
                    }
                });

                results.success++;
            } catch (err: any) {
                results.errors++;
                // Handle Prisma unique constraint violation
                if (err.code === 'P2002') {
                    results.duplicates++;
                    results.details.push(`Duplicado: ${rawSupplier.name || 'Sin nombre'} (${err.meta?.target || 'campo único'})`);
                } else {
                    results.details.push(`Error en ${rawSupplier.name || 'Sin nombre'}: ${err.message}`);
                }
            }
        }

        res.json({
            message: `Importación completada: ${results.success} creados, ${results.duplicates} duplicados, ${results.errors} errores`,
            results
        });
    } catch (error: any) {
        console.error('Error in bulk import:', error);
        res.status(500).json({ error: 'Error al importar proveedores', details: error.message });
    }
};

// ==================== USERS ====================

export const getUsers = async (req: AuthRequest, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { name: 'asc' },
            include: {
                area: { select: { name: true } }
            }
        });
        res.json(users);
    } catch (error: any) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const updated = await prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive }
        });
        res.json(updated);
    } catch (error: any) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
        // Can't delete self
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde aquí' });
        }
        await prisma.user.delete({ where: { id } });
        res.json({ message: 'Usuario eliminado' });
    } catch (error: any) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, role, areaId, isActive } = req.body;

    try {
        const user = await prisma.user.update({
            where: { id },
            data: {
                name,
                role,
                areaId,
                isActive
            }
        });
        res.json(user);
    } catch (error: any) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

// ==================== SYSTEM CONFIG ====================

export const getSystemConfig = async (req: AuthRequest, res: Response) => {
    try {
        let config = await prisma.systemConfig.findFirst({
            where: { id: 'main' }
        });

        if (!config) {
            config = await prisma.systemConfig.create({
                data: { id: 'main' }
            });
        }

        res.json(config);
    } catch (error: any) {
        console.error('Error fetching system config:', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};

export const updateSystemConfig = async (req: AuthRequest, res: Response) => {
    const { activeYear, appName, isRegistrationEnabled, maintenanceMode } = req.body;

    try {
        const config = await prisma.systemConfig.update({
            where: { id: 'main' },
            data: {
                activeYear,
                appName,
                isRegistrationEnabled,
                maintenanceMode
            }
        });
        res.json(config);
    } catch (error: any) {
        console.error('Error updating system config:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
};

export const getSystemHealth = async (req: AuthRequest, res: Response) => {
    const startedAt = Date.now();
    const checks: Array<{
        key: string;
        label: string;
        status: 'ok' | 'warning' | 'error';
        message: string;
        latencyMs?: number;
    }> = [];

    const addCheck = (
        key: string,
        label: string,
        status: 'ok' | 'warning' | 'error',
        message: string,
        latencyMs?: number
    ) => {
        checks.push({ key, label, status, message, latencyMs });
    };

    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        addCheck('database', 'Base de datos', 'ok', 'PostgreSQL responde correctamente', Date.now() - dbStart);
    } catch (error: any) {
        addCheck('database', 'Base de datos', 'error', error.message || 'No se pudo consultar PostgreSQL');
    }

    addCheck(
        'auth',
        'Autenticación',
        process.env.JWT_SECRET && process.env.JWT_SECRET !== 'fallback_secret' ? 'ok' : 'error',
        process.env.JWT_SECRET && process.env.JWT_SECRET !== 'fallback_secret'
            ? 'JWT_SECRET está configurado'
            : 'JWT_SECRET falta o usa el valor por defecto'
    );

    addCheck(
        'ai',
        'IA',
        process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY ? 'ok' : 'warning',
        process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY
            ? `Proveedor configurado: ${process.env.GEMINI_API_KEY ? 'Gemini' : 'Groq'}`
            : 'No hay API key de IA configurada'
    );

    addCheck(
        'email',
        'Correo',
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS ? 'ok' : 'warning',
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
            ? `SMTP configurado en ${process.env.SMTP_HOST}`
            : 'SMTP incompleto; los correos pueden no enviarse'
    );

    addCheck(
        'storage',
        'Almacenamiento',
        process.env.AZURE_STORAGE_CONNECTION_STRING ? 'ok' : 'warning',
        process.env.AZURE_STORAGE_CONNECTION_STRING
            ? `Azure Blob configurado (${process.env.AZURE_STORAGE_CONTAINER || 'pdfs'})`
            : 'Sin Azure Blob; puede usar almacenamiento local del contenedor'
    );

    addCheck(
        'cors',
        'CORS',
        process.env.CORS_ORIGIN || process.env.FRONTEND_URL ? 'ok' : 'warning',
        process.env.CORS_ORIGIN || process.env.FRONTEND_URL
            ? 'Origen de frontend configurado'
            : 'No hay CORS_ORIGIN/FRONTEND_URL explícito'
    );

    const summaryStatus = checks.some(c => c.status === 'error')
        ? 'error'
        : checks.some(c => c.status === 'warning')
            ? 'warning'
            : 'ok';

    res.json({
        status: summaryStatus,
        checkedAt: new Date().toISOString(),
        uptimeSeconds: Math.round(process.uptime()),
        environment: process.env.NODE_ENV || 'production',
        responseTimeMs: Date.now() - startedAt,
        checks
    });
};

// ==================== STATS ====================

export const getAdminStats = async (req: AuthRequest, res: Response) => {
    try {
        const [areasCount, projectsCount, categoriesCount, suppliersCount, usersCount] = await Promise.all([
            prisma.area.count(),
            prisma.project.count(),
            prisma.category.count(),
            prisma.supplier.count(),
            prisma.user.count()
        ]);

        res.json({
            areas: areasCount,
            projects: projectsCount,
            categories: categoriesCount,
            suppliers: suppliersCount,
            users: usersCount
        });
    } catch (error: any) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

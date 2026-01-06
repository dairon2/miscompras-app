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
                _count: {
                    select: { requirements: true, budgets: true }
                }
            }
        });
        res.json(projects);
    } catch (error: any) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Error al obtener proyectos' });
    }
};

export const createProject = async (req: AuthRequest, res: Response) => {
    const { name, code, description, funder, leaderId } = req.body;

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
                leaderId: leaderId || null
            },
            include: {
                leader: { select: { id: true, name: true, email: true } }
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
    const { name, code, description, funder, leaderId } = req.body;

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
                leaderId: leaderId || null
            },
            include: {
                leader: { select: { id: true, name: true, email: true } }
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

export const getSuppliers = async (req: AuthRequest, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({
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

export const createSupplier = async (req: AuthRequest, res: Response) => {
    const { name, nit, contactName, email, phone, address } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        if (nit) {
            const existing = await prisma.supplier.findFirst({ where: { nit: nit.trim() } });
            if (existing) {
                return res.status(400).json({ error: 'Ya existe un proveedor con ese NIT' });
            }
        }

        const supplier = await prisma.supplier.create({
            data: {
                name: name.trim(),
                nit: nit?.trim() || null,
                contactName: contactName?.trim() || null,
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                address: address?.trim() || null
            }
        });
        res.status(201).json(supplier);
    } catch (error: any) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ error: 'Error al crear proveedor' });
    }
};

export const updateSupplier = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, nit, contactName, email, phone, address } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const supplier = await prisma.supplier.update({
            where: { id },
            data: {
                name: name.trim(),
                nit: nit?.trim() || null,
                contactName: contactName?.trim() || null,
                email: email?.trim() || null,
                phone: phone?.trim() || null,
                address: address?.trim() || null
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
            'name': 'name',
            'nit': 'nit',
            'rut': 'nit',
            'taxid': 'taxId',
            'tax_id': 'taxId',
            'email': 'email',
            'correo': 'email',
            'contactemail': 'contactEmail',
            'contact_email': 'contactEmail',
            'emailcontacto': 'contactEmail',
            'telefono': 'phone',
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
            'address': 'address',
            'dir': 'address',
            // New fields
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

                    const normalizedKey = key.toLowerCase().replace(/\s+/g, '').replace(/_/g, '');
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
                if (mappedSupplier.nit) {
                    existingConditions.push({ nit: mappedSupplier.nit });
                }
                if (mappedSupplier.taxId) {
                    existingConditions.push({ taxId: mappedSupplier.taxId });
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
                        nit: mappedSupplier.nit && mappedSupplier.nit.trim() !== '' ? mappedSupplier.nit : null,
                        taxId: mappedSupplier.taxId && mappedSupplier.taxId.trim() !== '' ? mappedSupplier.taxId : null,
                        email: mappedSupplier.email || null,
                        contactEmail: mappedSupplier.contactEmail || null,
                        phone: mappedSupplier.phone || null,
                        contactPhone: mappedSupplier.contactPhone || null,
                        contactName: mappedSupplier.contactName || null,
                        address: mappedSupplier.address || null,
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

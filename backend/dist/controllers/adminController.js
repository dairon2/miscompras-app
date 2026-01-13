"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminStats = exports.updateSystemConfig = exports.getSystemConfig = exports.updateUser = exports.deleteUser = exports.toggleUserStatus = exports.getUsers = exports.bulkImportSuppliers = exports.deleteSupplier = exports.updateSupplier = exports.createSupplier = exports.getSupplierById = exports.getSuppliers = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.deleteProject = exports.updateProject = exports.createProject = exports.getProjects = exports.deleteArea = exports.updateArea = exports.createArea = exports.getAreas = void 0;
const index_1 = require("../index");
// ==================== AREAS ====================
const getAreas = async (req, res) => {
    try {
        const areas = await index_1.prisma.area.findMany({
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
    }
    catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({ error: 'Error al obtener áreas' });
    }
};
exports.getAreas = getAreas;
const createArea = async (req, res) => {
    const { name, directorId } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        const existing = await index_1.prisma.area.findFirst({ where: { name: name.trim() } });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe un área con ese nombre' });
        }
        const area = await index_1.prisma.area.create({
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
    }
    catch (error) {
        console.error('Error creating area:', error);
        res.status(500).json({ error: 'Error al crear área' });
    }
};
exports.createArea = createArea;
const updateArea = async (req, res) => {
    const { id } = req.params;
    const { name, directorId } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        const area = await index_1.prisma.area.update({
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
    }
    catch (error) {
        console.error('Error updating area:', error);
        res.status(500).json({ error: 'Error al actualizar área' });
    }
};
exports.updateArea = updateArea;
const deleteArea = async (req, res) => {
    const { id } = req.params;
    try {
        // Check if area has users
        const usersCount = await index_1.prisma.user.count({ where: { areaId: id } });
        if (usersCount > 0) {
            return res.status(400).json({ error: `No se puede eliminar, hay ${usersCount} usuario(s) asignado(s)` });
        }
        await index_1.prisma.area.delete({ where: { id } });
        res.json({ message: 'Área eliminada exitosamente' });
    }
    catch (error) {
        console.error('Error deleting area:', error);
        res.status(500).json({ error: 'Error al eliminar área' });
    }
};
exports.deleteArea = deleteArea;
// ==================== PROJECTS ====================
const getProjects = async (req, res) => {
    try {
        const projects = await index_1.prisma.project.findMany({
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
    }
    catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Error al obtener proyectos' });
    }
};
exports.getProjects = getProjects;
const createProject = async (req, res) => {
    const { name, code, description, funder, leaderId } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        const existing = await index_1.prisma.project.findFirst({
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
        const project = await index_1.prisma.project.create({
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
    }
    catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Error al crear proyecto' });
    }
};
exports.createProject = createProject;
const updateProject = async (req, res) => {
    const { id } = req.params;
    const { name, code, description, funder, leaderId } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        const project = await index_1.prisma.project.update({
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
    }
    catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Error al actualizar proyecto' });
    }
};
exports.updateProject = updateProject;
const deleteProject = async (req, res) => {
    const { id } = req.params;
    try {
        const reqCount = await index_1.prisma.requirement.count({ where: { projectId: id } });
        if (reqCount > 0) {
            return res.status(400).json({ error: `No se puede eliminar, hay ${reqCount} requerimiento(s) asociado(s)` });
        }
        await index_1.prisma.project.delete({ where: { id } });
        res.json({ message: 'Proyecto eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Error al eliminar proyecto' });
    }
};
exports.deleteProject = deleteProject;
// ==================== CATEGORIES ====================
const getCategories = async (req, res) => {
    try {
        const categories = await index_1.prisma.category.findMany({
            orderBy: { code: 'asc' },
            include: {
                _count: {
                    select: { budgets: true }
                }
            }
        });
        res.json(categories);
    }
    catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Error al obtener categorías' });
    }
};
exports.getCategories = getCategories;
const createCategory = async (req, res) => {
    const { name, code, description } = req.body;
    if (!name || !name.trim() || !code || !code.trim()) {
        return res.status(400).json({ error: 'Nombre y código son requeridos' });
    }
    try {
        const existing = await index_1.prisma.category.findFirst({
            where: { code: code.trim() }
        });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe una categoría con ese código' });
        }
        const category = await index_1.prisma.category.create({
            data: {
                name: name.trim(),
                code: code.trim(),
                description: description?.trim() || null
            }
        });
        res.status(201).json(category);
    }
    catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Error al crear categoría' });
    }
};
exports.createCategory = createCategory;
const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, code, description } = req.body;
    if (!name || !name.trim() || !code || !code.trim()) {
        return res.status(400).json({ error: 'Nombre y código son requeridos' });
    }
    try {
        const category = await index_1.prisma.category.update({
            where: { id },
            data: {
                name: name.trim(),
                code: code.trim(),
                description: description?.trim() || null
            }
        });
        res.json(category);
    }
    catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Error al actualizar categoría' });
    }
};
exports.updateCategory = updateCategory;
const deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        const budgetCount = await index_1.prisma.budget.count({ where: { categoryId: id } });
        if (budgetCount > 0) {
            return res.status(400).json({ error: `No se puede eliminar, hay ${budgetCount} presupuesto(s) asociado(s)` });
        }
        await index_1.prisma.category.delete({ where: { id } });
        res.json({ message: 'Categoría eliminada exitosamente' });
    }
    catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Error al eliminar categoría' });
    }
};
exports.deleteCategory = deleteCategory;
// ==================== SUPPLIERS ====================
const getSuppliers = async (req, res) => {
    try {
        const suppliers = await index_1.prisma.supplier.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { requirements: true }
                }
            }
        });
        res.json(suppliers);
    }
    catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
};
exports.getSuppliers = getSuppliers;
const getSupplierById = async (req, res) => {
    const { id } = req.params;
    try {
        const supplier = await index_1.prisma.supplier.findUnique({
            where: { id },
            include: {
                requirements: {
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
        const invoiceCount = await index_1.prisma.invoice.count({
            where: {
                requirement: { supplierId: id }
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
    }
    catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({ error: 'Error al obtener proveedor' });
    }
};
exports.getSupplierById = getSupplierById;
const createSupplier = async (req, res) => {
    const { name, nit, contactName, email, phone, address } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        if (nit) {
            const existing = await index_1.prisma.supplier.findFirst({ where: { nit: nit.trim() } });
            if (existing) {
                return res.status(400).json({ error: 'Ya existe un proveedor con ese NIT' });
            }
        }
        const supplier = await index_1.prisma.supplier.create({
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
    }
    catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ error: 'Error al crear proveedor' });
    }
};
exports.createSupplier = createSupplier;
const updateSupplier = async (req, res) => {
    const { id } = req.params;
    const { name, nit, contactName, email, phone, address } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        const supplier = await index_1.prisma.supplier.update({
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
    }
    catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ error: 'Error al actualizar proveedor' });
    }
};
exports.updateSupplier = updateSupplier;
const deleteSupplier = async (req, res) => {
    const { id } = req.params;
    try {
        const reqCount = await index_1.prisma.requirement.count({ where: { supplierId: id } });
        if (reqCount > 0) {
            return res.status(400).json({ error: `No se puede eliminar, hay ${reqCount} requerimiento(s) asociado(s)` });
        }
        await index_1.prisma.supplier.delete({ where: { id } });
        res.json({ message: 'Proveedor eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
};
exports.deleteSupplier = deleteSupplier;
// Bulk import suppliers from CSV/XLSX
const bulkImportSuppliers = async (req, res) => {
    try {
        const { suppliers } = req.body;
        if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron proveedores para importar' });
        }
        const results = {
            success: 0,
            duplicates: 0,
            errors: 0,
            details: []
        };
        // Field mapping from common Excel column names to database fields
        const fieldMapping = {
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
        // Helper to map string values to enums
        const mapSupplierType = (value) => {
            const normalized = value?.toLowerCase().trim() || '';
            if (normalized.includes('servicio') || normalized.includes('service') || normalized === 'prestador') {
                return 'SERVICE_PROVIDER';
            }
            return 'SUPPLIER';
        };
        const mapCriticality = (value) => {
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
                const mappedSupplier = {};
                for (const [key, value] of Object.entries(rawSupplier)) {
                    // Skip ID field - let database auto-generate
                    if (key.toLowerCase() === 'id')
                        continue;
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
                const existingConditions = [];
                if (mappedSupplier.nit) {
                    existingConditions.push({ nit: mappedSupplier.nit });
                }
                if (mappedSupplier.taxId) {
                    existingConditions.push({ taxId: mappedSupplier.taxId });
                }
                if (existingConditions.length > 0) {
                    const existing = await index_1.prisma.supplier.findFirst({
                        where: { OR: existingConditions }
                    });
                    if (existing) {
                        results.duplicates++;
                        results.details.push(`Duplicado: ${mappedSupplier.name} (NIT/TaxId ya existe)`);
                        continue;
                    }
                }
                // Create supplier - ensure empty strings become null for unique fields
                await index_1.prisma.supplier.create({
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
            }
            catch (err) {
                results.errors++;
                // Handle Prisma unique constraint violation
                if (err.code === 'P2002') {
                    results.duplicates++;
                    results.details.push(`Duplicado: ${rawSupplier.name || 'Sin nombre'} (${err.meta?.target || 'campo único'})`);
                }
                else {
                    results.details.push(`Error en ${rawSupplier.name || 'Sin nombre'}: ${err.message}`);
                }
            }
        }
        res.json({
            message: `Importación completada: ${results.success} creados, ${results.duplicates} duplicados, ${results.errors} errores`,
            results
        });
    }
    catch (error) {
        console.error('Error in bulk import:', error);
        res.status(500).json({ error: 'Error al importar proveedores', details: error.message });
    }
};
exports.bulkImportSuppliers = bulkImportSuppliers;
// ==================== USERS ====================
const getUsers = async (req, res) => {
    try {
        const users = await index_1.prisma.user.findMany({
            orderBy: { name: 'asc' },
            include: {
                area: { select: { name: true } }
            }
        });
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};
exports.getUsers = getUsers;
const toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await index_1.prisma.user.findUnique({ where: { id } });
        if (!user)
            return res.status(404).json({ error: 'Usuario no encontrado' });
        const updated = await index_1.prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive }
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};
exports.toggleUserStatus = toggleUserStatus;
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // Can't delete self
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde aquí' });
        }
        await index_1.prisma.user.delete({ where: { id } });
        res.json({ message: 'Usuario eliminado' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};
exports.deleteUser = deleteUser;
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, role, areaId, isActive } = req.body;
    try {
        const user = await index_1.prisma.user.update({
            where: { id },
            data: {
                name,
                role,
                areaId,
                isActive
            }
        });
        res.json(user);
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};
exports.updateUser = updateUser;
// ==================== SYSTEM CONFIG ====================
const getSystemConfig = async (req, res) => {
    try {
        let config = await index_1.prisma.systemConfig.findFirst({
            where: { id: 'main' }
        });
        if (!config) {
            config = await index_1.prisma.systemConfig.create({
                data: { id: 'main' }
            });
        }
        res.json(config);
    }
    catch (error) {
        console.error('Error fetching system config:', error);
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
};
exports.getSystemConfig = getSystemConfig;
const updateSystemConfig = async (req, res) => {
    const { activeYear, appName, isRegistrationEnabled, maintenanceMode } = req.body;
    try {
        const config = await index_1.prisma.systemConfig.update({
            where: { id: 'main' },
            data: {
                activeYear,
                appName,
                isRegistrationEnabled,
                maintenanceMode
            }
        });
        res.json(config);
    }
    catch (error) {
        console.error('Error updating system config:', error);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
};
exports.updateSystemConfig = updateSystemConfig;
// ==================== STATS ====================
const getAdminStats = async (req, res) => {
    try {
        const [areasCount, projectsCount, categoriesCount, suppliersCount, usersCount] = await Promise.all([
            index_1.prisma.area.count(),
            index_1.prisma.project.count(),
            index_1.prisma.category.count(),
            index_1.prisma.supplier.count(),
            index_1.prisma.user.count()
        ]);
        res.json({
            areas: areasCount,
            projects: projectsCount,
            categories: categoriesCount,
            suppliers: suppliersCount,
            users: usersCount
        });
    }
    catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};
exports.getAdminStats = getAdminStats;

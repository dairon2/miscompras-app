"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminStats = exports.deleteSupplier = exports.updateSupplier = exports.createSupplier = exports.getSuppliers = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.deleteProject = exports.updateProject = exports.createProject = exports.getProjects = exports.deleteArea = exports.updateArea = exports.createArea = exports.getAreas = void 0;
const index_1 = require("../index");
// ==================== AREAS ====================
const getAreas = async (req, res) => {
    try {
        const areas = await index_1.prisma.area.findMany({
            orderBy: { name: 'asc' },
            include: {
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
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        const existing = await index_1.prisma.area.findFirst({ where: { name: name.trim() } });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe un área con ese nombre' });
        }
        const area = await index_1.prisma.area.create({
            data: { name: name.trim() }
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
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        const area = await index_1.prisma.area.update({
            where: { id },
            data: { name: name.trim() }
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
                _count: {
                    select: { requirements: true, budgets: true }
                }
            }
        });
        res.json(projects);
    }
    catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Error al obtener proyectos' });
    }
};
exports.getProjects = getProjects;
const createProject = async (req, res) => {
    const { name, code, description } = req.body;
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
                description: description?.trim() || null
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
    const { name, code, description } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }
    try {
        const project = await index_1.prisma.project.update({
            where: { id },
            data: {
                name: name.trim(),
                code: code?.trim() || null,
                description: description?.trim() || null
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
// ==================== STATS ====================
const getAdminStats = async (req, res) => {
    try {
        const [areasCount, projectsCount, categoriesCount, suppliersCount] = await Promise.all([
            index_1.prisma.area.count(),
            index_1.prisma.project.count(),
            index_1.prisma.category.count(),
            index_1.prisma.supplier.count()
        ]);
        res.json({
            areas: areasCount,
            projects: projectsCount,
            categories: categoriesCount,
            suppliers: suppliersCount
        });
    }
    catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};
exports.getAdminStats = getAdminStats;

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
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const existing = await prisma.area.findFirst({ where: { name: name.trim() } });
        if (existing) {
            return res.status(400).json({ error: 'Ya existe un área con ese nombre' });
        }

        const area = await prisma.area.create({
            data: { name: name.trim() }
        });
        res.status(201).json(area);
    } catch (error: any) {
        console.error('Error creating area:', error);
        res.status(500).json({ error: 'Error al crear área' });
    }
};

export const updateArea = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const area = await prisma.area.update({
            where: { id },
            data: { name: name.trim() }
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
    const { name, code, description } = req.body;

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
                description: description?.trim() || null
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
    const { name, code, description } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'El nombre es requerido' });
    }

    try {
        const project = await prisma.project.update({
            where: { id },
            data: {
                name: name.trim(),
                code: code?.trim() || null,
                description: description?.trim() || null
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

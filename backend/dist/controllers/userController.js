"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePassword = exports.getProfile = exports.updateProfile = exports.changePassword = exports.deleteUser = exports.toggleUserStatus = exports.updateUser = exports.createUser = exports.getUserById = exports.getUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../index");
// Get all users with filters
const getUsers = async (req, res) => {
    const { role, areaId, isActive, search } = req.query;
    try {
        const users = await index_1.prisma.user.findMany({
            where: {
                ...(role && { role: role }),
                ...(areaId && { areaId: areaId }),
                ...(isActive !== undefined && { isActive: isActive === 'true' }),
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } }
                    ]
                })
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                areaId: true,
                area: { select: { id: true, name: true } },
                isActive: true,
                phone: true,
                position: true,
                createdAt: true
            },
            orderBy: { name: 'asc' }
        });
        res.json(users);
    }
    catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
};
exports.getUsers = getUsers;
// Get user by ID
const getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await index_1.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                areaId: true,
                area: { select: { id: true, name: true } },
                isActive: true,
                phone: true,
                position: true,
                createdAt: true,
                lastLoginAt: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};
exports.getUserById = getUserById;
// Create new user (ADMIN only)
const createUser = async (req, res) => {
    const { email, password, name, role, areaId, phone, position } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, contraseña y nombre son requeridos' });
    }
    try {
        // Check if email already exists
        const existingUser = await index_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const user = await index_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'USER',
                areaId,
                phone,
                position,
                isActive: true
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                areaId: true,
                isActive: true
            }
        });
        res.status(201).json(user);
    }
    catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error al crear el usuario', details: error.message });
    }
};
exports.createUser = createUser;
// Update user (ADMIN only)
const updateUser = async (req, res) => {
    const { id } = req.params;
    const { email, name, role, areaId, phone, position, password } = req.body;
    try {
        const existingUser = await index_1.prisma.user.findUnique({ where: { id } });
        if (!existingUser) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        // If email is changing, check it's not already taken
        if (email && email !== existingUser.email) {
            const emailExists = await index_1.prisma.user.findUnique({ where: { email } });
            if (emailExists) {
                return res.status(400).json({ error: 'El email ya está en uso' });
            }
        }
        const updateData = {
            ...(email && { email }),
            ...(name && { name }),
            ...(role && { role }),
            ...(areaId !== undefined && { areaId }),
            ...(phone !== undefined && { phone }),
            ...(position !== undefined && { position })
        };
        // If password is provided, hash it
        if (password) {
            updateData.password = await bcryptjs_1.default.hash(password, 12);
        }
        const user = await index_1.prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                areaId: true,
                area: { select: { id: true, name: true } },
                isActive: true,
                phone: true,
                position: true
            }
        });
        res.json(user);
    }
    catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
};
exports.updateUser = updateUser;
// Toggle user active status (ADMIN only)
const toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await index_1.prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        // Don't allow deactivating yourself
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
        }
        const updatedUser = await index_1.prisma.user.update({
            where: { id },
            data: { isActive: !user.isActive },
            select: {
                id: true,
                name: true,
                email: true,
                isActive: true
            }
        });
        res.json(updatedUser);
    }
    catch (error) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Error al cambiar estado del usuario' });
    }
};
exports.toggleUserStatus = toggleUserStatus;
// Delete user (ADMIN only)
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        // Don't allow deleting yourself
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
        }
        const user = await index_1.prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        await index_1.prisma.user.delete({ where: { id } });
        res.json({ message: 'Usuario eliminado exitosamente' });
    }
    catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};
exports.deleteUser = deleteUser;
// Change own password
const changePassword = async (req, res) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }
    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }
    try {
        const user = await index_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        // Verify current password
        const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
        }
        // Hash and update new password
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
        await index_1.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });
        res.json({ message: 'Contraseña actualizada exitosamente' });
    }
    catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};
exports.changePassword = changePassword;
// Update own profile
const updateProfile = async (req, res) => {
    const userId = req.user?.id;
    const { name, phone, position } = req.body;
    try {
        const user = await index_1.prisma.user.update({
            where: { id: userId },
            data: {
                ...(name && { name }),
                ...(phone !== undefined && { phone }),
                ...(position !== undefined && { position })
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                areaId: true,
                phone: true,
                position: true
            }
        });
        res.json(user);
    }
    catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error al actualizar el perfil' });
    }
};
exports.updateProfile = updateProfile;
// Get current user profile
const getProfile = async (req, res) => {
    const userId = req.user?.id;
    try {
        const user = await index_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                areaId: true,
                area: { select: { id: true, name: true } },
                phone: true,
                position: true,
                createdAt: true,
                lastLoginAt: true
            }
        });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
};
exports.getProfile = getProfile;
// Generate random password
const generatePassword = async (req, res) => {
    const password = crypto_1.default.randomBytes(8).toString('hex');
    res.json({ password });
};
exports.generatePassword = generatePassword;

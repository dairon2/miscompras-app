import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthRequest } from '../middlewares/auth';
import { prisma } from '../index';
import { uploadBufferToBlobStorage } from '../services/blobStorageService';

const USER_LIST_ROLES = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'];
const USER_DETAIL_ROLES = ['ADMIN', 'DIRECTOR', 'LEADER', 'COORDINATOR', 'DEVELOPER', 'AUDITOR'];

// Get all users with filters
export const getUsers = async (req: AuthRequest, res: Response) => {
    const { role, areaId, isActive, search } = req.query;
    const userRole = req.user?.role;
    const userAreaId = req.user?.areaId;
    const canViewDirectory = USER_LIST_ROLES.includes(userRole || '');

    try {
        const users = await prisma.user.findMany({
            where: {
                ...(canViewDirectory && role && { role: role as any }),
                ...(canViewDirectory && areaId && { areaId: areaId as string }),
                ...(!canViewDirectory && { areaId: userAreaId || '__no_area__', isActive: true }),
                ...(isActive !== undefined && { isActive: isActive === 'true' }),
                ...(search && {
                    OR: [
                        { name: { contains: search as string, mode: 'insensitive' } },
                        { email: { contains: search as string, mode: 'insensitive' } }
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
                ...(canViewDirectory && {
                    phone: true,
                    position: true,
                    createdAt: true
                })
            },
            orderBy: { name: 'asc' }
        });
        res.json(users);
    } catch (error: any) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
};

// Get user by ID
export const getUserById = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const userRole = req.user?.role;

    if (id !== req.user?.id && !USER_DETAIL_ROLES.includes(userRole || '')) {
        return res.status(403).json({ error: 'No tienes permiso para consultar este usuario' });
    }

    try {
        const user = await prisma.user.findUnique({
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
    } catch (error: any) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

// Create new user (ADMIN only)
export const createUser = async (req: AuthRequest, res: Response) => {
    const { email, password, name, role, areaId, phone, position } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, contraseña y nombre son requeridos' });
    }

    try {
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
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
    } catch (error: any) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Error al crear el usuario', details: error.message });
    }
};

// Update user (ADMIN only)
export const updateUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { email, name, role, areaId, phone, position, password } = req.body;

    try {
        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // If email is changing, check it's not already taken
        if (email && email !== existingUser.email) {
            const emailExists = await prisma.user.findUnique({ where: { email } });
            if (emailExists) {
                return res.status(400).json({ error: 'El email ya está en uso' });
            }
        }

        const updateData: any = {
            ...(email && { email }),
            ...(name && { name }),
            ...(role && { role }),
            ...(areaId !== undefined && { areaId }),
            ...(phone !== undefined && { phone }),
            ...(position !== undefined && { position })
        };

        // If password is provided, hash it
        if (password) {
            updateData.password = await bcrypt.hash(password, 12);
        }

        const user = await prisma.user.update({
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
    } catch (error: any) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Error al actualizar el usuario' });
    }
};

// Toggle user active status (ADMIN only)
export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Don't allow deactivating yourself
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
        }

        const updatedUser = await prisma.user.update({
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
    } catch (error: any) {
        console.error('Error toggling user status:', error);
        res.status(500).json({ error: 'Error al cambiar estado del usuario' });
    }
};

// Delete user (ADMIN only)
export const deleteUser = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
        // Don't allow deleting yourself
        if (id === req.user?.id) {
            return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
        }

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await prisma.user.delete({ where: { id } });

        res.json({ message: 'Usuario eliminado exitosamente' });
    } catch (error: any) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
};

// Change own password
export const changePassword = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
        }

        // Hash and update new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword }
        });

        res.json({ message: 'Contraseña actualizada exitosamente' });
    } catch (error: any) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Error al cambiar la contraseña' });
    }
};

// Update own profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { name, phone, position } = req.body;

    try {
        const user = await prisma.user.update({
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
    } catch (error: any) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error al actualizar el perfil' });
    }
};

// Get current user profile
export const getProfile = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    try {
        const user = await prisma.user.findUnique({
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
                profilePhoto: true,
                createdAt: true,
                lastLoginAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(user);
    } catch (error: any) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Error al obtener el perfil' });
    }
};

// Generate random password
export const generatePassword = async (req: AuthRequest, res: Response) => {
    const password = crypto.randomBytes(8).toString('hex');
    res.json({ password });
};

// Upload profile photo
export const uploadProfilePhoto = async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    try {
        const file = req.file;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({ error: 'Solo se permiten imágenes (JPEG, PNG, GIF, WEBP)' });
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ error: 'La imagen no puede superar 5MB' });
        }

        // Generate unique blob name
        const ext = file.originalname.split('.').pop() || 'jpg';
        const blobName = `profile-photos/${userId}-${Date.now()}.${ext}`;

        // Upload to Blob Storage
        const photoUrl = await uploadBufferToBlobStorage(
            file.buffer,
            blobName,
            file.mimetype
        );

        if (!photoUrl) {
            return res.status(500).json({ error: 'Error al subir la imagen. Intenta de nuevo.' });
        }

        // Update user profile with new photo URL
        const user = await prisma.user.update({
            where: { id: userId },
            data: { profilePhoto: photoUrl },
            select: {
                id: true,
                name: true,
                email: true,
                profilePhoto: true
            }
        });

        res.json({
            message: 'Foto de perfil actualizada',
            profilePhoto: user.profilePhoto
        });
    } catch (error: any) {
        console.error('Error uploading profile photo:', error);
        res.status(500).json({ error: 'Error al subir la foto de perfil' });
    }
};

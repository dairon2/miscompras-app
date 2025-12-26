import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

export const register = async (req: Request, res: Response) => {
    const { email, password, name, role, areaId } = req.body;

    // Input validation
    if (!email || !password || !name || !areaId) {
        return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    // Password length validation
    if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                name,
                password: hashedPassword,
                role: role || 'USER',
                areaId,
            },
        });

        res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Error al registrar usuario', details: error.message });
    }
};

export const login = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // --- MOCK LOGIN FOR DEMO (Only if DB is not connected) ---
    const isDemoMode = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes("mock");

    if (isDemoMode) {
        if ((email === 'admin@museodeantioquia.co' || email === 'daironmoreno24@gmail.com') && password === 'admin123') {
            const mockUser = {
                id: 'mock-admin-id',
                email: email,
                role: 'ADMIN',
                name: email === 'daironmoreno24@gmail.com' ? 'Dairon Moreno (Admin)' : 'Administrador (Demo)',
                areaId: 'area-3'
            };
            const token = jwt.sign(
                { id: mockUser.id, email: mockUser.email, role: mockUser.role, areaId: mockUser.areaId },
                process.env.JWT_SECRET || 'fallback_secret',
                { expiresIn: '8h' }
            );
            return res.json({ token, user: mockUser });
        }

        if (email === 'testuser@museodeantioquia.co' && password === 'user123') {
            const mockUser = {
                id: 'mock-user-id',
                email: 'testuser@museodeantioquia.co',
                role: 'USER',
                name: 'Usuario de Prueba',
                areaId: 'area-1'
            };
            const token = jwt.sign(
                { id: mockUser.id, email: mockUser.email, role: mockUser.role, areaId: mockUser.areaId },
                process.env.JWT_SECRET || 'fallback_secret',
                { expiresIn: '8h' }
            );
            return res.json({ token, user: mockUser });
        }

        // In demo mode, if credentials don't match, fall through to database check
    }
    // --- END MOCK LOGIN ---

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const storedPassword = (user as any).password;

        if (!storedPassword) {
            return res.status(500).json({ error: 'Error de configuración de usuario' });
        }

        const isMatch = await bcrypt.compare(password, storedPassword);

        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, areaId: user.areaId },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '8h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                areaId: user.areaId
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Error al iniciar sesión', details: error.message });
    }
};

export const getUsers = async (req: Request, res: Response) => {
    const { role } = req.query;

    try {
        const users = await prisma.user.findMany({
            where: role ? { role: role as any } : {},
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                areaId: true
            }
        });
        res.json(users);
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = exports.refreshToken = exports.resetPassword = exports.forgotPassword = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const index_1 = require("../index");
const emailService_1 = require("../services/emailService");
const register = async (req, res) => {
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
        const existingUser = await index_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await index_1.prisma.user.create({
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
    }
    catch (error) {
        res.status(500).json({ error: 'Error al registrar usuario', details: error.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    const { email, password, rememberMe } = req.body;
    // Input validation
    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }
    try {
        const user = await index_1.prisma.user.findUnique({
            where: { email },
            include: {
                areasDirected: {
                    select: { id: true, name: true }
                }
            }
        });
        if (!user) {
            // Generic error message for security
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const storedPassword = user.password;
        if (!storedPassword) {
            return res.status(500).json({ error: 'Error de configuración de usuario' });
        }
        const isMatch = await bcryptjs_1.default.compare(password, storedPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        // Create access token
        const tokenExpiry = rememberMe ? '30d' : '8h';
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, areaId: user.areaId }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: tokenExpiry });
        // Create refresh token if "remember me" is checked
        let refreshToken = null;
        if (rememberMe) {
            refreshToken = crypto_1.default.randomBytes(64).toString('hex');
            const refreshExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
            await index_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    refreshToken,
                    refreshTokenExpires: refreshExpiry,
                    lastLoginAt: new Date()
                }
            });
        }
        else {
            // Just update last login
            await index_1.prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() }
            });
        }
        res.json({
            token,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                areaId: user.areaId,
                isAreaDirector: user.areasDirected?.length > 0,
                directedAreas: user.areasDirected || []
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Error al iniciar sesión', details: error.message });
    }
};
exports.login = login;
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'El email es requerido' });
    }
    try {
        const user = await index_1.prisma.user.findUnique({ where: { email } });
        // Always return success to prevent email enumeration attacks
        if (!user) {
            return res.json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
        }
        // Generate reset token
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        // Save token to database
        await index_1.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: resetToken,
                passwordResetExpires: resetExpires
            }
        });
        // Send email
        await (0, emailService_1.sendPasswordResetEmail)(email, resetToken);
        res.json({ message: 'Si el email existe, recibirás un enlace de recuperación' });
    }
    catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) {
        return res.status(400).json({ error: 'Token y contraseña son requeridos' });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    try {
        // Find user with valid reset token
        const user = await index_1.prisma.user.findFirst({
            where: {
                passwordResetToken: token,
                passwordResetExpires: {
                    gt: new Date()
                }
            }
        });
        if (!user) {
            return res.status(400).json({ error: 'El enlace es inválido o ha expirado' });
        }
        // Hash new password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Update password and clear reset token
        await index_1.prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
                mustChangePassword: false
            }
        });
        res.json({ message: 'Contraseña actualizada correctamente' });
    }
    catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Error al restablecer la contraseña' });
    }
};
exports.resetPassword = resetPassword;
const refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token es requerido' });
    }
    try {
        const user = await index_1.prisma.user.findFirst({
            where: {
                refreshToken,
                refreshTokenExpires: {
                    gt: new Date()
                }
            },
            include: {
                areasDirected: {
                    select: { id: true, name: true }
                }
            }
        });
        if (!user) {
            return res.status(401).json({ error: 'Token inválido o expirado' });
        }
        // Create new access token
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, areaId: user.areaId }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '8h' });
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
    }
    catch (error) {
        res.status(500).json({ error: 'Error al renovar el token' });
    }
};
exports.refreshToken = refreshToken;
const getUsers = async (req, res) => {
    const { role } = req.query;
    try {
        const users = await index_1.prisma.user.findMany({
            where: role ? { role: role } : {},
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                areaId: true
            }
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
};
exports.getUsers = getUsers;

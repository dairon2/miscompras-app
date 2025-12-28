"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// User management routes (requires auth)
router.get('/', userController_1.getUsers);
router.get('/me', userController_1.getProfile);
router.patch('/me/password', userController_1.changePassword);
router.patch('/me/profile', userController_1.updateProfile);
router.get('/generate-password', userController_1.generatePassword);
// Admin-only routes
router.get('/:id', userController_1.getUserById);
router.post('/', (0, auth_1.roleCheck)(['ADMIN']), userController_1.createUser);
router.put('/:id', (0, auth_1.roleCheck)(['ADMIN']), userController_1.updateUser);
router.patch('/:id/toggle-status', (0, auth_1.roleCheck)(['ADMIN']), userController_1.toggleUserStatus);
router.delete('/:id', (0, auth_1.roleCheck)(['ADMIN']), userController_1.deleteUser);
exports.default = router;

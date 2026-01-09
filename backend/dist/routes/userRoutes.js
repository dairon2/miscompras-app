"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Configure multer for memory storage (for profile photos)
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});
router.use(auth_1.authMiddleware);
// User management routes (requires auth)
router.get('/', userController_1.getUsers);
router.get('/me', userController_1.getProfile);
router.patch('/me/password', userController_1.changePassword);
router.patch('/me/profile', userController_1.updateProfile);
router.post('/me/photo', upload.single('photo'), userController_1.uploadProfilePhoto);
router.get('/generate-password', userController_1.generatePassword);
// Admin-only routes
router.get('/:id', userController_1.getUserById);
router.post('/', (0, auth_1.roleCheck)(['ADMIN']), userController_1.createUser);
router.put('/:id', (0, auth_1.roleCheck)(['ADMIN']), userController_1.updateUser);
router.patch('/:id/toggle-status', (0, auth_1.roleCheck)(['ADMIN']), userController_1.toggleUserStatus);
router.delete('/:id', (0, auth_1.roleCheck)(['ADMIN']), userController_1.deleteUser);
exports.default = router;

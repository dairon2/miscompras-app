"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRequirementGroup = void 0;
const client_1 = require("@prisma/client");
const pdfService_1 = require("./pdfService");
const prisma = new client_1.PrismaClient();
const createRequirementGroup = async (creatorId, requirementsData) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Create the Group
        const group = await tx.requirementGroup.create({
            data: {
                creatorId
            }
        });
        // 2. Create Requirements linked to this group
        const createdRequirements = await Promise.all(requirementsData.map((req) => tx.requirement.create({
            data: {
                ...req,
                groupId: group.id,
                createdById: creatorId,
                status: 'PENDING_APPROVAL' // Default status
            },
            include: {
                area: true
            }
        })));
        // 3. Fetch creator info for PDF
        const creator = await tx.user.findUnique({
            where: { id: creatorId },
            select: { name: true, email: true }
        });
        if (!creator)
            throw new Error('Creator not found');
        // 4. Generate PDF
        const pdfUrl = await (0, pdfService_1.generateRequirementGroupPDF)({
            id: group.id,
            creator: { name: creator.name || 'Usuario', email: creator.email },
            createdAt: group.createdAt,
            requirements: createdRequirements.map(r => ({
                title: r.title,
                description: r.description,
                estimatedAmount: r.estimatedAmount ? Number(r.estimatedAmount) : 0,
                area: { name: r.area.name }
            }))
        });
        // 5. Update group with PDF URL
        await tx.requirementGroup.update({
            where: { id: group.id },
            data: { pdfUrl }
        });
        // 6. Attach PDF to each requirement as per user request
        await Promise.all(createdRequirements.map(req => tx.attachment.create({
            data: {
                requirementId: req.id,
                fileName: `Solicitud_Administrativa_${group.id}.pdf`,
                fileUrl: pdfUrl
            }
        })));
        return { group, requirements: createdRequirements, pdfUrl };
    });
};
exports.createRequirementGroup = createRequirementGroup;

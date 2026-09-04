import { buildRequirementPurchaseOrderUpdate } from '../../utils/requirementPurchaseOrder';

describe('requirement purchase order date', () => {
    const now = new Date('2026-09-03T15:30:00.000Z');

    it('does not alter the order or its date when the field was not submitted', () => {
        expect(buildRequirementPurchaseOrderUpdate('OC-100', undefined, now)).toEqual({
            purchaseOrderNumber: undefined,
            purchaseOrderDate: undefined,
            changed: false
        });
    });

    it('records the date when an order number is entered', () => {
        expect(buildRequirementPurchaseOrderUpdate(null, '  OC-101  ', now)).toEqual({
            purchaseOrderNumber: 'OC-101',
            purchaseOrderDate: now,
            changed: true
        });
    });

    it('records a new date when the order number is replaced', () => {
        expect(buildRequirementPurchaseOrderUpdate('OC-100', 'OC-102', now)).toEqual({
            purchaseOrderNumber: 'OC-102',
            purchaseOrderDate: now,
            changed: true
        });
    });

    it('preserves the existing date when the order number did not change', () => {
        expect(buildRequirementPurchaseOrderUpdate('OC-100', ' OC-100 ', now)).toEqual({
            purchaseOrderNumber: undefined,
            purchaseOrderDate: undefined,
            changed: false
        });
    });

    it('clears the date when the order number is removed', () => {
        expect(buildRequirementPurchaseOrderUpdate('OC-100', '', now)).toEqual({
            purchaseOrderNumber: null,
            purchaseOrderDate: null,
            changed: true
        });
    });
});

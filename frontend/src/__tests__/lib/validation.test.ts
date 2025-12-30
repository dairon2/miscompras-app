/**
 * Validation Utilities Unit Tests
 */

import { rules, validateField, validateForm, getErrorMessage } from '../../lib/validation';

describe('Validation Rules', () => {
    describe('required', () => {
        it('should fail for empty string', () => {
            const rule = rules.required('Campo');
            expect(rule.validate('')).toBe(false);
            expect(rule.message).toBe('Campo es obligatorio');
        });

        it('should pass for non-empty string', () => {
            const rule = rules.required('Campo');
            expect(rule.validate('test')).toBe(true);
        });

        it('should fail for null', () => {
            const rule = rules.required();
            expect(rule.validate(null)).toBe(false);
        });

        it('should fail for undefined', () => {
            const rule = rules.required();
            expect(rule.validate(undefined)).toBe(false);
        });
    });

    describe('email', () => {
        const rule = rules.email();

        it('should pass for valid email', () => {
            expect(rule.validate('test@example.com')).toBe(true);
        });

        it('should fail for invalid email', () => {
            expect(rule.validate('invalid-email')).toBe(false);
            expect(rule.validate('test@')).toBe(false);
            expect(rule.validate('@example.com')).toBe(false);
        });

        it('should fail for empty string', () => {
            expect(rule.validate('')).toBe(false);
        });
    });

    describe('minLength', () => {
        it('should pass when length meets minimum', () => {
            const rule = rules.minLength(5);
            expect(rule.validate('12345')).toBe(true);
            expect(rule.validate('123456')).toBe(true);
        });

        it('should fail when length is below minimum', () => {
            const rule = rules.minLength(5);
            expect(rule.validate('1234')).toBe(false);
        });
    });

    describe('maxLength', () => {
        it('should pass when length is within maximum', () => {
            const rule = rules.maxLength(5);
            expect(rule.validate('12345')).toBe(true);
            expect(rule.validate('123')).toBe(true);
        });

        it('should fail when length exceeds maximum', () => {
            const rule = rules.maxLength(5);
            expect(rule.validate('123456')).toBe(false);
        });
    });

    describe('numeric', () => {
        const rule = rules.numeric();

        it('should pass for numbers', () => {
            expect(rule.validate('123')).toBe(true);
            expect(rule.validate(123)).toBe(true);
            expect(rule.validate('12.5')).toBe(true);
        });

        it('should fail for non-numeric strings', () => {
            expect(rule.validate('abc')).toBe(false);
        });
    });

    describe('positiveNumber', () => {
        const rule = rules.positiveNumber();

        it('should pass for positive numbers', () => {
            expect(rule.validate(1)).toBe(true);
            expect(rule.validate(100)).toBe(true);
        });

        it('should fail for zero', () => {
            expect(rule.validate(0)).toBe(false);
        });

        it('should fail for negative numbers', () => {
            expect(rule.validate(-1)).toBe(false);
        });
    });

    describe('password', () => {
        const rule = rules.password();

        it('should pass for 8+ characters', () => {
            expect(rule.validate('12345678')).toBe(true);
        });

        it('should fail for less than 8 characters', () => {
            expect(rule.validate('1234567')).toBe(false);
        });
    });

    describe('match', () => {
        it('should pass when values match', () => {
            const rule = rules.match('password123', 'Las contraseñas');
            expect(rule.validate('password123')).toBe(true);
        });

        it('should fail when values do not match', () => {
            const rule = rules.match('password123', 'Las contraseñas');
            expect(rule.validate('different')).toBe(false);
            expect(rule.message).toBe('Las contraseñas no coinciden');
        });
    });
});

describe('validateField', () => {
    it('should return null when all rules pass', () => {
        const result = validateField('test@example.com', [
            rules.required('Email'),
            rules.email()
        ]);
        expect(result).toBeNull();
    });

    it('should return first error message when validation fails', () => {
        const result = validateField('', [
            rules.required('Email'),
            rules.email()
        ]);
        expect(result).toBe('Email es obligatorio');
    });
});

describe('validateForm', () => {
    it('should return valid result for valid form', () => {
        const result = validateForm(
            { email: 'test@example.com', password: 'password123' },
            {
                email: [rules.required('Email'), rules.email()],
                password: [rules.required('Contraseña'), rules.password()]
            }
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    it('should return errors for invalid form', () => {
        const result = validateForm(
            { email: '', password: '123' },
            {
                email: [rules.required('Email'), rules.email()],
                password: [rules.required('Contraseña'), rules.password()]
            }
        );
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBe('Email es obligatorio');
        expect(result.errors.password).toBe('La contraseña debe tener al menos 8 caracteres');
    });
});

describe('getErrorMessage', () => {
    it('should extract error from response.data.error', () => {
        const error = { response: { data: { error: 'Custom error' } } };
        expect(getErrorMessage(error)).toBe('Custom error');
    });

    it('should extract error from response.data.message', () => {
        const error = { response: { data: { message: 'Custom message' } } };
        expect(getErrorMessage(error)).toBe('Custom message');
    });

    it('should return friendly message for network errors', () => {
        const error = { message: 'Network Error' };
        expect(getErrorMessage(error)).toBe('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
    });

    it('should return friendly message for 401', () => {
        const error = { response: { status: 401 } };
        expect(getErrorMessage(error)).toBe('Sesión expirada. Por favor inicia sesión nuevamente.');
    });

    it('should return friendly message for 403', () => {
        const error = { response: { status: 403 } };
        expect(getErrorMessage(error)).toBe('No tienes permisos para realizar esta acción.');
    });

    it('should return friendly message for 500', () => {
        const error = { response: { status: 500 } };
        expect(getErrorMessage(error)).toBe('Error interno del servidor. Intenta más tarde.');
    });

    it('should return generic message for unknown errors', () => {
        const error = {};
        expect(getErrorMessage(error)).toBe('Ocurrió un error inesperado. Intenta nuevamente.');
    });
});

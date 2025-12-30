/**
 * Form validation utilities for consistent validation across the application
 */

export interface ValidationRule {
    validate: (value: any) => boolean;
    message: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: Record<string, string>;
}

/**
 * Common validation rules
 */
export const rules = {
    required: (fieldName: string = 'Este campo'): ValidationRule => ({
        validate: (value) => value !== null && value !== undefined && value !== '',
        message: `${fieldName} es obligatorio`
    }),

    email: (): ValidationRule => ({
        validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || ''),
        message: 'Ingresa un correo electrónico válido'
    }),

    minLength: (min: number): ValidationRule => ({
        validate: (value) => (value?.length || 0) >= min,
        message: `Debe tener al menos ${min} caracteres`
    }),

    maxLength: (max: number): ValidationRule => ({
        validate: (value) => (value?.length || 0) <= max,
        message: `No puede exceder ${max} caracteres`
    }),

    numeric: (): ValidationRule => ({
        validate: (value) => !isNaN(Number(value)),
        message: 'Debe ser un número válido'
    }),

    positiveNumber: (): ValidationRule => ({
        validate: (value) => !isNaN(Number(value)) && Number(value) > 0,
        message: 'Debe ser un número mayor a 0'
    }),

    password: (): ValidationRule => ({
        validate: (value) => (value?.length || 0) >= 8,
        message: 'La contraseña debe tener al menos 8 caracteres'
    }),

    match: (otherValue: any, fieldName: string = 'Los valores'): ValidationRule => ({
        validate: (value) => value === otherValue,
        message: `${fieldName} no coinciden`
    }),

    phone: (): ValidationRule => ({
        validate: (value) => !value || /^[\d\s\-\+\(\)]{7,15}$/.test(value),
        message: 'Ingresa un número de teléfono válido'
    }),

    taxId: (): ValidationRule => ({
        validate: (value) => !value || /^[\d]{9,12}(-[\d])?$/.test(value.replace(/\./g, '')),
        message: 'Ingresa un NIT válido (ej: 900123456-1)'
    })
};

/**
 * Validate a single field against multiple rules
 */
export const validateField = (value: any, fieldRules: ValidationRule[]): string | null => {
    for (const rule of fieldRules) {
        if (!rule.validate(value)) {
            return rule.message;
        }
    }
    return null;
};

/**
 * Validate an entire form object
 */
export const validateForm = (
    data: Record<string, any>,
    schema: Record<string, ValidationRule[]>
): ValidationResult => {
    const errors: Record<string, string> = {};

    for (const [field, fieldRules] of Object.entries(schema)) {
        const error = validateField(data[field], fieldRules);
        if (error) {
            errors[field] = error;
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

/**
 * Get user-friendly error message from API error
 */
export const getErrorMessage = (error: any): string => {
    // Axios error with response
    if (error?.response?.data?.error) {
        return error.response.data.error;
    }

    if (error?.response?.data?.message) {
        return error.response.data.message;
    }

    // Network error
    if (error?.code === 'ECONNREFUSED' || error?.message?.includes('Network Error')) {
        return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
    }

    // Timeout
    if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
        return 'La solicitud tardó demasiado. Intenta nuevamente.';
    }

    // HTTP status codes
    if (error?.response?.status) {
        const statusMessages: Record<number, string> = {
            400: 'Datos inválidos. Revisa la información ingresada.',
            401: 'Sesión expirada. Por favor inicia sesión nuevamente.',
            403: 'No tienes permisos para realizar esta acción.',
            404: 'El recurso solicitado no fue encontrado.',
            409: 'Ya existe un registro con estos datos.',
            422: 'Los datos proporcionados no son válidos.',
            429: 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.',
            500: 'Error interno del servidor. Intenta más tarde.',
            502: 'El servidor no está disponible temporalmente.',
            503: 'Servicio no disponible. Intenta más tarde.'
        };
        return statusMessages[error.response.status] || `Error del servidor (${error.response.status})`;
    }

    // Generic message
    if (error?.message) {
        return error.message;
    }

    return 'Ocurrió un error inesperado. Intenta nuevamente.';
};

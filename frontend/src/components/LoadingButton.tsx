"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface LoadingButtonProps {
    onClick?: () => void;
    type?: 'button' | 'submit';
    isLoading?: boolean;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: LucideIcon;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    children: React.ReactNode;
    className?: string;
}

/**
 * Button component with loading state and consistent styling
 */
export default function LoadingButton({
    onClick,
    type = 'button',
    isLoading = false,
    disabled = false,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    fullWidth = false,
    children,
    className = ''
}: LoadingButtonProps) {
    const variantStyles = {
        primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/20',
        secondary: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/20',
        success: 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/20',
        ghost: 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'
    };

    const sizeStyles = {
        sm: 'px-4 py-2 text-xs',
        md: 'px-6 py-3 text-sm',
        lg: 'px-8 py-4 text-base'
    };

    const iconSizes = {
        sm: 14,
        md: 16,
        lg: 20
    };

    const isDisabled = disabled || isLoading;

    return (
        <motion.button
            type={type}
            onClick={onClick}
            disabled={isDisabled}
            whileTap={!isDisabled ? { scale: 0.98 } : undefined}
            className={`
                ${variantStyles[variant]}
                ${sizeStyles[size]}
                ${fullWidth ? 'w-full' : ''}
                rounded-2xl font-bold uppercase tracking-widest
                transition-all duration-200
                flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${className}
            `}
        >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
                <>
                    {Icon && iconPosition === 'left' && <Icon size={iconSizes[size]} />}
                    {children}
                    {Icon && iconPosition === 'right' && <Icon size={iconSizes[size]} />}
                </>
            )}
        </motion.button>
    );
}

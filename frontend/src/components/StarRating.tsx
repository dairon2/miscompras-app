"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

interface StarRatingProps {
    value: number;
    onChange?: (value: number) => void;
    readonly?: boolean;
    size?: "sm" | "md" | "lg";
    label?: string;
    showValue?: boolean;
}

const sizes = {
    sm: 16,
    md: 24,
    lg: 32
};

export default function StarRating({
    value,
    onChange,
    readonly = false,
    size = "md",
    label,
    showValue = false
}: StarRatingProps) {
    const [hoverValue, setHoverValue] = useState(0);
    const starSize = sizes[size];

    const handleClick = (rating: number) => {
        if (!readonly && onChange) {
            onChange(rating);
        }
    };

    const displayValue = hoverValue || value;

    return (
        <div className="flex flex-col gap-1">
            {label && (
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {label}
                </label>
            )}
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <motion.button
                        key={star}
                        type="button"
                        whileHover={!readonly ? { scale: 1.2 } : undefined}
                        whileTap={!readonly ? { scale: 0.9 } : undefined}
                        onClick={() => handleClick(star)}
                        onMouseEnter={() => !readonly && setHoverValue(star)}
                        onMouseLeave={() => !readonly && setHoverValue(0)}
                        disabled={readonly}
                        className={`transition-colors ${readonly ? "cursor-default" : "cursor-pointer"
                            }`}
                    >
                        <Star
                            size={starSize}
                            className={`transition-all ${star <= displayValue
                                    ? "fill-amber-400 text-amber-400"
                                    : "fill-transparent text-gray-300 dark:text-gray-600"
                                }`}
                        />
                    </motion.button>
                ))}
                {showValue && value > 0 && (
                    <span className="ml-2 text-sm font-bold text-gray-600 dark:text-gray-300">
                        {value.toFixed(1)}
                    </span>
                )}
            </div>
        </div>
    );
}

// Componente para mostrar promedio con estrellas pequeñas
export function StarRatingDisplay({ value, count }: { value: number; count?: number }) {
    const roundedValue = Math.round(value * 10) / 10;

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                        key={star}
                        size={14}
                        className={`${star <= Math.round(value)
                                ? "fill-amber-400 text-amber-400"
                                : star - 0.5 <= value
                                    ? "fill-amber-200 text-amber-400"
                                    : "fill-transparent text-gray-300 dark:text-gray-600"
                            }`}
                    />
                ))}
            </div>
            <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                {roundedValue > 0 ? roundedValue.toFixed(1) : "Sin evaluar"}
            </span>
            {count !== undefined && count > 0 && (
                <span className="text-xs text-gray-400">({count})</span>
            )}
        </div>
    );
}

"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronDown } from 'lucide-react';

interface YearSelectorProps {
    selectedYear: number;
    availableYears: number[];
    onChange: (year: number) => void;
}

export default function YearSelector({ selectedYear, availableYears, onChange }: YearSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-6 bg-slate-950 border-2 border-white rounded-[2rem] px-8 py-4 shadow-2xl hover:scale-105 transition-all group"
            >
                <span className="text-3xl font-black text-white tracking-tighter">
                    {selectedYear}
                </span>
                <Calendar className="text-blue-500 group-hover:scale-110 transition-transform" size={28} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl z-[100]"
                    >
                        {availableYears.map((year) => (
                            <button
                                key={year}
                                onClick={() => {
                                    onChange(year);
                                    setIsOpen(false);
                                }}
                                className={`w-full px-8 py-4 text-2xl font-black text-left transition-colors ${year === selectedYear
                                        ? 'bg-slate-600 text-white'
                                        : 'text-white hover:bg-slate-800'
                                    }`}
                            >
                                {year}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

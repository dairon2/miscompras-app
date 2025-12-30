"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange?: (itemsPerPage: number) => void;
    showItemsPerPage?: boolean;
    itemsPerPageOptions?: number[];
}

export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
    onItemsPerPageChange,
    showItemsPerPage = true,
    itemsPerPageOptions = [10, 25, 50, 100]
}: PaginationProps) {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const getPageNumbers = () => {
        const pages: (number | 'ellipsis')[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);

            if (currentPage > 3) pages.push('ellipsis');

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) pages.push(i);

            if (currentPage < totalPages - 2) pages.push('ellipsis');

            pages.push(totalPages);
        }

        return pages;
    };

    if (totalPages <= 1 && !showItemsPerPage) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-6 bg-gray-50 dark:bg-slate-900/50 border-t border-gray-100 dark:border-gray-700">
            {/* Items info */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
                Mostrando <span className="font-bold text-gray-700 dark:text-gray-200">{startItem}</span> a{' '}
                <span className="font-bold text-gray-700 dark:text-gray-200">{endItem}</span> de{' '}
                <span className="font-bold text-gray-700 dark:text-gray-200">{totalItems}</span> registros
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                {/* Items per page selector */}
                {showItemsPerPage && onItemsPerPageChange && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Por página:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 ring-primary-500 outline-none"
                        >
                            {itemsPerPageOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Page navigation */}
                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => onPageChange(1)}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Primera página"
                        >
                            <ChevronsLeft size={18} />
                        </button>
                        <button
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Página anterior"
                        >
                            <ChevronLeft size={18} />
                        </button>

                        {getPageNumbers().map((page, index) => (
                            page === 'ellipsis' ? (
                                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">...</span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => onPageChange(page)}
                                    className={`min-w-[36px] h-9 rounded-xl font-bold text-sm transition-all ${currentPage === page
                                            ? 'bg-primary-600 text-white shadow-lg'
                                            : 'hover:bg-gray-200 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {page}
                                </button>
                            )
                        ))}

                        <button
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Página siguiente"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            onClick={() => onPageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Última página"
                        >
                            <ChevronsRight size={18} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

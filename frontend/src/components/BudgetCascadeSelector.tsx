'use client';

import { useState, useEffect, useMemo } from 'react';
import { Building, FolderOpen, FileText } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface Project {
    id: string;
    name: string;
}

interface Category {
    id: string;
    name: string;
    code: string;
}

interface Budget {
    id: string;
    title: string;
    code: string;
    amount: string;
    available: number;
    projectId: string;
    areaId: string;
    categoryId?: string;
    category?: { id: string; name: string; code: string };
    project?: { id: string; name: string };
    area?: { id: string; name: string };
}

interface BudgetCascadeSelectorProps {
    budgets: Budget[];
    projects: Project[];
    selectedBudgetId: string;
    onBudgetSelect: (budgetId: string, projectId: string, areaId: string) => void;
    disabled?: boolean;
    showAreaInfo?: boolean;
}

/**
 * Componente de selección en cascada para presupuestos
 * Flujo: Proyecto → Categoría → Presupuesto (Título)
 * El área se determina automáticamente del presupuesto seleccionado
 */
export default function BudgetCascadeSelector({
    budgets,
    projects,
    selectedBudgetId,
    onBudgetSelect,
    disabled = false,
    showAreaInfo = true
}: BudgetCascadeSelectorProps) {
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');

    // Initialize from selectedBudgetId if provided
    useEffect(() => {
        if (selectedBudgetId && budgets.length > 0) {
            const budget = budgets.find(b => b.id === selectedBudgetId);
            if (budget) {
                setSelectedProjectId(budget.projectId);
                setSelectedCategoryId(budget.categoryId || budget.category?.id || '');
            }
        }
    }, [selectedBudgetId, budgets]);

    // Get unique categories for selected project
    const availableCategories = useMemo(() => {
        if (!selectedProjectId) return [];

        const projectBudgets = budgets.filter(b => b.projectId === selectedProjectId);
        const categoryMap = new Map<string, Category>();

        projectBudgets.forEach(b => {
            if (b.category) {
                categoryMap.set(b.category.id, b.category);
            }
        });

        return Array.from(categoryMap.values());
    }, [budgets, selectedProjectId]);

    // Get budgets filtered by project and category
    const filteredBudgets = useMemo(() => {
        if (!selectedProjectId) return [];

        return budgets.filter(b => {
            const matchesProject = b.projectId === selectedProjectId;
            const matchesCategory = !selectedCategoryId ||
                b.categoryId === selectedCategoryId ||
                b.category?.id === selectedCategoryId;
            const hasAvailableFunds = b.available > 0;

            return matchesProject && matchesCategory && hasAvailableFunds;
        });
    }, [budgets, selectedProjectId, selectedCategoryId]);

    // Get current area name from selected budget
    const selectedBudget = budgets.find(b => b.id === selectedBudgetId);
    const areaName = selectedBudget?.area?.name || '';

    const handleProjectChange = (projectId: string) => {
        setSelectedProjectId(projectId);
        setSelectedCategoryId('');
        onBudgetSelect('', projectId, '');
    };

    const handleCategoryChange = (categoryId: string) => {
        setSelectedCategoryId(categoryId);
        onBudgetSelect('', selectedProjectId, '');
    };

    const handleBudgetChange = (budgetId: string) => {
        const budget = budgets.find(b => b.id === budgetId);
        if (budget) {
            onBudgetSelect(budgetId, budget.projectId, budget.areaId);
        }
    };

    const selectClass = "w-full bg-gray-50 dark:bg-slate-900 border-none rounded-2xl py-4 px-6 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-bold appearance-none";
    const labelClass = "block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1";

    return (
        <div className="space-y-4">
            {/* Step 1: Project Selection */}
            <div>
                <label className={labelClass}>
                    <FolderOpen size={10} className="inline mr-1" />
                    1. Proyecto
                </label>
                <div className="relative">
                    <SearchableSelect
                        value={selectedProjectId}
                        onChange={(val) => handleProjectChange(val)}
                        options={[
                            { value: "", label: "Selecciona un proyecto..." },
                            ...projects.map(p => ({ value: p.id, label: p.name }))
                        ]}
                        disabled={disabled}
                    />
                </div>
            </div>

            {/* Step 2: Category Selection */}
            {selectedProjectId && (
                <div>
                    <label className={labelClass}>
                        <FileText size={10} className="inline mr-1" />
                        2. Categoría / Rubro
                    </label>
                    <div className="relative">
                        <SearchableSelect
                            value={selectedCategoryId}
                            onChange={(val) => handleCategoryChange(val)}
                            options={[
                                { value: "", label: "Todas las categorías" },
                                ...availableCategories.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))
                            ]}
                            disabled={disabled || availableCategories.length === 0}
                        />
                    </div>
                    {availableCategories.length === 0 && (
                        <p className="text-xs text-amber-500 mt-1 ml-1">No hay categorías con presupuesto disponible</p>
                    )}
                </div>
            )}

            {/* Step 3: Budget/Title Selection */}
            {selectedProjectId && (
                <div>
                    <label className={labelClass}>
                        <Building size={10} className="inline mr-1" />
                        3. Actividad
                    </label>
                    <div className="relative">
                        <SearchableSelect
                            value={selectedBudgetId}
                            onChange={(val) => handleBudgetChange(val)}
                            options={[
                                { value: "", label: "Selecciona presupuesto..." },
                                ...filteredBudgets.map(b => ({
                                    value: b.id,
                                    label: `${b.title} - $${b.available.toLocaleString()} disponible`
                                }))
                            ]}
                            disabled={disabled || filteredBudgets.length === 0}
                        />
                    </div>
                    {filteredBudgets.length === 0 && selectedProjectId && (
                        <p className="text-xs text-amber-500 mt-1 ml-1">No hay presupuestos disponibles para esta selección</p>
                    )}
                </div>
            )}

            {/* Area Info (read-only, auto-filled) */}
            {showAreaInfo && selectedBudgetId && areaName && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                            <Building size={16} className="text-green-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-green-600 tracking-widest">Área Asignada (automático)</p>
                            <p className="font-bold text-sm text-green-800 dark:text-green-200">{areaName}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useMemo } from 'react';
import { FolderOpen, FileText, Banknote } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface Project {
    id: string;
    name: string;
}

interface Budget {
    id: string;
    title: string;
    code?: string;
    amount: number | string;
    available: number;
    projectId?: string;
    areaId?: string;
    categoryId?: string;
    category?: { id: string; name: string; code: string };
    project?: { id: string; name: string };
    area?: { id: string; name: string };
}

interface SourceBudgetCascadeProps {
    budgets: Budget[];
    projects: Project[];
    excludeBudgetId: string;
    selectedBudgetId: string;
    onBudgetSelect: (budgetId: string) => void;
}

/**
 * Compact cascading budget selector for source budget selection in adjustments.
 * Flow: Project → Category/Rubro → Activity/Budget
 */
export default function SourceBudgetCascade({
    budgets,
    projects,
    excludeBudgetId,
    selectedBudgetId,
    onBudgetSelect,
}: SourceBudgetCascadeProps) {
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');

    // Filter out destination budget and only show budgets with available > 0
    const availableBudgets = useMemo(() => {
        return budgets.filter(b => b.id !== excludeBudgetId && Number(b.available) > 0);
    }, [budgets, excludeBudgetId]);

    // Derive projects that actually have available budgets
    const availableProjects = useMemo(() => {
        const projectIds = new Set(availableBudgets.map(b => b.projectId || b.project?.id).filter(Boolean));
        return projects.filter(p => projectIds.has(p.id));
    }, [projects, availableBudgets]);

    // Get unique categories for selected project
    const availableCategories = useMemo(() => {
        if (!selectedProjectId) return [];
        const projectBudgets = availableBudgets.filter(b => (b.projectId || b.project?.id) === selectedProjectId);
        const categoryMap = new Map<string, { id: string; name: string; code: string }>();
        projectBudgets.forEach(b => {
            if (b.category) {
                categoryMap.set(b.category.id, b.category);
            }
        });
        return Array.from(categoryMap.values());
    }, [availableBudgets, selectedProjectId]);

    // Get budgets filtered by project and category
    const filteredBudgets = useMemo(() => {
        if (!selectedProjectId) return [];
        return availableBudgets.filter(b => {
            const pId = b.projectId || b.project?.id;
            const cId = b.categoryId || b.category?.id;
            const matchesProject = pId === selectedProjectId;
            const matchesCategory = !selectedCategoryId || cId === selectedCategoryId;
            return matchesProject && matchesCategory;
        });
    }, [availableBudgets, selectedProjectId, selectedCategoryId]);

    const formatCurrency = (val: number | string) => {
        const num = Number(val);
        if (isNaN(num)) return '$0';
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(num);
    };

    const handleProjectChange = (projectId: string) => {
        setSelectedProjectId(projectId);
        setSelectedCategoryId('');
        onBudgetSelect('');
    };

    const handleCategoryChange = (categoryId: string) => {
        setSelectedCategoryId(categoryId);
        onBudgetSelect('');
    };

    const handleBudgetChange = (budgetId: string) => {
        onBudgetSelect(budgetId);
    };

    const labelClass = "block text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1 ml-0.5";

    return (
        <div className="space-y-2.5">
            {/* Step 1: Project */}
            <div>
                <label className={labelClass}>
                    <FolderOpen size={9} className="inline mr-1" />
                    Proyecto
                </label>
                <SearchableSelect
                    value={selectedProjectId}
                    onChange={handleProjectChange}
                    options={[
                        { value: "", label: "Seleccionar proyecto..." },
                        ...availableProjects.map(p => ({ value: p.id, label: p.name }))
                    ]}
                    placeholder="Seleccionar proyecto..."
                />
            </div>

            {/* Step 2: Category */}
            {selectedProjectId && (
                <div>
                    <label className={labelClass}>
                        <FileText size={9} className="inline mr-1" />
                        Categoría / Rubro
                    </label>
                    <SearchableSelect
                        value={selectedCategoryId}
                        onChange={handleCategoryChange}
                        options={[
                            { value: "", label: "Todas las categorías" },
                            ...availableCategories.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))
                        ]}
                        disabled={availableCategories.length === 0}
                        placeholder="Todas las categorías"
                    />
                    {availableCategories.length === 0 && (
                        <p className="text-[9px] text-amber-500 mt-0.5 ml-0.5">Sin categorías con saldo</p>
                    )}
                </div>
            )}

            {/* Step 3: Budget / Activity */}
            {selectedProjectId && (
                <div>
                    <label className={labelClass}>
                        <Banknote size={9} className="inline mr-1" />
                        Actividad
                    </label>
                    <SearchableSelect
                        value={selectedBudgetId}
                        onChange={handleBudgetChange}
                        options={[
                            { value: "", label: "Seleccionar presupuesto..." },
                            ...filteredBudgets.map(b => ({
                                value: b.id,
                                label: `${b.title} (Disp: ${formatCurrency(b.available)})`
                            }))
                        ]}
                        disabled={filteredBudgets.length === 0}
                        placeholder="Seleccionar presupuesto..."
                    />
                    {filteredBudgets.length === 0 && selectedProjectId && (
                        <p className="text-[9px] text-amber-500 mt-0.5 ml-0.5">Sin presupuestos disponibles</p>
                    )}
                </div>
            )}
        </div>
    );
}

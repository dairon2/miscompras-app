import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Requirements filter state
interface RequirementsFilters {
    searchTerm: string;
    status: string;
    procurementStatus: string;
    areaId: string;
    createdById: string;
    projectId: string;
    reqCategory: string;
    startDate: string;
    endDate: string;
    sortOrder: 'asc' | 'desc';
    selectedYear: number;
}

// Suppliers filter state
interface SuppliersFilters {
    searchTerm: string;
    typeFilter: 'ALL' | 'SUPPLIER' | 'SERVICE_PROVIDER';
}

// Users filter state
interface UsersFilters {
    searchTerm: string;
    role: string;
    areaId: string;
    isActive: string;
}

// Asientos filter state
interface AsientosFilters {
    searchTerm: string;
    selectedSupplier: string;
    selectedProject: string;
    selectedCategory: string;
    sortOrder: 'asc' | 'desc';
    selectedYear: number;
}

// Budget filter state
interface BudgetFilters {
    searchTerm: string;
    projectId: string;
    categoryId: string;
    areaId: string;
    status: string;
    selectedYear: number;
}

interface FilterState {
    requirements: RequirementsFilters;
    suppliers: SuppliersFilters;
    users: UsersFilters;
    asientos: AsientosFilters;
    budget: BudgetFilters;

    // Setters
    setRequirementsFilter: (filters: Partial<RequirementsFilters>) => void;
    setSuppliersFilter: (filters: Partial<SuppliersFilters>) => void;
    setUsersFilter: (filters: Partial<UsersFilters>) => void;
    setAsientosFilter: (filters: Partial<AsientosFilters>) => void;
    setBudgetFilter: (filters: Partial<BudgetFilters>) => void;

    // Clear functions
    clearRequirementsFilters: () => void;
    clearSuppliersFilters: () => void;
    clearUsersFilters: () => void;
    clearAsientosFilters: () => void;
    clearBudgetFilters: () => void;
}

const currentYear = new Date().getFullYear();

const defaultRequirementsFilters: RequirementsFilters = {
    searchTerm: '',
    status: '',
    procurementStatus: '',
    areaId: '',
    createdById: '',
    projectId: '',
    reqCategory: '',
    startDate: '',
    endDate: '',
    sortOrder: 'desc',
    selectedYear: currentYear,
};

const defaultSuppliersFilters: SuppliersFilters = {
    searchTerm: '',
    typeFilter: 'ALL',
};

const defaultUsersFilters: UsersFilters = {
    searchTerm: '',
    role: '',
    areaId: '',
    isActive: '',
};

const defaultAsientosFilters: AsientosFilters = {
    searchTerm: '',
    selectedSupplier: '',
    selectedProject: '',
    selectedCategory: '',
    sortOrder: 'desc',
    selectedYear: currentYear,
};

const defaultBudgetFilters: BudgetFilters = {
    searchTerm: '',
    projectId: '',
    categoryId: '',
    areaId: '',
    status: '',
    selectedYear: currentYear,
};

export const useFilterStore = create<FilterState>()(
    persist(
        (set) => ({
            requirements: defaultRequirementsFilters,
            suppliers: defaultSuppliersFilters,
            users: defaultUsersFilters,
            asientos: defaultAsientosFilters,
            budget: defaultBudgetFilters,

            setRequirementsFilter: (filters) =>
                set((state) => ({
                    requirements: { ...state.requirements, ...filters },
                })),

            setSuppliersFilter: (filters) =>
                set((state) => ({
                    suppliers: { ...state.suppliers, ...filters },
                })),

            setUsersFilter: (filters) =>
                set((state) => ({
                    users: { ...state.users, ...filters },
                })),

            setAsientosFilter: (filters) =>
                set((state) => ({
                    asientos: { ...state.asientos, ...filters },
                })),

            setBudgetFilter: (filters) =>
                set((state) => ({
                    budget: { ...state.budget, ...filters },
                })),

            clearRequirementsFilters: () =>
                set({ requirements: defaultRequirementsFilters }),

            clearSuppliersFilters: () =>
                set({ suppliers: defaultSuppliersFilters }),

            clearUsersFilters: () =>
                set({ users: defaultUsersFilters }),

            clearAsientosFilters: () =>
                set({ asientos: defaultAsientosFilters }),

            clearBudgetFilters: () =>
                set({ budget: defaultBudgetFilters }),
        }),
        {
            name: 'miscompras-filters',
        }
    )
);

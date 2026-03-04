"use client";

import React from 'react';
import Select, { Props as SelectProps } from 'react-select';

export interface Option {
    label: string;
    value: string | number;
}

interface SearchableSelectProps extends Omit<SelectProps<Option, false>, 'options' | 'value' | 'onChange'> {
    options: Option[];
    value: string | number;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

export default function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = 'Seleccionar...',
    className = '',
    disabled = false,
    ...props
}: SearchableSelectProps) {

    // Convert all values to string for controlled matching
    const stringValue = value !== null && value !== undefined ? String(value) : '';
    const selectedOption = options.find((opt) => String(opt.value) === stringValue) || null;

    return (
        <Select
            value={selectedOption}
            onChange={(selected) => onChange(selected ? String(selected.value) : '')}
            options={options}
            isDisabled={disabled}
            placeholder={placeholder}
            isClearable={false}
            isSearchable={true}
            className={className}
            classNames={{
                control: (state) =>
                    `bg-gray-50 dark:bg-slate-900 border ${state.isFocused
                        ? 'border-primary-500 ring-2 ring-primary-500'
                        : 'border-gray-100 dark:border-gray-700'
                    } p-1.5 rounded-2xl font-bold outline-none transition-all cursor-pointer ${state.isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`,
                menu: () =>
                    'bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 mt-2 overflow-hidden z-[9999]',
                menuList: () => 'p-1 custom-scrollbar max-h-60',
                option: (state) =>
                    `p-3 mx-1 my-0.5 font-medium rounded-lg cursor-pointer transition-colors ${state.isSelected
                        ? 'bg-primary-500 text-white'
                        : state.isFocused
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                    }`,
                singleValue: () => 'text-gray-900 dark:text-white font-bold',
                placeholder: () => 'text-gray-400 font-medium',
                input: () => 'text-gray-900 dark:text-white',
                indicatorSeparator: () => 'hidden',
                dropdownIndicator: (state) => `text-gray-400 ${state.isFocused ? 'text-primary-500' : ''} hover:text-primary-600 transition-colors cursor-pointer p-1`
            }}
            styles={{
                control: (base) => ({
                    ...base,
                    border: 0,
                    boxShadow: 'none',
                    backgroundColor: 'transparent',
                    minHeight: '44px',
                }),
                menu: (base) => ({
                    ...base,
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                    border: 'none',
                }),
                menuPortal: base => ({ ...base, zIndex: 9999 })
            }}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            {...props}
        />
    );
}

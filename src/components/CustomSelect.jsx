import { useState, useRef, useEffect } from 'react';
import './CustomSelect.css';

export default function CustomSelect({ 
    value, 
    onChange, 
    options = [], 
    placeholder = 'Selecciona una opción',
    className = '',
    disabled = false,
    required = false
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const selectRef = useRef(null);
    const dropdownRef = useRef(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const selectedElement = dropdownRef.current.querySelector('.custom-select-option.selected');
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [isOpen]);

    const handleSelect = (option) => {
        onChange(option.value);
        setIsOpen(false);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (disabled) return;

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (isOpen && highlightedIndex >= 0) {
                    handleSelect(options[highlightedIndex]);
                } else {
                    setIsOpen(!isOpen);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                } else {
                    setHighlightedIndex(prev => 
                        prev < options.length - 1 ? prev + 1 : prev
                    );
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (isOpen) {
                    setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlightedIndex(-1);
                break;
            default:
                break;
        }
    };

    return (
        <div 
            ref={selectRef}
            className={`custom-select-wrapper ${className} ${disabled ? 'disabled' : ''} ${isOpen ? 'open' : ''}`}
        >
            <div
                className="custom-select-trigger"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                tabIndex={disabled ? -1 : 0}
                role="combobox"
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                aria-required={required}
            >
                <span className={`custom-select-value ${!selectedOption ? 'placeholder' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className={`custom-select-arrow ${isOpen ? 'open' : ''}`}>
                    ▼
                </span>
            </div>
            
            {isOpen && (
                <div 
                    ref={dropdownRef}
                    className="custom-select-dropdown"
                    role="listbox"
                >
                    {options.length === 0 ? (
                        <div className="custom-select-option no-options">
                            No hay opciones disponibles
                        </div>
                    ) : (
                        options.map((option, index) => (
                            <div
                                key={option.value}
                                className={`custom-select-option ${
                                    option.value === value ? 'selected' : ''
                                } ${
                                    index === highlightedIndex ? 'highlighted' : ''
                                }`}
                                onClick={() => handleSelect(option)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                role="option"
                                aria-selected={option.value === value}
                            >
                                {option.label}
                                {option.value === value && (
                                    <span className="option-check">✓</span>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}


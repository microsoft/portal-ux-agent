import React from 'react';
import type { ComboboxProps } from '../specs.js';

export const Combobox: React.FC<ComboboxProps> = ({
  label,
  value,
  placeholder,
  disabled = false,
  options = [],
}) => {
  const listId = React.useId();
  return (
    <div className="form-field combobox-field">
      {label ? <label className="form-label">{label}</label> : null}
      <input
        list={listId}
        defaultValue={value === undefined ? undefined : String(value)}
        placeholder={placeholder}
        className="form-control"
        disabled={disabled}
      />
      <datalist id={listId}>
        {options.map((option, index) => (
          <option key={index} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </datalist>
    </div>
  );
};

export default Combobox;

import React from 'react';
import type { SelectProps } from '../specs.js';

function normalizeValue(value: SelectProps['value']): string | string[] | undefined {
  if (Array.isArray(value)) {
    return value.map(v => String(v));
  }
  return value === undefined ? undefined : String(value);
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  placeholder,
  disabled = false,
  multiple = false,
  options = [],
}) => {
  const normalizedValue = normalizeValue(value);
  return (
    <div className="form-field">
      {label ? <label className="form-label">{label}</label> : null}
      <select
        multiple={multiple}
        defaultValue={normalizedValue as any}
        className="form-control"
        disabled={disabled}
      >
        {!multiple && placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option, index) => (
          <option key={index} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;

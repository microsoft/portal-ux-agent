import React from 'react';
import type { RadioGroupProps } from '../specs.js';

export const RadioGroup: React.FC<RadioGroupProps> = ({
  label,
  value,
  options = [],
  disabled = false,
}) => {
  const groupName = React.useId();
  const selectedValue = value === undefined ? undefined : String(value);
  return (
    <fieldset className="form-field form-radio-group" disabled={disabled as any}>
      {label ? <legend className="form-label">{label}</legend> : null}
      {options.map((option, index) => {
        const optionValue = String(option.value);
        return (
          <label key={index} className="radio-option">
            <input
              type="radio"
              name={groupName}
              value={optionValue}
              defaultChecked={selectedValue === optionValue}
              disabled={disabled}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
};

export default RadioGroup;

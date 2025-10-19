import React from 'react';
import type { InputProps } from '../specs.js';

export const Input: React.FC<InputProps> = ({
  label,
  type = 'text',
  value,
  placeholder,
  disabled = false,
}) => (
  <div className="form-field">
    {label ? <label className="form-label">{label}</label> : null}
    <input
      type={type}
      defaultValue={value === undefined ? undefined : String(value)}
      placeholder={placeholder}
      className="form-control"
      disabled={disabled}
    />
  </div>
);

export default Input;

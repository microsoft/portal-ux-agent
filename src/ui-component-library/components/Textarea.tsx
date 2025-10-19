import React from 'react';
import type { TextareaProps } from '../specs.js';

export const Textarea: React.FC<TextareaProps> = ({
  label,
  value,
  placeholder,
  rows = 4,
  disabled = false,
}) => (
  <div className="form-field">
    {label ? <label className="form-label">{label}</label> : null}
    <textarea
      defaultValue={value}
      placeholder={placeholder}
      rows={rows}
      className="form-control"
      disabled={disabled}
    />
  </div>
);

export default Textarea;

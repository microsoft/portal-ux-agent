import React from 'react';
import type { CheckboxProps } from '../specs.js';

export const Checkbox: React.FC<CheckboxProps> = ({ label, checked = false, disabled = false }) => (
  <label className="form-field form-checkbox">
    <input type="checkbox" defaultChecked={checked} disabled={disabled} />
    <span>{label}</span>
  </label>
);

export default Checkbox;

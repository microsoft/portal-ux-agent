import React from 'react';
import type { SwitchProps } from '../specs.js';

export const Switch: React.FC<SwitchProps> = ({ label, checked = false, disabled = false }) => (
  <label className="form-field form-switch">
    {label ? <span className="switch-label">{label}</span> : null}
    <input type="checkbox" role="switch" defaultChecked={checked} disabled={disabled} />
  </label>
);

export default Switch;

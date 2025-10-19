import React from 'react';
import type { AlertProps } from '../specs.js';

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  description,
}) => (
  <div className={`alert alert-${variant}`} role="alert">
    {title ? <h4 className="alert-title">{title}</h4> : null}
    {description ? <p className="alert-description">{description}</p> : null}
  </div>
);

export default Alert;

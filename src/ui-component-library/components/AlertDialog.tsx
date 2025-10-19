import React from 'react';
import type { AlertDialogProps } from '../specs.js';

export const AlertDialog: React.FC<AlertDialogProps> = ({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}) => (
  <div className="alert-dialog" role="dialog" aria-modal="true">
    <div className="alert-dialog-content">
      <h3 className="alert-dialog-title">{title}</h3>
      {description ? <p className="alert-dialog-description">{description}</p> : null}
      <div className="alert-dialog-actions">
        <button type="button" className="alert-dialog-cancel">
          {cancelLabel}
        </button>
        <button type="button" className="alert-dialog-confirm">
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default AlertDialog;

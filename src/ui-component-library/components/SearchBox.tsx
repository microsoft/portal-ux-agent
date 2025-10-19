import React from 'react';
import type { SearchBoxProps } from '../specs.js';

export const SearchBox: React.FC<SearchBoxProps> = ({
  label,
  value,
  placeholder,
  disabled = false,
}) => (
  <div className="form-field search-box">
    {label ? <label className="form-label">{label}</label> : null}
    <div className="search-box-wrapper">
      <input
        type="search"
        defaultValue={value}
        placeholder={placeholder}
        className="form-control"
        disabled={disabled}
      />
      <button type="button" disabled={disabled} className="search-box-button">
        Search
      </button>
    </div>
  </div>
);

export default SearchBox;

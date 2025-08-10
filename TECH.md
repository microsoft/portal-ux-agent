# Technical Design

This document describes the architecture, interfaces, and contracts for the Portal UX Agent.

## 1) Runtime and Frameworks

- This UX Agent runs as a NodeJS server

## 2) High-Level Architecture

- It exposed 2 different end points,
    - 1 set of end points  to take MCP request from user
        Implement as a stand MCP server. The message only pass through the standard message variable.
    - 1 set of end points to server the UI rendering
        - Provide an endpoint for browser to view the UI


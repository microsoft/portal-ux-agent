
# Portal UX Agent — Product Requirements Document (PRD)

The Portal UX Agent turns structured or unstructed input and intent into a fully rendered, web-based portal experience. Provide the data and desired outcome (optional); the agent selects a layout template, composes UI components, and serves a shareable UI.

## User Interaction

### MCP Interface 

This UX Agent take user input from MCP user message

## UI/UX Support

### UI Component Inventory

- Include component Inventory from multiple UI framework, i.e.,
    - shadcn/ui
    - fluent ui
    - Radix UI
    - ...

- Each UI components include,
    - Definition of the parameters needed to build this UI element, each element in 1 json file,
        - i.e., fields may includes,
            - Type: 'Chart'
            - UI_Library: 'shadcn/ui'
            - Title: ''
            - Data: ''
    - JS/HTML/CSS code that implmented how to render this UI element
        - Do the best to leverage the existing UI framework


### UX Template Definition

- Define a list of popular layout, on how to organize the UI elements, i.e.,
    - Left Navigation Portal (portal.leftnav)
        A popular Enterprise portal experience, with a Navigation bar on the left, and detailed page on the right side
    - Dashboard Cards Grid (dashboard.cards-grid)
        Slots: header, kpiRow, cardsGrid
        Use for overview pages with KPIs and charts; grid guidance helps with scanability and responsiveness.
    - Kanban Board (board.kanban)
        Slots: boardToolbar, columns, card
        Use for workflow visualization with drag-and-drop. 

### UX Interactions

- Action buttons, etc. 

## Agentic UI capabilities

### User Input to UX Component matching,

Use Chain-of-thought, 
- First based on user's input, try to match the best template, and potential UI elements
- Then load the detailed definition of the templates, and UI element, translate the user input into the new UI, fill the data into the UI design
- Then render the design on the UI



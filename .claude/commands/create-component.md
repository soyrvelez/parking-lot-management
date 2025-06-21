# Create React Component

Create a new React component with proper TypeScript types and styling: $ARGUMENTS

## Component Types:
1. **ui** - Basic UI component (button, input, card)
2. **feature** - Feature-specific component
3. **page** - Full page component
4. **layout** - Layout wrapper component

## Steps:
1. Create component file with TypeScript interface
2. Implement component with proper props typing
3. Add Shadcn/ui styling and Tailwind classes
4. Create accompanying test file
5. Add Spanish localization if needed
6. Export from appropriate index file
7. Generate Storybook story if applicable

## Arguments:
- Component name (PascalCase)
- Component type (ui|feature|page|layout)
- Optional: description

## Usage: /project:create-component TicketScanner feature "Component for scanning ticket barcodes"
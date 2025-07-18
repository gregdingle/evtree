# GitHub Copilot Instructions for EVTree

## Project Overview

EVTree is a decision tree creation application built with Next.js 15, React 19, and TypeScript. The application helps users create, visualize, and interact with decision trees.

## Technology Stack

- **Framework**: Next.js 15.4.1 with App Router
- **React**: 19.1.0 (with React Compiler enabled)
- **TypeScript**: ^5
- **Styling**: Tailwind CSS v4
- **Build Tool**: Turbopack (for development)
- **Linting**: ESLint 9 with Next.js configurations

## Code Style and Conventions

### TypeScript

- Use strict TypeScript with proper type definitions
- Use interface for public, extensible object shapes. Use type for everything else.
- Use proper generics and avoid `any`
- Export interfaces alongside components when needed
- Prefix all console messages with `[EVTree]`

### React Components

- Use functional components with hooks
- Use React 19 features and patterns
- Take advantage of React Compiler optimizations (no manual memoization needed)
- Use proper JSX syntax and accessibility attributes
- Put unexported helper components at the bottom of the file they are in

### Next.js Patterns

- Use App Router patterns (`app/` directory)
- Implement proper metadata for SEO
- Use Next.js Image component for optimizations
- Follow Next.js file-based routing conventions
- Use Server Components by default, Client Components when needed

### File Structure

- Components in logical directories under `src/`
- Use descriptive file names in kebab-case
- Group related functionality together
- Keep components focused and single-purpose
- Place shared hooks in `src/hooks/` directory
- Use `use-` prefix for custom hook files (e.g., `use-tree-state.ts`)

### Styling

- Use Tailwind CSS classes
- Prefer utility-first approach
- Use semantic class names when needed
- Implement responsive design patterns
- Follow modern CSS practices
- Always implement dark mode support using Tailwind's `dark:` variant classes
- Respect user's system preference for light/dark mode
- When generating CSS classes for a new React component, generate only CSS classes that affect layout: margin, padding, flexbox, grid, etc.

## Domain-Specific Context

<!-- TODO: add and refine Domain-specific content -->

### Decision Trees

- Nodes represent decision points or outcomes
- Branches represent choices or conditions
- Trees should be traversable and interactive
- Consider visualization and user experience
- Think about data structures for tree representation
- Use React Flow framework for the interactive canvas that renders the decision tree
- Leverage React Flow's built-in features for node manipulation, connections, and canvas interactions

### UI/UX Principles

- Make decision trees intuitive to create and navigate
- Provide clear visual hierarchy
- Implement drag-and-drop functionality where appropriate
- Ensure accessibility for tree navigation
- Consider mobile-responsive tree layouts

## Code Quality

- Write clean, readable code with meaningful variable names
- Add JSDoc comments for complex functions where the type information is not sufficient
- Implement proper error handling
- Use React error boundaries where appropriate
- Write testable code with clear separation of concerns

## Performance Considerations

- Leverage React Compiler for automatic optimizations
- Use Next.js built-in optimizations (Image, Font, etc.)
- Consider lazy loading for large tree structures
- Implement proper loading states and error boundaries
- Optimize for Core Web Vitals

## Accessibility

- Use semantic HTML elements
- Implement proper ARIA labels and roles
- Ensure keyboard navigation works for tree structures
- Provide screen reader support for decision trees
- Test with accessibility tools

## Development Preferences

- Prioritize code readability and maintainability
- Use modern JavaScript/TypeScript features appropriately
- Implement proper state management patterns
- Follow React best practices and hooks patterns
- Write self-documenting code when possible

### State Management

- Use Zustand store in `src/hooks/use-store.ts` for global shared state in React client-side components
- Prefer Zustand over Context API for state that needs to be shared across many components
- Use local component state (useState) for component-specific state that doesn't need to be shared

## Project-Specific Guidelines

<!-- TODO: refine and add to these guidelines -->

- When working with tree data structures, consider performance for large trees
- Implement proper state management for tree modifications
- Consider undo/redo functionality for tree editing
- Think about export/import capabilities for decision trees
- Plan for real-time collaboration features if needed

## Dependencies Management

- Prefer using built-in Next.js and React features over external libraries
- Prefer using es-toolkit for utility functions
- Prefer using dayjs for date functions
- When adding new dependencies, consider bundle size impact
- Use TypeScript-first libraries when available
- Keep dependencies up to date and secure

## Testing Approach

<!-- TODO: add and refine testing approach
    consider storybook for component testing
    consider playwright or cypress for e2e testing
 -->

- Write unit tests for utility functions, domain logic, and any pure functions
  <!-- - Test React components with proper user interaction scenarios -->
  <!-- - Consider integration tests for tree manipulation features -->
- Test accessibility features thoroughly
<!-- - Implement visual regression testing for tree layouts -->

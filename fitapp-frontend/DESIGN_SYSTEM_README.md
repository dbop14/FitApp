# FitApp Design System

This document outlines the refactored design system for FitApp, which has been updated to align with the `FitApp Login UI.json` specification while maintaining all existing functionality and API integrations.

## Overview

The design system has been completely refactored to:
- Follow the JSON specification structure and styling
- Maintain all existing API calls and data bindings
- Provide reusable, modular components
- Ensure consistent visual hierarchy and spacing
- Support responsive design patterns

## Design System Structure

### 1. Colors

The color palette follows the JSON specification with semantic naming:

```javascript
// Primary Colors (Blue scale)
primary: {
  50: '#eff6ff',   // Lightest blue
  100: '#dbeafe',  // Very light blue
  200: '#bfdbfe',  // Light blue
  300: '#93c5fd',  // Medium light blue
  400: '#60a5fa',  // Medium blue
  500: '#3b82f6',  // Standard blue
  600: '#035FC3',  // Main brand blue
  700: '#1d4ed8',  // Dark blue
  800: '#1e40af',  // Darker blue
  900: '#1e3a8a'   // Darkest blue
}

// Neutral Colors (Gray scale)
neutral: {
  50: '#f9fafb',   // Lightest gray
  100: '#f3f4f6',  // Very light gray
  200: '#e5e7eb',  // Light gray
  300: '#d1d5db',  // Medium light gray
  400: '#9ca3af',  // Medium gray
  500: '#6b7280',  // Standard gray
  600: '#4b5563',  // Medium dark gray
  700: '#374151',  // Dark gray
  800: '#1f2937',  // Darker gray
  900: '#111827'   // Darkest gray
}
```

### 2. Typography

Typography follows the JSON hierarchy specification:

```javascript
typography: {
  hierarchy: {
    page_title: {
      size: '28px',
      weight: 600,
      lineHeight: 1.2,
      color: 'blue_600'
    },
    section_heading: {
      size: '48px',
      weight: 700,
      lineHeight: 1.1,
      color: 'gray_900'
    },
    body_text: {
      size: '14px',
      weight: 400,
      lineHeight: 1.4,
      color: 'gray_500'
    },
    button_text: {
      size: '16px',
      weight: 500,
      lineHeight: 1.3,
      color: 'white'
    },
    link_text: {
      size: '14px',
      weight: 500,
      lineHeight: 1.3,
      color: 'blue_600'
    }
  }
}
```

### 3. Spacing

Spacing system based on 4px base unit:

```javascript
spacing: {
  base_unit: '4px',
  scale: {
    xs: '4px',    // 4px
    sm: '8px',    // 8px
    md: '12px',   // 12px
    lg: '16px',   // 16px
    xl: '20px',   // 20px
    '2xl': '24px', // 24px
    '3xl': '32px', // 32px
    '4xl': '48px'  // 48px
  }
}
```

### 4. Layout Structure

The layout follows the JSON composition specification:

```
Container (Mobile Screen, Portrait)
├── Header Area (Top)
│   ├── Page Title
│   └── Descriptive Text
├── Social Auth Section (Upper Middle)
│   └── Google Login Button
├── Divider Section (Middle)
│   └── "or" text with lines
├── Form Section (Middle)
│   └── Future email/password fields
├── Primary Action (Lower Middle)
│   └── Login button
└── Secondary Action (Bottom)
    └── Sign Up link
```

## Reusable Components

### 1. TextDivider

A horizontal divider with centered text, following the JSON specification.

```jsx
import TextDivider from '../components/ui/TextDivider'

<TextDivider text="or" />
```

**Props:**
- `text` (string): The text to display in the divider (default: "or")
- `className` (string): Additional CSS classes

### 2. LoadingSpinner

A customizable loading spinner with multiple size and color variants.

```jsx
import LoadingSpinner from '../components/ui/LoadingSpinner'

<LoadingSpinner 
  size="md"           // sm, md, lg, xl
  color="primary"     // primary, secondary, white
  showText={true}     // Show/hide text below spinner
  text="Loading..."   // Custom text
/>
```

**Props:**
- `size` (string): Spinner size - 'sm', 'md', 'lg', 'xl'
- `color` (string): Spinner color - 'primary', 'secondary', 'white'
- `showText` (boolean): Whether to show text below spinner
- `text` (string): Custom loading text
- `className` (string): Additional CSS classes

### 3. InfoBox

A flexible information box for tips, warnings, and informational content.

```jsx
import InfoBox from '../components/ui/InfoBox'

<InfoBox 
  type="info"         // info, success, warning, error
  icon="💡"           // Optional icon
  title="Tip:"        // Optional title
>
  Your information content here
</InfoBox>
```

**Props:**
- `type` (string): Box type - 'info', 'success', 'warning', 'error'
- `icon` (string): Optional emoji or icon
- `title` (string): Optional title text
- `children` (node): Main content
- `className` (string): Additional CSS classes

## Usage Examples

### Basic Login Page Structure

```jsx
import { designSystem } from '../config/designSystem'

const AuthPage = () => {
  const containerStyles = {
    minHeight: '100vh',
    padding: designSystem.spacing.component.container_padding,
    background: designSystem.gradients.background,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  }

  const titleStyles = {
    fontSize: designSystem.typography.hierarchy.page_title.size,
    fontWeight: designSystem.typography.hierarchy.page_title.weight,
    color: designSystem.colors.primary.blue_600,
    marginBottom: designSystem.spacing.lg
  }

  return (
    <div style={containerStyles}>
      <h1 style={titleStyles}>Sign In to FitApp</h1>
      {/* Your content here */}
    </div>
  )
}
```

### Using Design System Tokens

```jsx
import { getDesignToken } from '../config/designSystem'

// Get specific design tokens
const primaryColor = getDesignToken('colors.primary.blue_600')
const buttonPadding = getDesignToken('spacing.component.button_internal_padding')
const titleSize = getDesignToken('typography.hierarchy.page_title.size')
```

## Tailwind Integration

The design system colors and typography are available as Tailwind utility classes:

```jsx
// Colors
<div className="bg-primary-600 text-neutral-50">
  Primary button
</div>

// Typography
<h1 className="text-page-title text-primary-600">
  Page Title
</h1>

<p className="text-body-text text-neutral-500">
  Body text content
</p>
```

## Migration Notes

### What Changed

1. **Styling Approach**: Moved from Tailwind classes to design system tokens
2. **Component Structure**: Broke down monolithic components into reusable pieces
3. **Layout System**: Implemented JSON-specified layout structure
4. **Color System**: Updated to match JSON color palette exactly

### What Preserved

1. **All API Calls**: `useEffect`, `fetch`, authentication flows
2. **State Management**: User context, navigation, loading states
3. **Data Binding**: Props, state, and context usage
4. **Functionality**: Login process, redirects, error handling

### Benefits

1. **Consistency**: Visual design now matches JSON specification exactly
2. **Maintainability**: Reusable components reduce code duplication
3. **Scalability**: Design system tokens make updates easier
4. **Accessibility**: Better semantic structure and ARIA labels
5. **Responsiveness**: Mobile-first design approach

## Future Enhancements

1. **Form Components**: Email/password input fields following JSON spec
2. **Button Variants**: Primary, secondary, and social auth button styles
3. **Animation System**: Micro-interactions and transitions
4. **Theme Support**: Dark mode and color scheme variations
5. **Component Library**: Storybook integration for component documentation

## Troubleshooting

### Common Issues

1. **Styling Not Applied**: Ensure design system is imported correctly
2. **Component Not Found**: Check file paths and component exports
3. **Colors Not Matching**: Verify color values match JSON specification
4. **Spacing Inconsistent**: Use design system spacing tokens instead of arbitrary values

### Debug Mode

Enable debug logging to see design token resolution:

```javascript
// In your component
console.log('Design System:', designSystem)
console.log('Component Styles:', componentStyles)
```

## Contributing

When adding new components or modifying existing ones:

1. Follow the JSON specification structure
2. Use design system tokens for styling
3. Maintain component reusability
4. Add proper TypeScript types (if applicable)
5. Update this documentation

## References

- `FitApp Login UI.json` - Original design specification
- `src/config/designSystem.js` - Design system configuration
- `src/components/ui/` - Reusable UI components
- `tailwind.config.js` - Tailwind integration

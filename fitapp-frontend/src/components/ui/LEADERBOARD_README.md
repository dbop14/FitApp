# Leaderboard Design System Components

This directory contains the refactored leaderboard components that align with the `leaderboard_design_system (1).json` specification.

## Components

### `LeaderboardHeader.jsx`
- **Purpose**: Fixed header with challenge title, info button, and status indicators
- **Design System Alignment**: Follows `components.header` specifications
- **Features**:
  - Sticky positioning with proper z-index
  - Info button with accessibility support
  - Dynamic status text (refreshing, auto-syncing, rate limited)
  - Manual sync button with loading states and animations
  - Responsive layout with proper spacing
  - CSS classes for maintainability

### `Podium.jsx`
- **Purpose**: Top 3 competitors display in elevated circular layout
- **Design System Alignment**: Follows `components.podium` specifications
- **Features**:
  - Circular avatars with rank-based border colors
  - Crown indicators for top 3 positions
  - Rank overlays on avatars
  - Medal emojis for visual enhancement
  - Current user highlighting
  - Responsive sizing (96px for 1st, 80px for others)
  - CSS classes for maintainability

### `LeaderboardList.jsx`
- **Purpose**: Scrollable list starting from rank 4
- **Design System Alignment**: Follows `components.leaderboardList` specifications
- **Features**:
  - Horizontal card layout with rank, avatar, name, and points
  - Current user highlighting with blue accent
  - Hover effects and transitions
  - Accessibility support (keyboard navigation, ARIA labels)
  - CSS classes for maintainability

### `LeaderboardStyles.css`
- **Purpose**: Centralized styling for all leaderboard components
- **Design System Alignment**: Implements all color, spacing, typography, and layout tokens
- **Features**:
  - CSS custom properties for design tokens
  - Responsive design with media queries
  - Accessibility improvements (focus states, reduced motion)
  - High contrast mode support
  - Print styles

## Design System Integration

### Colors
- **Primary**: Blue palette (blue_50 to blue_900) from design system
- **Neutral**: Gray scale (gray_50 to gray_900) for backgrounds and text
- **Accent**: Green, yellow, and orange for status indicators and rankings

### Typography
- **Scale**: xs (12px) to 4xl (36px) with proper font weights
- **Font Family**: System UI stack for optimal performance
- **Line Heights**: Optimized for readability

### Spacing
- **Base Unit**: 4px
- **Scale**: xs (4px) to 4xl (48px) with responsive variants
- **Responsive**: Mobile-first with proper breakpoints

### Layout
- **Container**: Full-screen mobile container with proper padding
- **Header**: Fixed 56px height with sticky positioning
- **Podium**: Centered flex layout with proper spacing
- **List**: Scrollable container with consistent item heights

## Responsive Design

### Mobile (< 768px)
- Container padding: `lg` (16px)
- Podium avatar sizes: 80px for 1st, 70px for others
- Podium spacing: `xl` (20px)

### Tablet (768px - 1024px)
- Container max-width: 640px with centered margin
- Podium avatar sizes: 96px for 1st, 80px for others
- Podium spacing: `2xl` (24px)

## Accessibility Features

### WCAG Compliance
- **Contrast**: AA compliant color ratios
- **Focus**: 2px solid blue_600 outline with 2px offset
- **Touch Targets**: Minimum 44px for all interactive elements

### Semantic Structure
- **Landmarks**: Proper header and main content regions
- **Lists**: Semantic `<ol>` for leaderboard rankings
- **ARIA**: Labels for screen readers and assistive technologies

### Motion Support
- **Reduced Motion**: Respects `prefers-reduced-motion` settings
- **Animations**: Smooth transitions with fallbacks

## Implementation Guidelines

### CSS Architecture
- **BEM-like Naming**: Clear component hierarchy
- **Custom Properties**: Centralized design tokens
- **Modular Structure**: Separate concerns for each component

### Component Props
- **Data Flow**: Consistent participant data structure
- **Event Handling**: Standardized callback patterns
- **State Management**: Proper loading and error states

### Performance
- **Image Optimization**: Fallback handling for avatars
- **Lazy Loading**: Efficient rendering of large lists
- **Memory Management**: Proper cleanup of intervals and event listeners

## Data Structure

### Participant Object
```javascript
{
  id: "string",           // Unique identifier
  name: "string",         // Display name
  avatar: "string",       // Avatar URL or null
  totalPoints: "number",  // Total accumulated points
  stepGoalPoints: "number", // Points from step goals
  lastStepCount: "number",  // Most recent step count
  lastStepDate: "string",   // ISO date string
  startWeight: "number",    // Starting weight in lbs
  currentWeight: "number",  // Current weight in lbs
  isCurrentUser: "boolean"  // Whether this is the current user
}
```

### API Integration
- **Endpoints**: `/api/challenge/{id}/leaderboard`
- **Data Flow**: Fetch → Transform → Sort → Display
- **Error Handling**: Graceful fallbacks with user feedback
- **Auto-refresh**: 5-minute intervals with manual override

## Future Enhancements

### Planned Features
- **Theme Switching**: Light/dark mode support
- **Animations**: Staggered list item animations
- **Search/Filter**: Participant search functionality
- **Detailed Views**: Expanded participant information
- **Export**: Leaderboard data export options

### Technical Improvements
- **Virtual Scrolling**: For very large participant lists
- **Caching**: Improved data persistence
- **Real-time Updates**: WebSocket integration
- **Offline Support**: Service worker implementation

## Migration Notes

### From Previous Implementation
- **Inline Styles**: Replaced with CSS classes
- **Component Structure**: Modularized into focused components
- **Design System**: Centralized configuration and tokens
- **Accessibility**: Enhanced ARIA support and keyboard navigation

### Breaking Changes
- **CSS Classes**: New class naming convention
- **Component Props**: Simplified data structure
- **Styling**: Moved from inline to external CSS
- **Dependencies**: Added leaderboard design system config

## Troubleshooting

### Common Issues
1. **Styling Not Applied**: Ensure CSS file is imported
2. **Avatar Fallbacks**: Check image URLs and error handling
3. **Responsive Issues**: Verify media query breakpoints
4. **Accessibility**: Test with screen readers and keyboard navigation

### Debug Tools
- **Console Logs**: Comprehensive logging for data flow
- **CSS Inspector**: Verify class application and inheritance
- **Network Tab**: Check API calls and responses
- **Accessibility Audits**: Lighthouse and axe-core integration

# Dashboard Design System Components

This directory contains the refactored dashboard components that align with the `FitApp Dashboard UI.json` design system specification.

## Components

### `DashboardHeader.jsx`
- **Purpose**: Header section with challenge title, info button, and status indicators
- **Design System Alignment**: Follows `components.header` specifications
- **Features**:
  - Info button with accessibility support
  - Dynamic status text (refreshing, auto-syncing, rate limited)
  - Manual sync button with loading states
  - Responsive layout with proper spacing

### `ParticipantCard.jsx`
- **Purpose**: Individual participant card displaying fitness metrics
- **Design System Alignment**: Follows `components.activityCard` specifications
- **Features**:
  - Avatar image with fallback handling
  - Rank and name display
  - Step goal progress with visual bar
  - Weight loss percentage calculation
  - Points display
  - Current user highlighting
  - Accessibility support (keyboard navigation, ARIA labels)

### `DashboardStates.jsx`
- **Purpose**: Loading and error state management
- **Design System Alignment**: Uses typography and spacing tokens
- **Features**:
  - Loading state with descriptive text
  - Error state with fallback information
  - Consistent styling with design system

## Design System Integration

### Colors
- **Primary**: Blue palette (blue_50 to blue_900)
- **Neutral**: Gray scale (gray_50 to gray_900)
- **Accent**: Purple, teal, and orange for status indicators

### Typography
- **Hierarchy**: H1 (24px), H2 (20px), H3 (18px), Body (16px), Caption (14px), Small (12px)
- **Font Family**: System UI stack for optimal performance
- **Line Heights**: Optimized for readability (1.2 to 1.5)

### Spacing
- **Base Unit**: 4px
- **Scale**: xs (4px), sm (8px), md (16px), lg (24px), xl (32px), xxl (48px)
- **Responsive**: Mobile-first with clamp() functions for fluid scaling

### Layout
- **Container**: Fixed width (320px-430px) for mobile optimization
- **Cards**: Vertical stack with consistent gaps
- **Responsive**: Adapts to different screen sizes using CSS clamp()

### Accessibility
- **Touch Targets**: Minimum 44px for mobile interaction
- **Focus Indicators**: 2px solid blue_600 outline
- **Contrast Ratio**: 4.5:1 minimum for text readability
- **ARIA Labels**: Descriptive labels for screen readers

## Usage

```jsx
import DashboardHeader from './ui/DashboardHeader'
import ParticipantCard from './ui/ParticipantCard'
import DashboardStates from './ui/DashboardStates'

// In your component
<DashboardHeader
  challenge={challenge}
  onInfoClick={handleInfoClick}
  postLoginRefreshing={postLoginRefreshing}
  autoRefreshing={autoRefreshing}
  rateLimited={rateLimited}
  onRefresh={handleRefresh}
  loading={loading}
/>

<DashboardStates loading={loading} error={error} />

{participants.map((participant, index) => (
  <ParticipantCard
    key={participant.id}
    participant={participant}
    rank={index}
    stepGoal={challenge.stepGoal}
    isCurrentUser={participant.isCurrentUser}
    onCardTap={handleCardTap}
  />
))}
```

## Styling Approach

### CSS-in-JS
- Uses inline styles with design system tokens
- Responsive values with CSS clamp() functions
- Dynamic styling based on component state

### CSS Classes
- Complementary styles in `DashboardStyles.css`
- Focus states, hover effects, and animations
- Media queries for responsive behavior
- Accessibility and print styles

## Responsive Design

### Breakpoints
- **Small**: 320px - 360px (compact layout)
- **Medium**: 360px - 430px (standard layout)
- **Large**: 430px+ (expanded layout)

### Fluid Scaling
- Text sizes: `clamp(12px, 3.5vw, 16px)`
- Spacing: `clamp(12px, 3vw, 20px)`
- Images: `clamp(60px, 15vw, 80px)`

## Performance Considerations

- **Minimal Re-renders**: Components only update when necessary
- **Efficient Styling**: CSS-in-JS with memoized style objects
- **Image Optimization**: Lazy loading and fallback handling
- **Accessibility**: Proper ARIA labels and keyboard navigation

## Future Enhancements

- **Theme Support**: Dark mode and custom color schemes
- **Animation Library**: Framer Motion integration for micro-interactions
- **Component Variants**: Different card styles for various content types
- **Internationalization**: Multi-language support for labels and text

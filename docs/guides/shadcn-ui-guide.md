---
GUIDE USAGE: When designing or implementing Shadcn-based UI
---

# @title ShadCN UI Guide
# @description ShadCN UI guide, plus additional UI components that extend ShadCN UI functionality
# @category guides
# @created 2025-06-20T17:52:33+10:00
# @last_modified 2025-06-20T17:52:33+10:00

*IMPORTANT NOTE:**
The 'shadcn-ui' package is deprecated. Please use the 'shadcn' package instead.
Example:
- old: npx shadcn-ui@latest add input
- new: npx shadcn@latest add input

## Documentation
- [Official Documentation](https://ui.shadcn.com/docs)
- [Code Examples](https://ui.shadcn.com/docs/registry/examples)

## Implementation Notes
- Use Shadcn UI for React components
- Follow component documentation for implementation details
- Refer to examples for common use cases and patterns
- Ensure components are properly imported and styled according to project standards

## Available ShadCN Extension Components

### Form Components
- `AutosizeTextarea`: Auto-resizing textarea
- `FloatingLabelInput`: Input with floating labels
- `MultipleSelector`: Enhanced multi-select component
- `DualRangeSlider`: Range selection with two handles
- `DateTimePicker`: Date and time picker component

### Feedback Components
- `LoadingButton`: Button with loading state
- `Spinner`: Customisable loading spinner
- `ProgressWithValue`: Progress indicator with value display
- `RateLimit`: Rate limiting feedback component
- `ResponsiveModal`: Adaptive modal dialog

### Navigation
- `MagicBackButton`: Smart back button with history
- `InfiniteScroll`: Infinite scrolling container
- `HeadingWithAnchor`: Headings with anchor links
- `Steppers`: Multi-step progress indicator

## Key Features

### MultipleSelector
- Search and filter options
- Grouped items
- Async data loading
- Customisable display
- Form integration
- Keyboard navigation
- Max selection limits

### DateTimePicker
- Date and time selection
- Timezone support
- Custom date formats
- Range selection
- Disabled dates
- Min/max date constraints

### ResponsiveModal
- Adapts to screen size
- Custom transitions
- Keyboard navigation
- Focus management
- Scroll locking
- Nested modals support

## Implementation

### Installation
```bash
# Clone the repository
git clone https://github.com/hsuanyi-chou/shadcn-ui-expansions.git

# Install dependencies
npm install

# Run development server
npm run dev
```

### Usage Example
```tsx
import { MultipleSelector } from '@/components/ui/multiple-selector';

const OPTIONS = [
  { label: 'Next.js', value: 'nextjs' },
  { label: 'React', value: 'react' },
  { label: 'TypeScript', value: 'typescript' },
];

function Component() {
  const [value, setValue] = useState([]);
  
  return (
    <MultipleSelector
      value={value}
      onChange={setValue}
      defaultOptions={OPTIONS}
      placeholder="Select technologies..."
    />
  );
}
```

## Best Practices

### Performance
- Use `React.memo` for complex components
- Implement virtualization for long lists
- Debounce search inputs
- Lazy load non-critical components

### Accessibility
- Ensure proper ARIA attributes
- Support keyboard navigation
- Provide text alternatives
- Test with screen readers

### Styling
- Follow ShadCN theming
- Use CSS variables for colors
- Support dark/light mode
- Maintain consistent spacing

## Customisation

### Theming
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(222.2 47.4% 11.2%)',
          foreground: 'hsl(210 40% 98%)',
        },
      },
    },
  },
};
```

### Component Variants
```tsx
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

## Troubleshooting

### Common Issues
1. **Styling Not Applied**
   - Check Tailwind CSS setup
   - Verify PostCSS configuration
   - Ensure proper class purging

2. **Type Errors**
   - Update TypeScript to latest version
   - Check component prop types
   - Verify type imports

3. **Performance Problems**
   - Implement code splitting
   - Use React.memo for expensive renders
   - Optimise re-renders

## Resources

- [ShadCN UI Documentation](https://ui.shadcn.com/)
- [Radix UI Primitives](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Aria](https://react-spectrum.adobe.com/react-aria/)

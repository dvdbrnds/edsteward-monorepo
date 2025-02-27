# Component Documentation Template

## Component Name

### Purpose
Brief description of what the component does and when to use it.

### Props Interface
```typescript
interface ComponentProps {
  /** Description of prop1 */
  prop1: string;
  /** Description of prop2 */
  prop2: number;
  /** Description of optional prop */
  optionalProp?: boolean;
}
```

### Usage Example
```tsx
import { ComponentName } from '@/components/ComponentName';

function ExampleUsage() {
  return (
    <ComponentName
      prop1="example"
      prop2={42}
      optionalProp={true}
    />
  );
}
```

### State Management
Describe any internal state management, context usage, or external state dependencies.

### Side Effects
Document any side effects, API calls, or interactions with other components.

### Accessibility
- ARIA roles
- Keyboard navigation
- Screen reader considerations

### Testing
Document test coverage and special testing considerations.

### Related Components
List any related or dependent components.

### Changelog
Document version history and significant changes.

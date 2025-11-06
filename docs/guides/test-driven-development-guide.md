---
GUIDE USAGE: Use whenever implementing unit tests or other testing processes, as well as during project planning phases.
---

# @title Test-Driven Development (TDD) Guide
# @description Comprehensive guide for implementing Test-Driven Development in JavaScript/TypeScript projects
# @category guides
# @created 2025-06-20T18:10:33+10:00
# @last_modified 2025-06-20T18:10:33+10:00

## Core Principles

### Red-Green-Refactor Cycle
1. **Red**: Write a failing test
2. **Green**: Write minimal code to pass the test
3. **Refactor**: Improve code while keeping tests passing

### Key Rules
- Write tests before implementation code
- Run tests frequently
- Keep tests small and focused
- Never modify tests to make them pass
- Maintain test independence

## Testing Tools

### JavaScript/TypeScript
- **Framework**: Jest
- **React Testing**: React Testing Library
- **Assertions**: Built-in Jest assertions
- **Coverage**: Built-in coverage reports

### Installation
```bash
# Using npm
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Using yarn
yarn add --dev jest @testing-library/react @testing-library/jest-dom
```

## Writing Tests

### Test Structure
```javascript
describe('ComponentOrFunctionName', () => {
  beforeEach(() => {
    // Setup code
  });

  afterEach(() => {
    // Cleanup code
  });

  it('should do something specific', () => {
    // Test implementation
  });
});
```

### React Component Test Example
```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await userEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Utility Function Test Example
```javascript
import { sum } from './math';

describe('sum', () => {
  it('adds two numbers correctly', () => {
    expect(sum(1, 2)).toBe(3);
    expect(sum(-1, 1)).toBe(0);
    expect(sum(0, 0)).toBe(0);
  });

  it('handles decimal numbers', () => {
    expect(sum(0.1, 0.2)).toBeCloseTo(0.3);
  });
});
```

## TDD Workflow

### 1. Write a Failing Test
```javascript
// math.test.js
describe('multiply', () => {
  it('multiplies two numbers', () => {
    expect(multiply(2, 3)).toBe(6);
  });
});
```

### 2. Implement Minimal Code to Pass
```javascript
// math.js
export function multiply(a, b) {
  return 0; // Initial implementation
}
```

### 3. Run Tests (Should Fail)
```bash
npm test
```

### 4. Implement Correctly
```javascript
// math.js
export function multiply(a, b) {
  return a * b;
}
```

### 5. Refactor (If Needed)
```javascript
// math.js
export const multiply = (a, b) => a * b;
```

## Best Practices

### Test Structure
- One assertion per test case
- Clear, descriptive test names
- Group related tests with `describe`
- Use `beforeEach`/`afterEach` for setup/teardown

### Test Quality
- Test behavior, not implementation
- Avoid testing third-party libraries
- Keep tests independent and isolated
- Use meaningful test data

### Performance
- Mock external dependencies
- Use `jest.mock()` for complex modules
- Avoid unnecessary renders in component tests

## Common Patterns

### Mocking
```javascript
// Mocking a module
jest.mock('../api', () => ({
  fetchData: jest.fn().mockResolvedValue({ data: 'mocked data' })
}));

// In test
import { fetchData } from '../api';

describe('fetchData', () => {
  it('returns mocked data', async () => {
    const result = await fetchData();
    expect(result).toEqual({ data: 'mocked data' });
  });
});
```

### Testing Async Code
```javascript
describe('fetchUser', () => {
  it('fetches user data', async () => {
    const user = { id: 1, name: 'John' };
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve(user)
    });

    const result = await fetchUser(1);
    expect(result).toEqual(user);
    expect(fetch).toHaveBeenCalledWith('/api/users/1');
  });
});
```

### Testing React Hooks
```jsx
import { renderHook, act } from '@testing-library/react-hooks';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('increments counter', () => {
    const { result } = renderHook(() => useCounter());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```

## Common Pitfalls

### What Not to Test
- Third-party library functionality
- Implementation details
- Private methods
- Framework features

### Anti-patterns
- Testing implementation instead of behavior
- Over-mocking
- Brittle tests (overly specific assertions)
- Slow-running tests

## Running Tests

### Basic Commands
```bash
# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test path/to/test-file.test.js
```

### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom', // For React testing
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // For path aliases
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
};
```

## Resources
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library Cheatsheet](https://testing-library.com/docs/dom-testing-library/cheatsheet/)
- [React Testing Examples](https://react-testing-examples.com/)

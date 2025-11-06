## Testing Strategy

**PRIMARY TEST USER**: allan@formationmedia.net / *.Password123

### Test-Driven Development (TDD)
1. **Write the test first** - Define expected behavior before implementation
2. **Watch it fail** - Ensure the test actually tests something
3. **Write minimal code** - Just enough to make the test pass
4. **Refactor** - Improve code while keeping tests green
5. **Repeat** - One test at a time

### Testing

- **Unit Tests**: Individual functions and components
- **Integration Tests**: Component interactions and API integration
- **Coverage Target**: 80%+ with focus on critical 3D rendering paths
- **Test Commands**: `npm run test`, `npm run test:watch`, `npm run test:coverage`
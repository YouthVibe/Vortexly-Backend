# Contributing to YouthVibes Backend

Thank you for your interest in contributing to the YouthVibes backend! This document provides guidelines and instructions to help you contribute effectively.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [API Development Guidelines](#api-development-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md) to ensure a positive environment for everyone.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/youthvibes.git
   cd youthvibes/backend
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up environment variables**:
   - Copy `.env.example` to `.env`
   - Adjust values as needed for your local setup
5. **Create a branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-you-are-fixing
   ```

## Development Workflow

1. **Make your changes** in your feature branch
2. **Run tests** to ensure your changes don't break existing functionality
   ```bash
   npm test
   ```
3. **Lint your code** to ensure it meets our style guidelines
   ```bash
   npm run lint
   ```
4. **Commit your changes** following the commit conventions (see below)
5. **Push to your fork** and submit a pull request

## Coding Standards

- **Follow existing patterns** in the codebase
- **Use ESLint** to ensure code style compliance
- **Write meaningful comments** for complex logic
- **Use async/await** instead of callbacks where possible
- **Error handling** should be consistent and thorough
- **Validate input** for all API endpoints

### File Structure

```
controllers/
  - methodName.js     # Export individual handler functions
models/
  - ModelName.js      # Define schema and export model
routes/
  - routeName.js      # Define routes and connect to controllers
middleware/
  - middlewareName.js # Export middleware functions
utils/
  - utilityName.js    # Export utility functions
```

### Naming Conventions

- **Files**: Use camelCase for files (e.g., `userController.js`)
- **Routes**: Use kebab-case for URL paths (e.g., `/api/user-profile`)
- **Functions**: Use camelCase for function names (e.g., `getUserProfile`)
- **Variables**: Use camelCase for variable names (e.g., `userData`)
- **Constants**: Use UPPER_SNAKE_CASE for constants (e.g., `MAX_UPLOAD_SIZE`)
- **Models**: Use PascalCase for model names (e.g., `UserModel`)

### Code Style

```javascript
// Controller example
const getUserProfile = async (req, res, next) => {
  try {
    // Input validation
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    // Business logic
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Response
    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};
```

## Pull Request Process

1. **Ensure all tests pass** before submitting
2. **Update documentation** for any changed functionality
3. **Follow the PR template** when creating a pull request
4. **Link related issues** in your PR description
5. **Be responsive** to feedback and review comments

### Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc)
- `refactor`: Code changes that neither fix bugs nor add features
- `perf`: Performance improvements
- `test`: Adding or fixing tests
- `chore`: Changes to the build process, tools, etc

Examples:
- `feat(auth): add email verification flow`
- `fix(messages): resolve socket connection issue`
- `docs(api): update user endpoints documentation`

## API Development Guidelines

1. **RESTful principles**:
   - Use appropriate HTTP methods (GET, POST, PUT, DELETE)
   - Use resource-based URLs
   - Return appropriate status codes

2. **Response format**:
   ```json
   {
     "success": true,
     "data": {},
     "message": "Optional message"
   }
   ```
   Or for errors:
   ```json
   {
     "success": false,
     "error": "Error message",
     "stack": "Only in development"
   }
   ```

3. **API versioning**:
   - Include version in URL path: `/api/v1/resource`

4. **Validation**:
   - Always validate request inputs
   - Use middleware for common validations
   - Return clear validation error messages

5. **Authentication**:
   - Use the auth middleware for protected routes
   - Validate token expiration
   - Check appropriate permissions

## Testing Guidelines

1. **Write tests** for all new functionality
2. **Update tests** when modifying existing functionality
3. **Test categories**:
   - Unit tests for utilities and isolated functions
   - Integration tests for API endpoints
   - Socket tests for real-time functionality

Example test:

```javascript
describe('User Controller', () => {
  describe('GET /api/users/:id', () => {
    it('should return user data when valid ID provided', async () => {
      // Test implementation
    });
    
    it('should return 404 when user not found', async () => {
      // Test implementation
    });
    
    it('should return 400 when invalid ID format provided', async () => {
      // Test implementation
    });
  });
});
```

## Documentation

- **Document all API endpoints** in the README.md or dedicated API docs
- **Add JSDoc comments** to functions and classes
- **Keep the documentation up-to-date** with code changes
- **Document environment variables** and their purposes

### API Documentation Format

```markdown
### Get User Profile

**Endpoint:** GET /api/users/:id

**Authentication:** Required

**Parameters:**
- `id` (path parameter): User ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "123",
    "username": "example",
    "email": "user@example.com",
    "profile": {
      "bio": "User bio",
      "avatar": "https://..."
    }
  }
}
```

**Error Responses:**
- 404: User not found
- 400: Invalid user ID
- 401: Unauthorized
```

## Security Considerations

- **Never commit secrets** to the repository
- **Always sanitize user inputs** to prevent injection attacks
- **Use parameterized queries** for database operations
- **Set appropriate CORS policies**
- **Implement rate limiting** for public endpoints
- **Follow OWASP security guidelines**
- **Use HTTPS** in all environments

## Thank You

Thank you for contributing to YouthVibes! Your efforts help make this project better for everyone. 
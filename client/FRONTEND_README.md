# CourseFlix Frontend

A responsive course review and scheduling platform for Vanderbilt University students built with React, TypeScript, and Vite.

## Features

- **Course Browsing**: Search and filter courses by days, times, categories, and departments
- **Course Details**: View detailed course information including reviews, grade distribution, and comments
- **Schedule Management**: Visual calendar view of enrolled courses with cart functionality
- **Feedback Submission**: Multi-step form for submitting course reviews and ratings
- **Authentication**: Login page with OAuth support (Google, GitHub) and email/password

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **CSS Modules** - Component-scoped styling

## Project Structure

```
client/
├── src/
│   ├── pages/              # Page components
│   │   ├── CoursesPage.tsx         # Course listing with filters
│   │   ├── CourseDetailPage.tsx    # Individual course details
│   │   ├── SchedulePage.tsx        # User schedule calendar
│   │   ├── FeedbackPage.tsx        # Feedback submission form
│   │   └── LoginPage.tsx           # Authentication page
│   ├── components/         # Reusable components
│   │   └── Navbar.tsx              # Navigation header
│   ├── styles/             # CSS files
│   │   ├── Navbar.css
│   │   ├── CoursesPage.css
│   │   ├── CourseDetailPage.css
│   │   ├── SchedulePage.css
│   │   ├── FeedbackPage.css
│   │   └── LoginPage.css
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx             # Main app with routing
│   ├── main.tsx            # App entry point
│   └── index.css           # Global styles
├── public/                 # Static assets
└── package.json
```

## Getting Started

### Installation

```bash
cd client
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Connecting to Backend

All components include detailed comments on how to integrate with the backend API. Here's a summary:

### API Endpoints Needed

#### Authentication
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/signup` - User registration
- `GET /api/auth/google` - Google OAuth redirect
- `GET /api/auth/github` - GitHub OAuth redirect

#### Courses
- `GET /api/courses` - Get all courses (with query params for filtering)
- `GET /api/courses/:id` - Get course details
- `GET /api/courses/:id/reviews` - Get course reviews
- `GET /api/courses/:id/grades` - Get grade distribution
- `GET /api/courses/:id/comments` - Get course comments
- `GET /api/courses/search?query={searchTerm}` - Search courses

#### User Schedule
- `GET /api/users/:userId/enrolled` - Get enrolled courses
- `GET /api/users/:userId/cart` - Get cart courses
- `POST /api/users/:userId/enroll` - Enroll in course
- `DELETE /api/users/:userId/enrolled/:courseId` - Remove from enrolled
- `DELETE /api/users/:userId/cart/:courseId` - Remove from cart
- `POST /api/cart` - Add course to cart

#### Reviews/Feedback
- `POST /api/reviews` - Submit course review
- `POST /api/reviews/:reviewId/like` - Like a review
- `POST /api/courses/:courseId/syllabus` - Upload syllabus (file upload)

### Integration Steps

1. **Set up API base URL**
   Create a config file for API endpoints:
   ```typescript
   // src/config/api.ts
   export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
   ```

2. **Create API utility functions**
   ```typescript
   // src/utils/api.ts
   export async function fetchCourses(filters?: any) {
     const response = await fetch(`${API_BASE_URL}/api/courses?${new URLSearchParams(filters)}`);
     return response.json();
   }
   ```

3. **Replace mock data**
   - In `CoursesPage.tsx`: Replace `mockCourses` with API call
   - In `CourseDetailPage.tsx`: Replace `course` and `mockReviews` with API calls
   - In `SchedulePage.tsx`: Replace `enrolledCourses` and `cartCourses` with API calls
   - In `FeedbackPage.tsx`: Implement `handleSubmit()` to POST to API

4. **Add authentication context**
   ```typescript
   // src/contexts/AuthContext.tsx
   export const AuthContext = createContext<AuthContextType | null>(null);

   export function AuthProvider({ children }) {
     const [user, setUser] = useState(null);
     // Implement auth logic
     return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
   }
   ```

5. **Implement protected routes**
   Wrap routes that require authentication in `App.tsx`:
   ```typescript
   <Route
     path="/schedule"
     element={isAuthenticated ? <SchedulePage /> : <Navigate to="/login" />}
   />
   ```

### Environment Variables

Create a `.env` file in the client directory:

```env
VITE_API_URL=http://localhost:3000
```

## Design System

### Colors
- Primary Gold: `#C4B084`
- Primary Gold Dark: `#b39f73`
- Primary Black: `#1a1a1a`
- Text Secondary: `#666`
- Background: `#f5f5f5`

### Responsive Breakpoints
- Mobile: `< 480px`
- Tablet: `480px - 768px`
- Desktop: `768px - 1024px`
- Large Desktop: `> 1024px`

All pages are fully responsive and adjust layout based on screen size.

## Key Features to Implement

### High Priority
1. **Authentication System**: Implement OAuth and JWT handling
2. **API Integration**: Connect all pages to backend endpoints
3. **State Management**: Add global state (Context API or Redux)
4. **Error Handling**: Add error boundaries and API error handling
5. **Loading States**: Add loading spinners/skeletons while fetching data

### Medium Priority
1. **Form Validation**: Add validation to feedback form and login
2. **Search Debouncing**: Implement debounced search in courses page
3. **Pagination**: Add pagination to course lists and reviews
4. **File Upload**: Implement syllabus file upload in feedback form
5. **Export Schedule**: Add PDF/iCS export functionality

### Low Priority
1. **Dark Mode**: Add dark mode support
2. **Accessibility**: Improve ARIA labels and keyboard navigation
3. **Animations**: Add smooth transitions and loading animations
4. **PWA**: Convert to Progressive Web App
5. **Analytics**: Add user analytics tracking

## Component Documentation

Each component file includes detailed JSDoc comments explaining:
- Component purpose
- Backend integration points
- Required API endpoints
- Data structures expected from backend

Check the comments at the top of each page/component file for specific integration details.

## Notes

- All data is currently mocked with placeholder values
- TODO comments indicate where backend integration is needed
- The navbar currently shows hardcoded user initials and course count
- Color scheme matches the CourseFlix brand from the design screenshots
- All components use CSS for styling (no CSS-in-JS libraries)
- Forms include basic structure but need validation logic
- OAuth buttons have placeholder handlers that need implementation

## Support

For questions or issues, please check the main project README or contact the development team.

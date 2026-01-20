# CourseFlix Frontend - AI Generation Prompts

This document contains all the prompts used to generate the CourseFlix frontend with Claude Code.

---

## Prompt 1: Initial Frontend Generation

**Date:** January 20, 2026

**User Request:**
```
Hey Claude, I need your help generating some frontend pages for courseflix. I have attached a few picture as to how I want each page to look. I need each page to be flexible when we expand or minimize the window. I also don't want any hard coded location of buttons etc. It should dynamically change based on the window size. Each button / part of the table can just be placeholders for now. Once we have the db set up we will put the data in there, make sure to comment how to connect it to back end to sync with the database. Also, generate the files in a clean directory manner, pages, components, etc. Try to follow the color scheme as well. The navbar should be instead of clubs, it should be the submit teh feedback form tab, which should just be called, "Feedback".
```

**Attached Images:**
- Course listing page with search/filters
- Course detail page with tabs (Overview, Reviews, Grade Distribution, Comments)
- My Schedule page with calendar view
- Feedback form (multi-step)
- Login page

**AI Response Summary:**
- Created complete directory structure: `pages/`, `components/`, `styles/`, `types/`
- Generated 5 main pages:
  - `CoursesPage.tsx` - Course listing with search and filters
  - `CourseDetailPage.tsx` - Course details with tabbed interface
  - `SchedulePage.tsx` - Calendar view of schedule
  - `FeedbackPage.tsx` - Multi-step feedback form
  - `LoginPage.tsx` - Authentication page
- Created reusable `Navbar.tsx` component
- All components fully responsive with mobile breakpoints
- Comprehensive CSS files for each page
- Setup React Router for navigation
- Updated global styles with OpenDore brand colors
- Added detailed JSDoc comments for backend integration
- Created FRONTEND_README.md with integration guide

**Files Created:**
- `src/pages/CoursesPage.tsx`
- `src/pages/CourseDetailPage.tsx`
- `src/pages/SchedulePage.tsx`
- `src/pages/FeedbackPage.tsx`
- `src/pages/LoginPage.tsx`
- `src/components/Navbar.tsx`
- `src/styles/CoursesPage.css`
- `src/styles/CourseDetailPage.css`
- `src/styles/SchedulePage.css`
- `src/styles/FeedbackPage.css`
- `src/styles/LoginPage.css`
- `src/styles/Navbar.css`
- `src/App.tsx` (updated with routing)
- `src/index.css` (updated with global styles)
- `FRONTEND_README.md`

---

## Prompt 2: About Page & Branding Update

**User Request:**
```
[Screenshot of About page with mission statement and team members]

Change the about page to look something like this, it should have the navbar as well. And change OpenDore in all scenarios to CourseFlix
```

**AI Response Summary:**
- Created new `AboutPage.tsx` with mission and team sections
- Created `AboutPage.css` with responsive styling
- Updated all "OpenDore" references to "CourseFlix" across:
  - `Navbar.tsx`
  - `LoginPage.tsx`
  - `index.css`
  - `FRONTEND_README.md`
- Added AboutPage to routing in `App.tsx`
- Included team members: Stanley Chiu, Justin Ho, Jamie Fong, Adam Chen
- Added footer with contact information

**Files Created/Modified:**
- `src/pages/AboutPage.tsx` (new)
- `src/styles/AboutPage.css` (new)
- `src/components/Navbar.tsx` (updated branding)
- `src/pages/LoginPage.tsx` (updated branding)
- `src/index.css` (updated comments)
- `src/App.tsx` (added AboutPage route)
- `FRONTEND_README.md` (updated branding)

---

## Prompt 3: Font Size Adjustment

**User Request:**
```
Can you make the about page font size all smaller? it is too big right now.
```

**AI Response Summary:**
- Reduced all font sizes on About page:
  - Section headings: 48px → 36px
  - Mission/team description: 20px → 18px
  - Team member names: 22px → 18px
  - Team subtitle: 18px → 16px
  - Footer text: 18px → 16px
- Updated responsive breakpoints accordingly:
  - Tablet: headings 36px → 28px
  - Mobile: headings 28px → 24px

**Files Modified:**
- `src/styles/AboutPage.css`

---

## Prompt 4: Schedule Page Redesign

**User Request:**
```
take out the enrolled section in the My Schedule tab, since this site wont have enroll functionality, it will just have the viewable courses in the cart, so replace the enrolled with the bottom In Cart. Also, add a toggle view for the spring 2026 to allow users to select different schedules for different semester. Adjust the color as needed. Also the padding within each course is too big, leading to the instructor not viewable. Make the distance between course, name, and instructor smaller
```

**AI Response Summary:**
- Removed "Enrolled" section completely
- Kept only "In Cart" section in sidebar
- Added semester dropdown selector with options:
  - Fall 2025
  - Spring 2026
  - Summer 2026
  - Fall 2026
- Styled dropdown with CourseFlix gold border (#C4B084)
- Reduced course block padding: 0.5rem → 0.35rem
- Reduced spacing between course elements: 0.25rem → 0.1rem
- Reduced font sizes in course blocks:
  - Code: 13px → 12px
  - Name: 11px → 10px
  - Professor: 10px → 9px
- Updated sidebar cards to show: code, name, professor, time
- Removed enroll buttons and status badges
- Improved spacing in sidebar cards for better readability
- Made semester selector full-width on mobile

**Files Modified:**
- `src/pages/SchedulePage.tsx`
- `src/styles/SchedulePage.css`

---

## Technical Details

### Technologies Used
- **React 19** with TypeScript
- **React Router 7** for routing
- **Vite 7** as build tool
- **CSS** for styling (no CSS-in-JS)

### Design System
- **Primary Gold:** #C4B084
- **Primary Gold Dark:** #b39f73
- **Primary Black:** #1a1a1a
- **Text Secondary:** #666
- **Background:** #f5f5f5

### Responsive Breakpoints
- **Mobile:** < 480px
- **Tablet:** 480px - 768px
- **Desktop:** 768px - 1024px
- **Large Desktop:** > 1024px

### Key Features
- All components fully responsive
- No hardcoded dimensions
- Flexbox and Grid for layouts
- Detailed backend integration comments
- Mock data with clear TODOs
- Accessible focus states
- Smooth transitions and hover effects

---

## Backend Integration Notes

All components include detailed comments on backend integration. Key endpoints needed:

### Authentication
- `POST /api/auth/login`
- `POST /api/auth/signup`
- `GET /api/auth/google`
- `GET /api/auth/github`

### Courses
- `GET /api/courses`
- `GET /api/courses/:id`
- `GET /api/courses/:id/reviews`
- `GET /api/courses/:id/grades`
- `GET /api/courses/search`

### Cart & Schedule
- `GET /api/users/:userId/cart?semester={semester}`
- `DELETE /api/users/:userId/cart/:courseId`
- `POST /api/cart`

### Reviews
- `POST /api/reviews`
- `POST /api/reviews/:reviewId/like`
- `POST /api/courses/:courseId/syllabus`

---

## Additional Resources

- See `FRONTEND_README.md` for complete integration guide
- All component files include JSDoc comments with backend integration details
- Mock data structure matches expected API responses

---

## Changelog

### 2026-01-20
- Initial frontend generation with 5 main pages
- Added About page and rebranded to CourseFlix
- Adjusted About page font sizes
- Redesigned Schedule page (removed enrolled, added semester toggle, reduced padding)

---

## Notes for Future Development

1. Replace all mock data with actual API calls
2. Implement authentication context/state management
3. Add form validation to feedback and login forms
4. Implement file upload for syllabus submission
5. Add error handling and loading states
6. Implement search debouncing
7. Add pagination to course lists
8. Create AuthContext for protected routes

---

*Generated with Claude Code - An AI pair programmer by Anthropic*

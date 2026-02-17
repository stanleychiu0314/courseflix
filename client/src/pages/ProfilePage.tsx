import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import '../styles/ProfilePage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface CourseTaken {
  id: string;
  code: string;
  name: string;
  departmentCode: string;
}

interface CourseSearchResult {
  id: string;
  code: string;
  name: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  major1: string;
  major2: string;
  minor1: string;
  minor2: string;
  departmentsOfInterest: string[];
  favoriteSubjects: string[];
}

interface PreferencesData {
  preferredTimes: string[];
  preferredDays: string[];
  maxEffortLevel: number | null;
  preferredClassSize: string | null;
  preferredWorkTypes: string[];
}

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    firstName: '', lastName: '', email: '', avatarUrl: null,
    major1: '', major2: '', minor1: '', minor2: '',
    departmentsOfInterest: [], favoriteSubjects: [],
  });

  const [preferences, setPreferences] = useState<PreferencesData>({
    preferredTimes: [], preferredDays: [],
    maxEffortLevel: null, preferredClassSize: null, preferredWorkTypes: [],
  });

  const [coursesTaken, setCoursesTaken] = useState<CourseTaken[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // For "favorite subjects" tag input
  const [subjectInput, setSubjectInput] = useState('');

  // For course search in "courses taken"
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [courseSearchResults, setCourseSearchResults] = useState<CourseSearchResult[]>([]);

  // Fetch departments list for dropdowns
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/departments`);
        if (!res.ok) return;
        const data = await res.json();
        setDepartments(data);
      } catch {
        console.error('Error fetching departments');
      }
    };
    fetchDepartments();
  }, []);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      const p = data.profile || {};
      setProfile({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        email: p.email || '',
        avatarUrl: p.avatarUrl || null,
        major1: p.major1 || '',
        major2: p.major2 || '',
        minor1: p.minor1 || '',
        minor2: p.minor2 || '',
        departmentsOfInterest: Array.isArray(p.departmentsOfInterest) ? p.departmentsOfInterest : [],
        favoriteSubjects: Array.isArray(p.favoriteSubjects) ? p.favoriteSubjects : [],
      });
      const pr = data.preferences || {};
      setPreferences({
        preferredTimes: Array.isArray(pr.preferredTimes) ? pr.preferredTimes : [],
        preferredDays: Array.isArray(pr.preferredDays) ? pr.preferredDays : [],
        maxEffortLevel: pr.maxEffortLevel || null,
        preferredClassSize: pr.preferredClassSize || null,
        preferredWorkTypes: Array.isArray(pr.preferredWorkTypes) ? pr.preferredWorkTypes : [],
      });
      setCoursesTaken(Array.isArray(data.coursesTaken) ? data.coursesTaken : []);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Course search for "courses taken" - deduplicate by course ID since API returns sections
  useEffect(() => {
    const search = async () => {
      if (!courseSearchQuery.trim()) {
        setCourseSearchResults([]);
        return;
      }
      try {
        const params = new URLSearchParams();
        params.append('search', courseSearchQuery);
        params.append('limit', '20');
        const res = await fetch(`${API_BASE_URL}/api/courses?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const courses = Array.isArray(data) ? data : data.courses || [];
        // Deduplicate by course ID (API returns sections, same course can appear multiple times)
        const seen = new Set<string>();
        const takenIds = new Set(coursesTaken.map(c => c.id));
        const unique: CourseSearchResult[] = [];
        for (const c of courses) {
          if (!seen.has(c.id) && !takenIds.has(c.id)) {
            seen.add(c.id);
            unique.push({ id: c.id, code: c.code, name: c.name });
          }
          if (unique.length >= 6) break;
        }
        setCourseSearchResults(unique);
      } catch {
        setCourseSearchResults([]);
      }
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [courseSearchQuery, coursesTaken]);

  // Save profile
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ profile, preferences }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setMode('view');
      await fetchProfile();
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Add course to taken list
  const handleAddCourseTaken = async (course: CourseSearchResult) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/courses-taken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseId: course.id }),
      });
      if (!res.ok) throw new Error('Failed to add');
      setCoursesTaken(prev => [...prev, { ...course, departmentCode: course.code.split(' ')[0] }]);
      setCourseSearchQuery('');
      setCourseSearchResults([]);
    } catch (err) {
      console.error('Error adding course:', err);
    }
  };

  // Remove course from taken list
  const handleRemoveCourseTaken = async (courseId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/courses-taken/${courseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to remove');
      setCoursesTaken(prev => prev.filter(c => c.id !== courseId));
    } catch (err) {
      console.error('Error removing course:', err);
    }
  };

  // Department of interest helpers (dropdown-based)
  const handleAddDeptOfInterest = (deptName: string) => {
    if (deptName && !profile.departmentsOfInterest.includes(deptName)) {
      setProfile({ ...profile, departmentsOfInterest: [...profile.departmentsOfInterest, deptName] });
    }
  };

  const handleRemoveDept = (dept: string) => {
    setProfile({ ...profile, departmentsOfInterest: profile.departmentsOfInterest.filter(d => d !== dept) });
  };

  const handleAddSubject = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && subjectInput.trim()) {
      e.preventDefault();
      const val = subjectInput.trim();
      if (!profile.favoriteSubjects.includes(val)) {
        setProfile({ ...profile, favoriteSubjects: [...profile.favoriteSubjects, val] });
      }
      setSubjectInput('');
    }
  };

  const handleRemoveSubject = (subject: string) => {
    setProfile({ ...profile, favoriteSubjects: profile.favoriteSubjects.filter(s => s !== subject) });
  };

  // Toggle helpers for preferences
  const toggleTime = (time: string) => {
    setPreferences(prev => ({
      ...prev,
      preferredTimes: prev.preferredTimes.includes(time)
        ? prev.preferredTimes.filter(t => t !== time)
        : [...prev.preferredTimes, time],
    }));
  };

  const toggleDay = (day: string) => {
    setPreferences(prev => ({
      ...prev,
      preferredDays: prev.preferredDays.includes(day)
        ? prev.preferredDays.filter(d => d !== day)
        : [...prev.preferredDays, day],
    }));
  };

  const toggleWorkType = (type: string) => {
    setPreferences(prev => ({
      ...prev,
      preferredWorkTypes: prev.preferredWorkTypes.includes(type)
        ? prev.preferredWorkTypes.filter(t => t !== type)
        : [...prev.preferredWorkTypes, type],
    }));
  };

  const getInitials = () => {
    if (profile.firstName && profile.lastName) {
      return (profile.firstName[0] + profile.lastName[0]).toUpperCase();
    }
    return user?.initials || 'U';
  };

  if (loading) {
    return (
      <div className="profile-page">
        <Navbar />
        <div className="profile-container">
          <div className="loading-message">Loading profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <Navbar />
      <div className="profile-container">
        <div className="profile-header">
          <h1 className="profile-title">My Profile</h1>
          
        </div>

        {mode === 'view' ? (
          /* ====== VIEW MODE ====== */
          <div className="profile-content">
            {/* Profile Card */}
            <div className="profile-card">
              <div className="profile-avatar-large">{getInitials()}</div>
              <div className="profile-card-info">
                <h2 className="profile-card-name">
                  {profile.firstName || profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`.trim()
                    : user?.name || 'No name set'}
                </h2>
                <p className="profile-card-email">{profile.email}</p>
              </div>
              <button className="edit-profile-btn" onClick={() => setMode('edit')}>
                Edit Profile
              </button>
            </div>

            {/* Academics */}
            <div className="profile-section">
              <h3 className="section-heading">ACADEMICS</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">MAJOR 1</span>
                  <span className="info-value">{profile.major1 || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">MAJOR 2</span>
                  <span className="info-value">{profile.major2 || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">MINOR 1</span>
                  <span className="info-value">{profile.minor1 || 'N/A'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">MINOR 2</span>
                  <span className="info-value">{profile.minor2 || 'N/A'}</span>
                </div>
              </div>

              <div className="info-item full-width">
                <span className="info-label">DEPARTMENTS OF INTEREST</span>
                <div className="tag-display">
                  {profile.departmentsOfInterest.length > 0
                    ? profile.departmentsOfInterest.map(d => <span key={d} className="tag-pill">{d}</span>)
                    : <span className="info-value muted">No interests added yet</span>}
                </div>
              </div>

              <div className="info-item full-width">
                <span className="info-label">FAVORITE SUBJECTS</span>
                <div className="tag-display">
                  {profile.favoriteSubjects.length > 0
                    ? profile.favoriteSubjects.map(s => <span key={s} className="tag-pill">{s}</span>)
                    : <span className="info-value muted">No subjects added yet</span>}
                </div>
              </div>
            </div>

            {/* Courses Taken */}
            <div className="profile-section">
              <h3 className="section-heading">COURSES TAKEN</h3>
              {coursesTaken.length > 0 ? (
                <div className="courses-taken-list view-mode">
                  {coursesTaken.map(c => (
                    <span key={c.id} className="course-taken-pill">{c.code}</span>
                  ))}
                </div>
              ) : (
                <span className="info-value muted">No courses added yet</span>
              )}
            </div>

            {/* Course Preferences */}
            <div className="profile-section">
              <h3 className="section-heading">COURSE PREFERENCES</h3>
              <div className="prefs-grid">
                <div className="pref-card">
                  <span className="pref-label">PREFERRED TIMES</span>
                  <div className="pref-pills">
                    {preferences.preferredTimes.length > 0
                      ? preferences.preferredTimes.map(t => (
                          <span key={t} className={`pref-pill time-${t.toLowerCase().replace(/\s+/g, '-')}`}>{t}</span>
                        ))
                      : <span className="pref-value muted">Not set</span>}
                  </div>
                </div>
                <div className="pref-card">
                  <span className="pref-label">MAX EFFORT LEVEL</span>
                  <div className="pref-pills">
                    {preferences.maxEffortLevel
                      ? <span className={`pref-pill effort-${preferences.maxEffortLevel}`}>
                          {preferences.maxEffortLevel} - {
                            ['Very Easy', 'Easy', 'Moderate', 'Hard', 'Very Hard'][preferences.maxEffortLevel - 1]
                          }
                        </span>
                      : <span className="pref-value muted">Not set</span>}
                  </div>
                </div>
                <div className="pref-card">
                  <span className="pref-label">CLASS SIZE</span>
                  <div className="pref-pills">
                    {preferences.preferredClassSize
                      ? <span className={`pref-pill size-${preferences.preferredClassSize}`}>
                          {preferences.preferredClassSize === 'small' ? 'Small (< 20)'
                            : preferences.preferredClassSize === 'medium' ? 'Medium (20-50)'
                            : 'Large (50+)'}
                        </span>
                      : <span className="pref-value muted">Not set</span>}
                  </div>
                </div>
                <div className="pref-card half-width">
                  <span className="pref-label">PREFERRED DAYS</span>
                  <div className="pref-pills">
                    {preferences.preferredDays.length > 0
                      ? preferences.preferredDays.map(d => (
                          <span key={d} className="pref-pill day-pill">{d}</span>
                        ))
                      : <span className="pref-value muted">Not set</span>}
                  </div>
                </div>
                <div className="pref-card half-width">
                  <span className="pref-label">WORK TYPE</span>
                  <div className="pref-pills">
                    {preferences.preferredWorkTypes.length > 0
                      ? preferences.preferredWorkTypes.map(w => (
                          <span key={w} className="pref-pill work-pill">{w}</span>
                        ))
                      : <span className="pref-value muted">Not set</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Banner - only show if profile is incomplete */}
            {(preferences.preferredTimes.length === 0 ||
              preferences.preferredDays.length === 0 ||
              !preferences.maxEffortLevel ||
              !preferences.preferredClassSize ||
              preferences.preferredWorkTypes.length === 0 ||
              profile.departmentsOfInterest.length === 0 ||
              profile.favoriteSubjects.length === 0) && (
              <div className="profile-banner">
                Your course feed is currently sorted <strong>alphabetically</strong>.
                Complete your profile to unlock <strong>personalized recommendations</strong> &mdash;
                courses ranked based on your majors, interests, schedule preferences, and effort tolerance.
              </div>
            )}
          </div>
        ) : (
          /* ====== EDIT MODE ====== */
          <div className="profile-content">
            {/* Basic Information */}
            <div className="profile-section">
              <h3 className="section-heading">BASIC INFORMATION</h3>
              <div className="edit-row">
                <div className="profile-avatar-large edit-avatar">{getInitials()}</div>
              </div>
              <div className="edit-grid">
                <div className="edit-field">
                  <label className="edit-label">FIRST NAME</label>
                  <input
                    type="text"
                    className="edit-input"
                    value={profile.firstName}
                    onChange={e => setProfile({ ...profile, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="edit-field">
                  <label className="edit-label">LAST NAME</label>
                  <input
                    type="text"
                    className="edit-input"
                    value={profile.lastName}
                    onChange={e => setProfile({ ...profile, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
                <div className="edit-field full-span">
                  <label className="edit-label">EMAIL</label>
                  <input
                    type="text"
                    className="edit-input disabled"
                    value={profile.email}
                    readOnly
                  />
                </div>
              </div>
            </div>

            {/* Academics */}
            <div className="profile-section">
              <h3 className="section-heading">ACADEMICS</h3>
              <div className="edit-grid">
                <div className="edit-field">
                  <label className="edit-label">MAJOR 1</label>
                  <select
                    className="edit-select"
                    value={profile.major1}
                    onChange={e => setProfile({ ...profile, major1: e.target.value })}
                  >
                    <option value="">Select a department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="edit-field">
                  <label className="edit-label">MAJOR 2</label>
                  <select
                    className="edit-select"
                    value={profile.major2}
                    onChange={e => setProfile({ ...profile, major2: e.target.value })}
                  >
                    <option value="">Select a department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="edit-field">
                  <label className="edit-label">MINOR 1</label>
                  <select
                    className="edit-select"
                    value={profile.minor1}
                    onChange={e => setProfile({ ...profile, minor1: e.target.value })}
                  >
                    <option value="">Select a department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="edit-field">
                  <label className="edit-label">MINOR 2</label>
                  <select
                    className="edit-select"
                    value={profile.minor2}
                    onChange={e => setProfile({ ...profile, minor2: e.target.value })}
                  >
                    <option value="">Select a department...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Departments of Interest */}
              <div className="edit-field full-width">
                <label className="edit-label">DEPARTMENTS OF INTEREST</label>
                <div className="tag-input-container">
                  {profile.departmentsOfInterest.map(d => (
                    <span key={d} className="tag-pill editable">
                      {d}
                      <button className="tag-remove" onClick={() => handleRemoveDept(d)}>x</button>
                    </span>
                  ))}
                  <select
                    className="edit-select dept-interest-select"
                    value=""
                    onChange={e => { handleAddDeptOfInterest(e.target.value); }}
                  >
                    <option value="">Add a department...</option>
                    {departments
                      .filter(d => !profile.departmentsOfInterest.includes(d.name))
                      .map(d => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Favorite Subjects */}
              <div className="edit-field full-width">
                <label className="edit-label">FAVORITE SUBJECTS / TOPICS</label>
                <div className="tag-input-container">
                  {profile.favoriteSubjects.map(s => (
                    <span key={s} className="tag-pill editable">
                      {s}
                      <button className="tag-remove" onClick={() => handleRemoveSubject(s)}>x</button>
                    </span>
                  ))}
                  <input
                    type="text"
                    className="tag-input"
                    value={subjectInput}
                    onChange={e => setSubjectInput(e.target.value)}
                    onKeyDown={handleAddSubject}
                    placeholder="Add topics (e.g., Machine Learning, History of Art)..."
                  />
                </div>
                <span className="edit-hint">Freeform topics - press Enter to add</span>
              </div>
            </div>

            {/* Courses Taken */}
            <div className="profile-section">
              <h3 className="section-heading">COURSES TAKEN</h3>
              <p className="section-description">Add courses you've already completed to improve recommendations.</p>

              {/* Existing courses */}
              {coursesTaken.length > 0 && (
                <div className="courses-taken-list">
                  {coursesTaken.map(c => (
                    <span key={c.id} className="course-taken-pill editable">
                      {c.code}: {c.name}
                      <button className="tag-remove" onClick={() => handleRemoveCourseTaken(c.id)}>x</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search to add courses */}
              <div className="course-search-wrapper">
                <input
                  type="text"
                  className="edit-input"
                  value={courseSearchQuery}
                  onChange={e => setCourseSearchQuery(e.target.value)}
                  placeholder="Search for a course to add (e.g., CS 1101, Intro to Engineering)..."
                />
                {courseSearchResults.length > 0 && (
                  <div className="course-search-dropdown">
                    {courseSearchResults.map(c => (
                      <div
                        key={c.id}
                        className="course-search-item"
                        onClick={() => handleAddCourseTaken(c)}
                      >
                        <span className="course-search-code">{c.code}</span>
                        <span className="course-search-name">{c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Course Preferences */}
            <div className="profile-section">
              <h3 className="section-heading">COURSE PREFERENCES</h3>

              {/* Preferred Times */}
              <div className="edit-field full-width">
                <label className="edit-label">PREFERRED CLASS TIMES</label>
                <div className="toggle-group">
                  {['Early AM', 'Morning', 'Afternoon', 'Evening'].map(time => (
                    <button
                      key={time}
                      className={`toggle-btn ${preferences.preferredTimes.includes(time) ? 'active' : ''}`}
                      onClick={() => toggleTime(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Days */}
              <div className="edit-field full-width">
                <label className="edit-label">PREFERRED DAYS</label>
                <div className="toggle-group">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                    <button
                      key={day}
                      className={`toggle-btn ${preferences.preferredDays.includes(day) ? 'active' : ''}`}
                      onClick={() => toggleDay(day)}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Max Effort & Class Size */}
              <div className="edit-grid">
                <div className="edit-field">
                  <label className="edit-label">MAX EFFORT LEVEL (1-5)</label>
                  <select
                    className="edit-select"
                    value={preferences.maxEffortLevel || ''}
                    onChange={e => setPreferences({
                      ...preferences,
                      maxEffortLevel: e.target.value ? parseInt(e.target.value) : null,
                    })}
                  >
                    <option value="">Any effort level</option>
                    <option value="1">1 - Very Easy</option>
                    <option value="2">2 - Easy</option>
                    <option value="3">3 - Moderate</option>
                    <option value="4">4 - Hard</option>
                    <option value="5">5 - Very Hard</option>
                  </select>
                </div>
                <div className="edit-field">
                  <label className="edit-label">PREFERRED CLASS SIZE</label>
                  <select
                    className="edit-select"
                    value={preferences.preferredClassSize || ''}
                    onChange={e => setPreferences({
                      ...preferences,
                      preferredClassSize: e.target.value || null,
                    })}
                  >
                    <option value="">No preference</option>
                    <option value="small">Small (&lt; 20)</option>
                    <option value="medium">Medium (20-50)</option>
                    <option value="large">Large (50+)</option>
                  </select>
                </div>
              </div>

              {/* Preferred Work Types */}
              <div className="edit-field full-width">
                <label className="edit-label">PREFERRED TYPE OF WORK</label>
                <div className="toggle-group wrap">
                  {['Exams', 'Projects', 'Readings', 'Problem Sets', 'Labs', 'Essays/Writing', 'Presentations', 'Group Work'].map(type => (
                    <button
                      key={type}
                      className={`toggle-btn ${preferences.preferredWorkTypes.includes(type) ? 'active' : ''}`}
                      onClick={() => toggleWorkType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="profile-actions">
              <button className="cancel-btn" onClick={() => { setMode('view'); fetchProfile(); }}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;

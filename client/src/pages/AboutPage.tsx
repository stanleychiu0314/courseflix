import React from 'react';
import Navbar from '../components/Navbar';
import '../styles/AboutPage.css';

/**
 * AboutPage Component
 *
 * Displays information about CourseFlix, the mission, and the team.
 */

const AboutPage: React.FC = () => {
  const teamMembers = ['Stanley Chiu', 'Justin Ho', 'Jamie Fong', 'Adam Chen'];

  return (
    <div className="about-page">
      <Navbar />

      <div className="about-container">
        <section className="mission-section">
          <h1 className="about-heading">Our Mission</h1>
          <p className="mission-text">
            CourseFlix is for students looking for better work-life balance! Sort courses from least to most time consuming
            and filter by department, professor, and time offered to put together your optimal schedule each semester.
          </p>
        </section>

        <section className="team-section">
          <h2 className="about-heading">Who we are</h2>
          <p className="team-description">
            CourseFlix arose from the need for a simpler way to browse courses by workload to construct a balanced schedule.
          </p>
          <p className="team-subtitle">Created with ❤️ by Vanderbilt students:</p>

          <div className="team-members">
            {teamMembers.map((member) => (
              <div key={member} className="team-member">
                {member}
              </div>
            ))}
          </div>
        </section>

        <footer className="about-footer">
          <p>
            For questions, comments, or concerns, contact us{' '}
            <a href="mailto:po.siang.chiu@vanderbilt.edu" className="contact-link">
              here
            </a>{' '}
            ⚓️
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AboutPage;

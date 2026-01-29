const fs = require('fs');
const { scrapeCourse } = require('./course-info-scrapper.js');

async function scrapeAllCourses() {
    // Read the course list file
    const courseListText = fs.readFileSync('course-list.txt', 'utf-8');
    const courseLines = courseListText.trim().split('\n');

    const allCoursesData = [];
    let successCount = 0;
    let skippedCount = 0;

    // Number of concurrent requests - adjust based on rate limits
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES_MS = 1000; // Wait 1 second between batches

    console.log(`Starting to scrape ${courseLines.length} courses (batch size: ${BATCH_SIZE})...\n`);

    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Parse all course lines first
    const courses = courseLines.map((line, index) => {
        const courseLine = line.trim();
        const match = courseLine.match(/^([A-Z]+)\s+(\d+)$/);
        if (!match) {
            console.log(`Skipping invalid line: ${courseLine}`);
            return null;
        }
        const [, subject, catalogNumber] = match;
        return { subject, catalogNumber, index };
    }).filter(Boolean);

    // Process in batches
    for (let i = 0; i < courses.length; i += BATCH_SIZE) {
        const batch = courses.slice(i, i + BATCH_SIZE);
        const batchEnd = Math.min(i + BATCH_SIZE, courses.length);

        console.log(`[Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(courses.length / BATCH_SIZE)}] Scraping courses ${i + 1}-${batchEnd}...`);

        const promises = batch.map(async ({ subject, catalogNumber }) => {
            try {
                const sections = await scrapeCourse(subject, catalogNumber);
                return { subject, catalogNumber, sections, error: null };
            } catch (error) {
                return { subject, catalogNumber, sections: null, error };
            }
        });

        const results = await Promise.all(promises);

        for (const { subject, catalogNumber, sections, error } of results) {
            if (error) {
                console.error(`  Error scraping ${subject} ${catalogNumber}: ${error.message}`);
                skippedCount++;
                continue;
            }

            if (sections && sections.length > 0) {
                const courseData = {
                    subject: subject,
                    catalogNumber: catalogNumber,
                    courseName: sections[0].courseName,
                    courseTitle: sections[0].courseTitle,
                    courseDescription: sections[0].courseDescription || '',
                    requirements: sections[0].requirements || '',
                    hours: sections[0].hours || '',
                    term: sections[0].term || '',
                    sections: sections.map(section => ({
                        section: section.section,
                        instructor: section.instructor,
                        days: section.days,
                        time: section.time,
                        availability: section.availability
                    }))
                };

                allCoursesData.push(courseData);
                successCount++;
                console.log(`  ✓ ${subject} ${catalogNumber}`);
            } else {
                skippedCount++;
            }
        }

        // Wait between batches to avoid rate limiting
        if (i + BATCH_SIZE < courses.length) {
            await delay(DELAY_BETWEEN_BATCHES_MS);
        }
    }

    // Save to JSON file
    const outputFile = 'courses-data.json';
    fs.writeFileSync(outputFile, JSON.stringify(allCoursesData, null, 2), 'utf-8');

    console.log('\n========================================');
    console.log('SCRAPING COMPLETE');
    console.log('========================================');
    console.log(`Total courses in list: ${courseLines.length}`);
    console.log(`Successfully scraped: ${successCount}`);
    console.log(`Skipped (not found): ${skippedCount}`);
    console.log(`Output saved to: ${outputFile}`);
    console.log('========================================\n');
}

// Run the scraper
scrapeAllCourses().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});

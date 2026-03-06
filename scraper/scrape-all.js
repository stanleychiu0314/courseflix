const fs = require('fs');
const { scrapeCourse } = require('./course-info-scrapper.js');

async function scrapeAllCourses() {
    // Read the course list file
    const courseListText = fs.readFileSync('course-list.txt', 'utf-8');
    const courseLines = courseListText.trim().split('\n');

    const allCoursesData = [];
    const scrapedCodes = new Set(); // deduplicates variants that also appear explicitly in the course list
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
        const match = courseLine.match(/^([A-Z]+)\s+(\d+[A-Z]*)$/);
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
                const courseResults = await scrapeCourse(subject, catalogNumber);
                return { subject, catalogNumber, courseResults, error: null };
            } catch (error) {
                return { subject, catalogNumber, courseResults: null, error };
            }
        });

        const results = await Promise.all(promises);

        for (const { subject, catalogNumber, courseResults, error } of results) {
            if (error) {
                console.error(`  Error scraping ${subject} ${catalogNumber}: ${error.message}`);
                skippedCount++;
                continue;
            }

            if (!courseResults || courseResults.length === 0) {
                skippedCount++;
                continue;
            }

            for (const result of courseResults) {
                if (!result.sections || result.sections.length === 0) continue;

                // Skip if already captured as a variant of a previous search
                const courseCode = `${subject} ${result.catalogNumber}`;
                if (scrapedCodes.has(courseCode)) continue;
                scrapedCodes.add(courseCode);

                const courseData = {
                    subject: subject,
                    catalogNumber: result.catalogNumber,
                    courseName: result.courseName,
                    courseDescription: result.courseDescription || '',
                    requirements: result.requirements || '',
                    hours: result.hours || '',
                    term: result.term || '',
                    sections: result.sections.map(section => ({
                        section: section.section,
                        courseTitle: section.courseTitle || '',
                        instructor: section.instructor,
                        days: section.days,
                        time: section.time,
                        availability: section.availability
                    }))
                };

                allCoursesData.push(courseData);
                successCount++;
                console.log(`  ✓ ${subject} ${result.catalogNumber}`);
            }
        }

        // Wait between batches to avoid rate limiting
        if (i + BATCH_SIZE < courses.length) {
            await delay(DELAY_BETWEEN_BATCHES_MS);
        }
    }

    // Save to JSON file
    const outputFile = 'new-courses-data.json';
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

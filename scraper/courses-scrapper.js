const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeAllCourses() {
    console.log('Starting course list scraper...');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null
    });

    const page = await browser.newPage();

    // Navigate to the course catalog page
    await page.goto('https://www.vanderbilt.edu/catalogs/kuali/undergraduate-25-26.php#/courses', {
        waitUntil: 'networkidle2',
        timeout: 60000
    });

    console.log('Page loaded, waiting for course groups...');

    // Wait for the main container with course groups
    await page.waitForSelector('div.style__groups___IUc1d', { timeout: 30000 });

    // Give the page a moment to fully render
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Finding all collapsible sections...');

    // Find all collapsible sections and expand them
    const expandButtonsCount = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button.style__collapseButton___D0Xl5[aria-expanded="false"]');
        return buttons.length;
    });

    console.log(`Found ${expandButtonsCount} collapsed sections. Expanding them...`);

    // Expand all collapsed sections one by one
    for (let i = 0; i < expandButtonsCount; i++) {
        await page.evaluate((index) => {
            const buttons = document.querySelectorAll('button.style__collapseButton___D0Xl5');
            if (buttons[index] && buttons[index].getAttribute('aria-expanded') === 'false') {
                buttons[index].click();
            }
        }, i);

        // Wait a bit between clicks to let content load
        await new Promise(resolve => setTimeout(resolve, 300));

        if ((i + 1) % 10 === 0) {
            console.log(`Expanded ${i + 1}/${expandButtonsCount} sections...`);
        }
    }

    console.log('All sections expanded. Extracting course numbers...');

    // Wait a moment for all content to be visible
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Extract all course numbers
    const courseNumbers = await page.evaluate(() => {
        const courses = [];

        // Find all course links within the expanded lists
        const links = document.querySelectorAll('ul.style__withDivider___EaJKC li.style__item___hh5c0 a[href*="/courses/"]');

        links.forEach(link => {
            const text = link.textContent.trim();
            // Extract course number from text like "CORE1010 - Being Human"
            const match = text.match(/^([A-Z]+)(\d+)/);
            if (match) {
                const department = match[1];
                const number = match[2];
                courses.push(`${department} ${number}`);
            }
        });

        return courses;
    });

    console.log(`\nFound ${courseNumbers.length} courses.`);

    // Remove duplicates and sort
    const uniqueCourses = [...new Set(courseNumbers)].sort();

    console.log(`Unique courses: ${uniqueCourses.length}`);

    // Write to file
    const outputPath = 'course-list.txt';
    fs.writeFileSync(outputPath, uniqueCourses.join('\n'));

    console.log(`\nCourse list saved to ${outputPath}`);
    console.log('\nFirst 10 courses:');
    uniqueCourses.slice(0, 10).forEach(course => console.log(`  ${course}`));

    await browser.close();

    return uniqueCourses;
}

// Run the scraper
scrapeAllCourses().catch(console.error);

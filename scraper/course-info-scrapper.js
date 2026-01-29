const puppeteer = require('puppeteer');

async function scrapeCourse(subject, catalogNumber) {
    // Launch browser (set headless: false to watch it work)
    const browser = await puppeteer.launch({ 
        headless: true,  // <-- Change to true once it's working
    });
    
    const page = await browser.newPage();
    
    // Go to the search page
    await page.goto('https://more.app.vanderbilt.edu/more/SearchClasses!input.action', { 
        waitUntil: 'networkidle2' 
    });
    
    // ===========================================
    // STEP 1: FILL IN THE SEARCH FORM
    // ===========================================

    const SEARCH_INPUT_SELECTOR = '#searchClassSectionsInput';

    await page.type(SEARCH_INPUT_SELECTOR, `${subject} ${catalogNumber}`);
    
    
    // ===========================================
    // STEP 2: CLICK THE SEARCH BUTTON
    // ===========================================
    
    // Force-enable the button and click it via JavaScript
    await page.evaluate(() => {
        const btn = document.querySelector('#searchClassesButton-button');
        btn.disabled = false;
        btn.click();
    });

    // Wait for results to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    
    // ===========================================
    // STEP 3: EXTRACT THE DATA
    // ===========================================

    const data = await page.evaluate((targetSubject, targetCatalog) => {
        const results = [];

        // Find all course tables
        const courseTables = document.querySelectorAll('table.classTable');

        courseTables.forEach((table) => {
            // Get course name and description from the header
            const courseAbbrev = table.querySelector('.classAbbreviation')?.textContent?.trim() || '';
            const courseTitle = table.querySelector('.classDescription')?.textContent?.trim() || '';

            // Check if this is the course we're looking for
            // Extract subject and catalog number from courseAbbrev (e.g., "CS 1101:")
            const courseMatch = courseAbbrev.match(/^([A-Z]+)\s+(\d+)/);
            if (!courseMatch) return;

            const [, subject, catalog] = courseMatch;
            if (subject !== targetSubject || catalog !== targetCatalog) return;

            // Get all class rows (sections) within this specific table
            const rows = table.querySelectorAll('tr.classRow');

        rows.forEach((row) => {
            const section = row.querySelector('.classSection')?.textContent?.trim() || '';
            const instructor = row.querySelector('.classInstructor')?.textContent?.trim() || '';
            const days = row.querySelector('.classMeetingDays')?.textContent?.trim().replace(/\s+/g, ' ') || '';
            const time = row.querySelector('.classMeetingTimes')?.textContent?.trim().replace(/\s+/g, ' ') || '';

            // Extract just the enrollment numbers (e.g., "43/60")
            const availabilityLink = row.querySelector('.classAvailability a.availableStatus');
            const availability = availabilityLink?.textContent?.trim() || '';

            results.push({
                courseName: courseAbbrev,
                courseTitle: courseTitle,
                section: section,
                instructor: instructor,
                days: days,
                time: time,
                availability: availability
            });
        });
        });

        return results;
    }, subject, catalogNumber);

    // ===========================================
    // STEP 4: GET COURSE DESCRIPTION FROM DETAIL PANEL
    // ===========================================

    let courseDescription = '';

    if (data.length > 0) {
        // Click on the first section to open the detail panel
        const firstSectionSelector = 'td.classSection';
        await page.waitForSelector(firstSectionSelector);

        // Use JavaScript click for reliability (avoids "not clickable" errors)
        await page.evaluate((selector) => {
            document.querySelector(selector).click();
        }, firstSectionSelector);

        // Wait for the detail panel to appear and content to load
        await page.waitForSelector('#classDetailContainer', { visible: true });
        await page.waitForSelector('#classDetailContainer .nameValueTable', { visible: true, timeout: 5000 });

        // Extract the description and requirements from the detail panel
        const courseDetails = await page.evaluate(() => {
            // Get description - it's in the last detailPanel (the one without a table)
            const detailPanels = Array.from(document.querySelectorAll('.detailPanel'));
            let description = '';
            for (const panel of detailPanels) {
                // The description panel doesn't contain a table
                if (!panel.querySelector('table')) {
                    description = panel.textContent.trim();
                    break;
                }
            }

            // Get requirements from the label/value table
            let requirements = '';
            let hours = '';
            const labels = Array.from(document.querySelectorAll('#classDetailContainer td.label'));

            const requirementLabel = labels.find(label =>
                label.textContent.trim() === 'Requirement(s):'
            );
            if (requirementLabel) {
                const requirementCell = requirementLabel.nextElementSibling;
                if (requirementCell) {
                    requirements = requirementCell.textContent.trim();
                }
            }

            const hoursLabel = labels.find(label =>
                label.textContent.trim() === 'Hours:'
            );
            if (hoursLabel) {
                const hoursCell = hoursLabel.nextElementSibling;
                if (hoursCell) {
                    hours = hoursCell.textContent.trim();
                }
            }

            let term = '';
            const termLabel = labels.find(label =>
                label.textContent.trim() === 'Term:'
            );
            if (termLabel) {
                const termCell = termLabel.nextElementSibling;
                if (termCell) {
                    term = termCell.textContent.trim();
                }
            }

            return { description, requirements, hours, term };
        });

        courseDescription = courseDetails.description;
        const courseRequirements = courseDetails.requirements;
        const courseHours = courseDetails.hours;
        const courseTerm = courseDetails.term;

        // Close the detail panel
        await page.waitForSelector('#closeClassSectionDetailDialogButton-button', { visible: true });
        await page.evaluate(() => {
            document.querySelector('#closeClassSectionDetailDialogButton-button').click();
        });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Add description, requirements, hours, and term to all sections
        data.forEach(section => {
            section.courseDescription = courseDescription;
            section.requirements = courseRequirements;
            section.hours = courseHours;
            section.term = courseTerm;
        });
    }

    await browser.close();
    return data;
}

// Export the function so it can be used by other scripts
module.exports = { scrapeCourse };
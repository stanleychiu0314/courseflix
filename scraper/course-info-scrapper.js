const puppeteer = require('puppeteer');

const TARGET_TERM_CODE = '1075'; // "2026 Fall"

// Returns an array of course objects found in the search results for the given subject/catalogNumber.
// A single search may return multiple variants (e.g. PHYS 1601 and PHYS 1601L) as separate entries.
// Each entry: { catalogNumber, courseName, courseDescription, requirements, hours, term, sections[] }
async function scrapeCourse(subject, catalogNumber) {
    const browser = await puppeteer.launch({
        headless: true,
    });

    const page = await browser.newPage();

    await page.goto('https://more.app.vanderbilt.edu/more/SearchClasses!input.action', {
        waitUntil: 'networkidle2'
    });

    // ===========================================
    // STEP 0: SELECT THE CORRECT TERM
    // ===========================================

    await page.waitForSelector('#selectedTerm', { visible: true });
    await page.select('#selectedTerm', TARGET_TERM_CODE);
    await new Promise(resolve => setTimeout(resolve, 500));

    // ===========================================
    // STEP 1: FILL IN THE SEARCH FORM
    // ===========================================

    const SEARCH_INPUT_SELECTOR = '#searchClassSectionsInput';
    await page.waitForSelector(SEARCH_INPUT_SELECTOR, { visible: true, timeout: 10000 });
    await page.type(SEARCH_INPUT_SELECTOR, `${subject} ${catalogNumber}`);

    // ===========================================
    // STEP 2: CLICK THE SEARCH BUTTON
    // ===========================================

    await page.evaluate(() => {
        const btn = document.querySelector('#searchClassesButton-button');
        btn.disabled = false;
        btn.click();
    });

    // If no results for this term, return empty array silently
    try {
        await page.waitForSelector('table.classTable', { visible: true, timeout: 5000 });
    } catch {
        await browser.close();
        return [];
    }

    // ===========================================
    // STEP 3: EXTRACT BASIC DATA FROM TABLE ROWS
    // Groups sections by catalog number so that a search for "PHYS 1601" captures
    // both PHYS 1601 and PHYS 1601L as separate course entries in one browser session.
    // ===========================================

    const data = await page.evaluate((targetSubject, targetCatalog) => {
        const coursesBycat = {}; // { catalogNumber: { courseName, sections[] } }

        const courseTables = document.querySelectorAll('table.classTable');

        courseTables.forEach((table) => {
            const courseAbbrev = table.querySelector('.classAbbreviation')?.textContent?.trim() || '';
            const courseTitle = table.querySelector('.classDescription')?.textContent?.trim() || '';

            const courseMatch = courseAbbrev.match(/^([A-Z]+)\s+(\d+[A-Z]*)/);
            if (!courseMatch) return;

            const [, subject, catalog] = courseMatch;
            // Capture this course if same subject AND catalog starts with targetCatalog
            // (e.g. targetCatalog "1601" matches "1601" and "1601L")
            if (subject !== targetSubject || !catalog.startsWith(targetCatalog)) return;

            if (!coursesBycat[catalog]) {
                coursesBycat[catalog] = { courseName: courseAbbrev, sections: [] };
            }

            const rows = table.querySelectorAll('tr.classRow');
            rows.forEach((row) => {
                const sectionTd = row.querySelector('td.classSection');
                const section = sectionTd?.textContent?.trim() || '';
                const classNumber = sectionTd?.id?.replace('classNumber_', '') || '';
                const instructor = row.querySelector('.classInstructor')?.textContent?.trim() || '';
                const days = row.querySelector('.classMeetingDays')?.textContent?.trim().replace(/\s+/g, ' ') || '';
                const time = row.querySelector('.classMeetingTimes')?.textContent?.trim().replace(/\s+/g, ' ') || '';

                coursesBycat[catalog].sections.push({
                    courseTitle,
                    classNumber,
                    section,
                    instructor,
                    days,
                    time,
                    availability: ''
                });
            });
        });

        return Object.entries(coursesBycat).map(([catalog, d]) => ({
            catalogNumber: catalog,
            courseName: d.courseName,
            sections: d.sections,
        }));
    }, subject, catalogNumber);

    // ===========================================
    // STEP 4: OPEN DETAIL PANEL FOR EACH SECTION
    // Gets availability for every section; gets description/requirements/hours/term
    // from the first section of each course variant separately.
    // ===========================================

    for (const courseResult of data) {
        let isFirstSection = true;
        let courseDescription = '';
        let courseRequirements = '';
        let courseHours = '';
        let courseTerm = '';

        for (const entry of courseResult.sections) {
            try {
                // Open detail panel via YAHOO event using classNumber (avoids fragile DOM index)
                await page.evaluate((classNum, termCode) => {
                    YAHOO.mis.student.Topics.showClassDetailPanel.fire({
                        classNumber: classNum,
                        termCode: termCode
                    });
                }, entry.classNumber, TARGET_TERM_CODE);

                await page.waitForSelector('#classDetailContainer', { visible: true, timeout: 10000 });
                await page.waitForSelector('.availabilityNameValueTable', { visible: true, timeout: 10000 });

                const panelData = await page.evaluate((getDetails) => {
                    const availTable = document.querySelector('.availabilityNameValueTable');
                    let capacity = '';
                    let enrolled = '';
                    if (availTable) {
                        const rows = availTable.querySelectorAll('tr');
                        for (const row of rows) {
                            const label = row.querySelector('td.label')?.textContent?.trim() || '';
                            const value = row.querySelector('td:not(.label)')?.textContent?.trim() || '';
                            if (label === 'Class Capacity:') capacity = value;
                            if (label === 'Total Enrolled:') enrolled = value;
                        }
                    }
                    const availability = (enrolled !== '' && capacity !== '')
                        ? `${enrolled}/${capacity}`
                        : '';

                    if (!getDetails) return { availability };

                    // First section only: description, requirements, hours, term
                    const detailPanels = Array.from(document.querySelectorAll('.detailPanel'));
                    let description = '';
                    for (const panel of detailPanels) {
                        if (!panel.querySelector('table')) {
                            description = panel.textContent.trim();
                            break;
                        }
                    }

                    let requirements = '';
                    let hours = '';
                    let term = '';
                    const labels = Array.from(document.querySelectorAll('#classDetailContainer td.label'));

                    const reqLabel = labels.find(l => l.textContent.trim() === 'Requirement(s):');
                    if (reqLabel) requirements = reqLabel.nextElementSibling?.textContent?.trim() || '';

                    const hoursLabel = labels.find(l => l.textContent.trim() === 'Hours:');
                    if (hoursLabel) hours = hoursLabel.nextElementSibling?.textContent?.trim() || '';

                    const termLabel = labels.find(l => l.textContent.trim() === 'Term:');
                    if (termLabel) term = termLabel.nextElementSibling?.textContent?.trim() || '';

                    return { availability, description, requirements, hours, term };
                }, isFirstSection);

                entry.availability = panelData.availability;

                if (isFirstSection) {
                    courseDescription = panelData.description;
                    courseRequirements = panelData.requirements;
                    courseHours = panelData.hours;
                    courseTerm = panelData.term;
                    isFirstSection = false;
                }

                // Close detail panel and wait for it to fully disappear before opening the next
                await page.waitForSelector('#closeClassSectionDetailDialogButton-button', { visible: true });
                await page.evaluate(() => {
                    document.querySelector('#closeClassSectionDetailDialogButton-button').click();
                });
                await page.waitForSelector('#classDetailContainer', { hidden: true, timeout: 5000 }).catch(() => {});
                await new Promise(resolve => setTimeout(resolve, 300));

            } catch (err) {
                console.error(`  Could not get details for ${courseResult.catalogNumber} section ${entry.section}: ${err.message}`);
                try {
                    await page.evaluate(() => {
                        const btn = document.querySelector('#closeClassSectionDetailDialogButton-button');
                        if (btn) btn.click();
                    });
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (_) {}
            }
        }

        courseResult.courseDescription = courseDescription;
        courseResult.requirements = courseRequirements;
        courseResult.hours = courseHours;
        courseResult.term = courseTerm;
    }

    await browser.close();
    return data;
}

module.exports = { scrapeCourse };
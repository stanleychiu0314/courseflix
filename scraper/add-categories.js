const fs = require('fs');
const path = require('path');

/**
 * Adds a category to courses in courses-data.json based on a text file of course codes.
 *
 * Usage: node scraper/add-categories.js <category-file> <category-name>
 * Example: node scraper/add-categories.js scraper/hca.txt HCA
 *
 * The text file should have one course per line, e.g.:
 *   AADS 2214
 *   ANTH 2275W
 */

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node scraper/add-categories.js <category-file> <category-name>');
    console.error('Example: node scraper/add-categories.js scraper/hca.txt HCA');
    process.exit(1);
}

const categoryFile = args[0];
const categoryName = args[1];
const jsonPath = path.join(__dirname, 'courses-data.json');

// Read the category file
const categoryText = fs.readFileSync(categoryFile, 'utf-8');
const categoryCourses = new Set(
    categoryText.trim().split('\n')
        .map(line => {
            // Normalize: "ANTH 2275W" -> "ANTH 2275" (strip letter suffixes for matching)
            const match = line.trim().match(/^([A-Z-]+)\s+(\d+)/);
            if (!match) return null;
            return `${match[1]} ${match[2]}`;
        })
        .filter(Boolean)
);

// Read courses-data.json
const courses = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

let matchCount = 0;

for (const course of courses) {
    const courseKey = `${course.subject} ${course.catalogNumber}`;
    if (categoryCourses.has(courseKey)) {
        if (!course.categories) {
            course.categories = [];
        }
        if (!course.categories.includes(categoryName)) {
            course.categories.push(categoryName);
        }
        matchCount++;
    }
}

// Write back
fs.writeFileSync(jsonPath, JSON.stringify(courses, null, 2), 'utf-8');

console.log(`Added "${categoryName}" to ${matchCount} courses (out of ${categoryCourses.size} in ${categoryFile})`);

# Structure
* `courses-scrapper.js` is used to scrape a list of all the courses Vanderbilt offers. Outputs course-list.txt file
* `course-info-scraper` is used to scrape the information for a particular course (e.g., CS 2201).
* `scrape-all` takes the list of courses and gets the course information for each individual course.


# To Seed
Step 1: Generate seed SQL files

`node db/seed-departments.js`

`node db/seed-terms.js`


Step 2: Start database and apply schema + seeds

`docker-compose up -d`

`docker exec -i courseflix-db psql -U courseflix -d courseflix < db/schemav2.sql`

`docker exec -i courseflix-db psql -U courseflix -d courseflix < db/seed-departments.sql`

`docker exec -i courseflix-db psql -U courseflix -d courseflix < db/seed-terms.sql`


Step 3: Re-scrape with new fields

(Note: Only run this script if you are trying to regenerate courses-data.json. Estimated time to run is around 90-150 minutes)

`cd scraper`

`node scrape-all.js`


Step 4: Install pg client and import

`npm install pg`

`node db/import-courses.js`



# Testing
`docker exec -it courseflix-db psql -U courseflix -d courseflix -c "SELECT code, name FROM departments LIMIT 10;"`

`docker exec -it courseflix-db psql -U courseflix -d courseflix -c "SELECT c.code, cc.name as category FROM course_category_mapping ccm JOIN courses c ON c.id = ccm.course_id JOIN course_categories cc ON cc.id = ccm.category_id ORDER BY c.code LIMIT 15;"`


# Add course categories
To add course categories (e.g., HCA, SBS), have a list of all the courses within that category under `scraper/course-categories`

Example:
`node scraper/add-categories.js scraper/course-categories/hca.txt HCA`

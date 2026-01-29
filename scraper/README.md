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

`cd scraper`
`node scrape-all.js`


Step 4: Install pg client and import

`npm install pg`
`node db/import-courses.js`
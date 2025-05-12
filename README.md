# TCSS 460 - Web API Project

## Hosted Links

- **Heroku-hosted Web API:** [click here](https://group2-tcss460-web-api-322094da8ec1.herokuapp.com/)
- **GitHub Pages-hosted API Documentation:** [click here](https://lwazi71.github.io/Web_API_Phase2_TCSS460/)


## Alpha Sprint

### Contribution

- **Jacob Klymenko** – Wrote the `README.md` and assisted with discussion.
- **Lwazi M Mabota** – Developed the initial Web API and successfully deployed it to Heroku.
- **Thomas Le** – Set up and published the API documentation using GitHub Pages.
- **Owen Orlic** – Acted as the team lead for Alpha Sprint meetings and discussions.

### Meetings

- **Monday, April 14 (10:30 AM – 11:30 AM)** – Discord  
- **Saturday, April 19 (11:00 AM – 12:00 PM)** – Discord  

Our team used Discord voice chat for real-time communication and discussion during this sprint.

### Comments

- There was a bit of confusion with the `.env` files. Lwazi copied the `.env` file the professor sent into the modules, but the instructions were unclear about where it should go.
- Setting up GitHub Pages presented some challenges since only the repository owner could publish it. We wanted to delegate the task instead of having the owner do it, so we ended up having Thomas get it live.

## Beta Sprint

### Contribution

- **Jacob Klymenko** - Normalized the original "books" table in the database into three entities (books, authors, ratings), split up "books.csv" file into three CSV files, and populated the Heroku database. Updated readme.
- **Lwazi M Mabota** - Completed the retrieving a book by ISBN route with fully functional, documented, and tested route. Handled merging all the code and tests together.
- **Thomas Le** - Completed the retrieving a book(s) route with fully functional, documented, and tested route. 
- **Owen Orlic** - Completed the creating a book route with fully functional, documented, and tested route. 

### Meetings

- **Monday, April 21 (10:30 AM - 11:30 AM)** - Discord Voice Chat
    - Discussed the plan and outline for the beta sprint including who will work on what tasks (routes and database). Discussed some future issues that we thought would be encountered.
- **Friday, April 25 (10:30 AM - 11:15 AM)** - Discord Voice Chat
    - Met together to discuss our progress on the tasks we split up. Everyone was about half way done and we discussed some final changes regarding the new database structure and the details on where the routes will be held and the process of combining the work.
- **Sunday, April 27 (5:00 PM - 5:30 PM)** - Discord Voice Chat
    - Final meeting of the beta sprint with finishing touches on the routes and testing with the populated database. Merged all of our code together.

### Comments

- Writing Apidocs for the creating book route took longer than expected.
- Connecting to the Heroku database causing issues in Postman testing.
- Encoding format for populating database as Heroku seems to only allow UTF-8 and the CSV file had other encodings. To fix this, we had to specific the format when copying the data into the database.
- Issues with separating the CSV file into our three different table database design. To fix this, used a TypeScript script in the data folder for direct access.

## Beta II Sprint

### Contribution

- **Jacob Klymenko** - Wrote functionality, documentation, and unit tests for the "At least one other method" requirement with a GET books by age with pagination route based on the original publication year. Led two of three meetings.
- **Lwazi M Mabota** - Wrote functionality, documentation, and unit tests for the change a password route. Led one of the meetings. Handled the merging of all branches into dev and main.
- **Thomas Le** - Wrote functionality, documentation, and unit tests for the GET all books with pagination.
- **Owen Orlic** - Wrote functionality, documentation, and unit tests for adding/subtracting stars from rating level, change number of ratings, and search for books in a range of average ratings.

### Meetings

- **Monday, April 28 (10:30 AM - 11:00 AM)** - Discord Voice Chat
    - Discussed the plan for the beta 2 sprint including who will work on what tasks. Discussed how we can distribute the remaining routes between the members for the next two sprints. 
- **Friday, May 2 (10:30 AM - 11:00 AM)** - Discord Voice Chat
    - Met together to discuss our progress on the designated tasks. Found out that our Github-hosted documenation page was not updated and ran the Apidoc command to update it. Lastly, helped each other with some issues we were facing for our routes on code and logic.
- **Sunday, May 2 (5:00 PM - 6:00 PM)** - Discord Voice Chat
    - Final meeting of the beta 2 sprint with finishing touches on the routes, SQL queries, and merging our individual branches into dev and then into main after agreeing.

### Comments

- We realized our Github-hosted documenation page was not updated and had to run the Apidoc command to update the `/docs` folder.
- We found that we had slight struggles with writing Postman tests. We took some time to help each other help understand.
- Issues with understanding how to work with our current database and more specifically using and writing SQL queries. 
- Found that we were overcomplicating some of our routes and quickly fixed that.

## Final Production Sprint

### Contribution

- **Jacob Klymenko** - Wrote functionality, documentation, and unit tests for a custom GET normal and small image covers by book ID route. Updated POST create book and GET book by ISBN to match the project's HTTP response guidelines. Updated Apidoc and all tests for their routes. Handled merging branches into dev and main. Wrote authentication validation functionality for email.
- **Lwazi M Mabota** - Wrote functionality, documentation, and unit tests for the GET book by title. Updated GET all books paginated to match the project's HTTP response guidelines. Wrote authentication validation functionality for password, role, and phone number. Updated Apidoc and all tests for their routes.
- **Thomas Le** - Wrote functionality, documentation, and unit tests for the DELETE book by ISBN.
- **Owen Orlic** - Wrote functionality, documentation, and unit tests for DELETE range or series of books (delete all books by certain author). Updated GET books by author, GET books by rating range, and PATCH book ratings routes. Updated Apidoc and all tests for their routes. Updated his previous to match the project's HTTP response guidelines.


### Meetings
- **Monday, May 5 (10:30 AM - 11:30 AM)** - Discord Voice Chat
    - Discussed plan for remaining tasks to finalize backend. Decided who would be incharge of what routes that still had to be written and tested.
- **Friday May 9 (11:15 AM - 1:15 PM)** - Discord Voice Chat
    - Moved books.ts to the closed route. Discussed updating code, documentation, and tests to all work with authentication. Additionally, dicussed updating HTTP responses on all routes to keep everything uniform with the project's response guidelines.
- **Sunday May 11 (5:30 PM - 7:30 PM)** - Discord Voice Chat
    - Merged all our updated and new code into dev branch. Handled all resulting merge conflicts. Reran Apidocs and merged dev into main marking the finish of the production web API.

### Comments

- We have realized that we should have separated routes into separate files to avoid the continous merge conflicts that were encountered.
- After Thursday lecture, we figured out that we need to update all our routes that are returning a book response and have them match the project's HTTP response guidelines.
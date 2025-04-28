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

- **Monday, April 21 (10:30 AM - 11:30 AM)** - Discord
- **Friday, April 25 (10:30 AM - 11:15 AM)** - Discord
- **Sunday, April 27 (5:00 PM - 5:30 PM)** - Discord

### Comments

- Writing Apidocs for the creating book route took longer than expected.
- Connecting to the Heroku database causing issues in Postman testing.
- Encoding format for populating database as Heroku seems to only allow UTF-8 and the CSV file had other encodings. To fix this, we had to specific the format when copying the data into the database.
- Issues with separating the CSV file into our three different table database design. To fix this, used a TypeScript script in the data folder for direct access.
-- Each table below populated with respective CSV file through Heroku CLI.

DROP TABLE IF EXISTS books;

CREATE TABLE books(
 book_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 isbn13 BIGINT UNIQUE,
 original_publication_year INT,
 original_title TEXT,
 title TEXT,
 image_url TEXT,
 small_image_url TEXT
);

CREATE TABLE authors(
 book_id INT,
 author TEXT,
 PRIMARY KEY (book_id, author),
 FOREIGN KEY (book_id) REFERENCES BOOKS(book_id) ON DELETE CASCADE
);

CREATE TABLE ratings(
 book_id INT PRIMARY KEY,
 ratings_1 INT DEFAULT 0, -- count of 1 star ratings
 ratings_2 INT DEFAULT 0, -- count of 2 star ratings
 ratings_3 INT DEFAULT 0, -- count of 3 star ratings
 ratings_4 INT DEFAULT 0, -- count of 4 star ratings
 ratings_5 INT DEFAULT 0, -- count of 5 star ratings
 FOREIGN KEY (book_id) REFERENCES BOOKS(book_id) ON DELETE CASCADE
);

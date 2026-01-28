MediShare is an innovative college project designed with a primary focus on robust DBMS and backend functionalities. The platform allows users to list their medicines for sale, while others can purchase them seamlessly.

To ensure security and privacy, users create accounts with passwords securely hashed using bcrypt.js before being stored in the database. This guarantees the confidentiality of user data.

Search results are intelligently optimized based on user location. Leveraging the Geolocation API and Haversine’s formula, only medicines available within a 15km radius are displayed. Additionally, the platform performs automated expiry date checks on all listed medicines every 24 hours using the cron library.

When a transaction occurs, MediShare’s automatic notification system ensures both buyers and sellers are promptly informed. This feature enhances communication and streamlines the user experience.

The Admin Panel provides powerful tools and analytics to maintain the platform’s efficiency:

Medicine Verification: Newly added medicines can be reviewed and approved by the admin.
Transaction Monitoring: The admin can track recently completed transactions and prioritize notifications that require urgent attention.
Custom Notifications: Admins can send tailored notifications to users.
Visual Analytics: The platform incorporates chart.js to present website analytics in a visually appealing manner, enabling data-driven decision-making.

# Tech stack:
HTML, CSS, JavaScript, Node.js, MySQL.

*A. MAKE SURE YOU HAVE node.js INSTALLED IN YOUR SYSTEMS.*

    To download and install Node.js, follow these steps:
        1. Go to the Official Node.js Website
            Visit the official Node.js website at:
            https://nodejs.org/

        2. Choose the Version to Install
            LTS (Long Term Support): This version is recommended for most users as it is stable and receives regular updates.
            Current: This version has the latest features, but may not be as stable as LTS.
            Click on the version that suits your needs to download the installer for your operating system.

        3. Download and Install
            For Windows:
                After selecting the version, click the "Windows" installer for your system architecture (32-bit or 64-bit).
                Once the file is downloaded, open it and follow the installation instructions.
                
            For macOS:

                Download the .pkg file for macOS.
                Open the downloaded file and follow the prompts to install Node.js.
                For Linux:

            There are different ways to install Node.js based on the distribution of Linux you're using. Typically, you can use a package manager such as apt for Ubuntu or yum for CentOS. Here's how to install it on Ubuntu, for example:

                bash
                Copy code
                sudo apt update
                sudo apt install nodejs
                sudo apt install npm
                Alternatively, you can use nvm (Node Version Manager) for managing multiple Node.js versions.



*B. MAKE SURE YOU HAVE THESE npm PACKAGES INSTALLED IN YOUR SYSTEMS.*
    ├── bcrypt@5.1.1
    ├── body-parser@1.20.3
    ├── chart.js@4.4.6
    ├── cookie-parser@1.4.7
    ├── cors@2.8.5
    ├── cron@3.1.9  
    ├── express-session@1.18.1
    ├── express@4.21.1
    └── mysql2@3.11.4
    
    If you miss any of the packages, then here are individual commands to install these packages, just run these commands in terminal/bash on your system:
        npm install bcrypt@5.1.1
        npm install body-parser@1.20.3
        npm install cookie-parser@1.4.7
        npm install cron@3.1.9
        npm install express-session@1.18.1
        npm install express@4.21.1
        npm install mysql2@3.11.4

    Notes for Each OS:
        Windows: If you face issues related to permissions, try running your terminal as an administrator.
        macOS/Linux: You may need to prepend commands with sudo if you encounter permission issues (but usually, npm manages this well without it).


*C. MAKE SURE TO RUN THESE COMMANDS IN YOUR SQL Workbench/Command-client:*
    Individually run these commands step-by-step.

    1. DATABASE CREATION:
        create database MediShare;
        use MediShare;

    2. MASTER LOGIN TABLE:
        create table MasterLogin(username varchar(100), password varchar(20), Primary Key(username));
        insert into MasterLogin values('Aryan041', '23bcs041');
        insert into MasterLogin values('Isaac109', '23bcs109');
        insert into MasterLogin values('Ashika042', '23bcs042');
        insert into MasterLogin values('Ashmita044', '23bcs044');
        insert into MasterLogin values('Aditi008', '23bcs008');

    3. USERS TABLE:
        create table Users(username varchar(255) Primary key, Email varchar(100) not null, password varchar(255) not null, Latitude decimal(9, 6), Longitude decimal(9, 6));

    4. MEDICINES TABLE:
        CREATE TABLE Medicines (
            Id INT PRIMARY KEY AUTO_INCREMENT,
            Username VARCHAR(50),
            Name VARCHAR(100) NOT NULL,
            Qty INT NOT NULL,
            Exp_date DATE NOT NULL,
            Price DECIMAL(10, 2) NOT NULL,
            Status ENUM('Pending', 'Verified', 'Expired') DEFAULT 'Pending',
            Latitude DECIMAL(9, 6),
            Longitude DECIMAL(9, 6),
            FOREIGN KEY (Username) REFERENCES Users(username)
        );

    5. SELLER ACCOUNT TABLE:
        CREATE TABLE Seller_account (
            Username VARCHAR(50),
            Acc_Num VARCHAR(20),
            IFSC VARCHAR(11) NOT NULL,
            PRIMARY KEY (Username, Acc_Num),
            FOREIGN KEY (Username) REFERENCES Users(Username)
        );

    6. TRANSACTIONS TABLE:
        CREATE TABLE Transactions (
            Trans_id INT AUTO_INCREMENT PRIMARY KEY,
            Medicine_id INT,
            Buyer_id VARCHAR(50),
            Qty INT,
            Total_amt DECIMAL(10, 2),
            Trans_date DATE,
            Status ENUM('Completed', 'Failed'),

            FOREIGN KEY (Medicine_id) REFERENCES Medicines(Id),
            FOREIGN KEY (Buyer_id) REFERENCES Users(Username)
        );

    7. NOTIFICATIONS TABLE:
        CREATE TABLE Notifications (
            Notif_id INT AUTO_INCREMENT PRIMARY KEY,
            Username VARCHAR(50),
            Notif_text TEXT,
            is_read BOOLEAN DEFAULT FALSE,
            Reply BOOLEAN,
            Created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (Username) REFERENCES Users(Username)
        );


    8. HISTORY TABLE:
        CREATE TABLE History (
            Sno INT AUTO_INCREMENT PRIMARY KEY,
            Seller_id VARCHAR(50) NOT NULL,
            Buyer_id VARCHAR(50) NOT NULL,
            Medicine_name VARCHAR(100) NOT NULL,
            Qty_bought INT NOT NULL,
            FOREIGN KEY (Seller_id) REFERENCES Users(Username),
            FOREIGN KEY (Buyer_id) REFERENCES Users(Username)
        );


*D. MAKE SURE TO EDIT "Database Configuration" of THE medi_conn.js FILE.*

    // Database configuration
    const DB_USERNAME = "your_user_name"; // <-Change this
    const DB_PASS = "your_password"; // <-Change this
    const DB_HOSTNAME = "localhost";
    const DB_NAME = "medishare";

*E. Run the project using node "path/to/your/file/server.js".*

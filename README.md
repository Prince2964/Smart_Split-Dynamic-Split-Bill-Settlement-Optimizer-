# SplitSmart

SplitSmart is a group expense-splitting and budget-tracking web
application. It helps users manage groups, record expenses, monitor
budgets, and review settlements.

> **Note:** Confirm the exact endpoint paths and environment variable
> names against the final route files before submitting this README. The
> route prefixes below come from the current `server.js` setup.

## Features

-   User authentication (signup/login).
-   Create and manage groups.
-   Invite members by email using the Resend API and share invitations
    through WhatsApp using an invitation token.
-   Add and manage expenses.
-   Monitor budgets, including a warning when spending reaches 80% of
    the overall budget and an overspending alert when the budget is
    exceeded.
-   Review settlement details and settlement history.
-   View dashboard statistics, including total groups and total
    spending.
-   Store application data in MongoDB.

**Current limitation:** Settlement payment verification is not
implemented yet and is planned as a future improvement.

## Technology Stack

-   **Frontend:** HTML, CSS, JavaScript
-   **Backend:** Node.js, Express.js
-   **Database:** MongoDB Atlas with Mongoose
-   **Email invitations:** Resend API
-   **API testing:** Postman
-   **Frontend deployment:** Vercel
-   **Backend deployment:** Render

## Backend Project Structure

``` text
backend/
├── config/
│   └── db.js
├── routes/
│   ├── healthRoutes.js
│   ├── authRoutes.js
│   ├── expenseRoutes.js
│   ├── groupRoutes.js
│   └── groupExpenseRoutes.js
├── .env                 # Create locally; do not commit
├── server.js
└── package.json
```

The frontend may be maintained in a separate folder or repository
depending on the final project setup.

## Getting Started

### Prerequisites

-   Node.js and npm
-   A MongoDB Atlas cluster or another MongoDB instance
-   Git (optional)

### 1. Install dependencies

Open a terminal in the `backend` directory and run:

``` bash
npm install
```

### 2. Configure environment variables

Create a `.env` file inside the backend directory. Use the variable
names expected by `config/db.js`, authentication, and email-invitation
code.

Example template:

``` env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
FRONTEND_URL=http://localhost:5500
RESEND_API_KEY=your_resend_api_key
```

**Important:** Your database variable may be named differently in
`config/db.js` (for example, `MONGO_URI`). Use the exact name referenced
by your code. Add any other variables required by the authentication and
invitation modules. Never commit real API keys, database credentials, or
secrets to GitHub.

### 3. Start the backend

From the `backend` directory:

``` bash
node server.js
```

If the database connection succeeds, the server listens on the port
defined by `PORT`, or on port `3000` if `PORT` is not set.

### 4. Check the backend

With the backend running locally, open:

``` text
http://localhost:3000/
```

Expected response:

``` text
SplitSmart Backend is running!
```

This confirms that the root route responds. It does not, by itself,
verify every API or database operation.

## API Route Prefixes

The current `server.js` mounts these route modules:

  Prefix                  Purpose
  ----------------------- ------------------------------
  `/api/health`           Health-check endpoints
  `/api/auth`             Authentication endpoints
  `/api/expenses`         Individual expense endpoints
  `/api/groups`           Group-management endpoints
  `/api/group-expenses`   Group expense endpoints

Full endpoint paths and supported HTTP methods are defined in the
corresponding files under `backend/routes/`. Check those files before
using a specific endpoint.

## Testing with Postman

1.  Start the backend and confirm it is running.
2.  Open Postman and create a request to the backend URL.
3.  Select the HTTP method required by the route, such as `GET`, `POST`,
    `PUT`, or `DELETE`.
4.  For `POST` or `PUT` requests that accept JSON, select **Body → raw →
    JSON** and provide the required fields.
5.  Send the request and inspect the response and status code.
6.  For operations on a specific group or expense, first fetch the
    record and copy its `_id` from the response. Use that real ID in the
    route path if the endpoint requires it.

Example local base URL:

``` text
http://localhost:3000
```

Exact request paths and JSON fields depend on the final route/controller
code. Do not assume a sample endpoint exists until you confirm it in the
route files.

## CORS and Frontend Configuration

The backend uses CORS to allow configured frontend origins, including
local development origins and the deployed Vercel frontend. Set
`FRONTEND_URL` to the correct frontend URL in the deployment
environment.

The backend parses JSON request bodies with a maximum size of `1mb`:

``` js
app.use(express.json({ limit: "1mb" }));
```

Requests with JSON bodies larger than this limit may be rejected.

## Deployment Notes

-   **Frontend:** Deploy the frontend to Vercel and set its API base URL
    to the deployed backend URL.
-   **Backend:** Deploy the Node.js backend to Render and configure
    environment variables in the Render dashboard.
-   **Database:** Ensure the MongoDB Atlas connection string is correct
    and the deployed backend is allowed to connect to the cluster.
-   **CORS:** Set `FRONTEND_URL` to the production frontend URL.
-   **Secrets:** Keep `.env` out of version control. Use the hosting
    provider's environment-variable settings for production secrets.

## Security Notes

-   Do not commit `.env` files, database passwords, Resend API keys, or
    authentication secrets.
-   Validate and authorize requests in the relevant route/controller
    code.
-   Restrict CORS to the frontend origins you intend to allow.
-   Avoid using real personal email addresses during demonstrations
    unless you have permission.

## Future Improvements

-   Add settlement payment verification.
-   Improve validation and error handling where needed.
-   Add or expand automated tests for API endpoints.

## Team / Contributors

Add the final team member names and their contributions here before
submitting the project.

## License

Add the license required by your institution or project team. If no
license has been selected, remove this section or leave it marked as not
yet specified.

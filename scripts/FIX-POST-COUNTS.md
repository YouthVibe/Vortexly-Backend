# Fix Post Counts

This document explains how to fix mismatched post counts in the YouthVibes app database.

## Problem

The User model has a `posts` counter field that can sometimes get out of sync with the actual number of posts a user has created. This causes the profile page to display the wrong number of posts (usually 0), even though the user has posts available.

## Solution

We've provided two scripts to fix this issue:

### 1. Fix All Users' Post Counts

This script will scan all users in the database and update their post count to match the actual number of posts they have created.

```bash
# From the backend directory
npm run fix:post-counts
```

### 2. Fix a Specific User's Post Count

This script fixes the post count for a single user identified by their user ID.

```bash
# From the backend directory
npm run fix:user-posts <userId>
```

Example:
```bash
npm run fix:user-posts 61234567890abcdef1234567
```

## How to Get the User ID

You can find your user ID by following these steps:

1. Open the YouthVibes app profile page
2. Long-press on your profile image or username
3. Select "Copy User ID" from the menu
4. The user ID is now copied to your clipboard and can be used with the script

Alternatively, you can check the database directly in MongoDB:

```javascript
db.users.findOne({name: "yourUsername"})
```

## Verifying the Fix

After running the script:

1. Refresh your profile page in the app
2. The post count should now accurately reflect the number of posts you have created
3. Your posts should be visible in the profile grid

If you still experience issues after running the fix, please contact the development team for additional support. 
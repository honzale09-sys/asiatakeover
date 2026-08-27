# Auth Testing Playbook

Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email, index on login_attempts.identifier, unique index on tickets.code.

Step 2: API Testing
```
curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@asiatakeover.eu","password":"Takeover2026!"}'
cat cookies.txt
curl -b cookies.txt $API/api/auth/me
```
Login should return the user object and set `access_token` + `refresh_token` cookies. `/me` returns the same user using those cookies.

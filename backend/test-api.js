const http = require('http');

// Use a real requirement ID from the user's session
const reqId = 'af64cc31-c147-43e9-a2db-c740338a3d88';

const options = {
    hostname: 'localhost',
    port: 4000,
    path: `/api/requirements/${reqId}`,
    method: 'GET',
    headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU3Y2I2N2JjLTQ0ZmQtNDkxZC1hMjU4LWI3ZWI1ZTVlNTU2YSIsInJvbGUiOiJESVJFQ1RPUiIsImlhdCI6MTczODk1ODQwMCwiZXhwIjoxNzM5NTYzMjAwfQ.test'
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('=== API Response ===');
            console.log('Status:', res.statusCode);
            console.log('Budget ID:', json.budgetId);
            console.log('Budget object:', json.budget ? 'EXISTS' : 'NULL/UNDEFINED');
            if (json.budget) {
                console.log('Budget title:', json.budget.title);
                console.log('Budget category:', json.budget.category?.name);
            }
        } catch (e) {
            console.log('Response:', data);
        }
    });
});

req.on('error', (e) => console.error('Error:', e.message));
req.end();

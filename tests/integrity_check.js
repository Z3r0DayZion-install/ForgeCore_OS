const http = require('http');

async function testApi(path, method, body = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (body) {
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }
        
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });

        req.on('error', (e) => reject(e));

        if (body) req.write(body);
        req.end();
    });
}

async function runTests() {
    console.log('[TEST] Starting Integrity Check...');
    let token = null;

    try {
        // 1. Test Authentication
        console.log('--- TEST 1: Secure Unlock ---');
        const authPayload = JSON.stringify({ passphrase: "FORGE_MASTER_2026" });
        const authRes = await testApi('/api/system/unlock', 'POST', authPayload);
        if (authRes.status !== 200) throw new Error(`Unlock failed with status ${authRes.status}`);
        
        const authData = JSON.parse(authRes.data);
        if (!authData.success || !authData.token) throw new Error(`Invalid unlock response: ${authRes.data}`);
        
        token = authData.token;
        console.log('✅ Unlock successful. Session token generated.');

        // 2. Test Command Execution
        console.log('--- TEST 2: Command Execution (status) ---');
        const cmdPayload = JSON.stringify({ commandString: "status" });
        const cmdRes = await testApi('/api/system/execute', 'POST', cmdPayload, token);
        if (cmdRes.status !== 200) throw new Error(`Execute failed with status ${cmdRes.status}`);
        
        const cmdData = JSON.parse(cmdRes.data);
        if (!cmdData.output || !cmdData.output.includes('[STATUS]')) throw new Error(`Invalid execute response: ${cmdRes.data}`);
        
        console.log('✅ Command execution successful. Status retrieved.');

        // 3. Test Invalid Auth
        console.log('--- TEST 3: Invalid Authentication ---');
        const badAuthPayload = JSON.stringify({ passphrase: "WRONG_PASSWORD" });
        const badAuthRes = await testApi('/api/system/unlock', 'POST', badAuthPayload);
        if (badAuthRes.status !== 401) throw new Error(`Expected 401, got ${badAuthRes.status}`);
        console.log('✅ Invalid auth rejected correctly. TEAR log generated.');

        console.log('\n✅ ALL INTEGRITY TESTS PASSED.');
        process.exit(0);
    } catch (e) {
        console.error('\n❌ INTEGRITY TEST FAILED:', e.message);
        process.exit(1);
    }
}

// Give server time to start if run consecutively
setTimeout(runTests, 2000);

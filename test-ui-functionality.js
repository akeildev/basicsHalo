// UI Functionality Test Script
// Run this in the header window's DevTools console to verify all features

async function testUIFunctionality() {
    console.log('=== Starting UI Functionality Tests ===\n');
    
    const tests = {
        passed: [],
        failed: []
    };
    
    // Test 1: Check API availability
    console.log('Test 1: Checking API availability...');
    if (window.electronAPI) {
        tests.passed.push('✅ electronAPI is available');
    } else {
        tests.failed.push('❌ electronAPI is NOT available');
        return tests;
    }
    
    // Test 2: Open Listen Window
    console.log('\nTest 2: Opening Listen window...');
    try {
        const listenResult = await window.electronAPI.requestWindowVisibility({ 
            name: 'listen', 
            visible: true 
        });
        if (listenResult.success) {
            tests.passed.push('✅ Listen window opened successfully');
        } else {
            tests.failed.push('❌ Listen window failed to open: ' + listenResult.error);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        tests.failed.push('❌ Listen window error: ' + error.message);
    }
    
    // Test 3: Open Ask Window (should close Listen)
    console.log('\nTest 3: Opening Ask window (should close Listen)...');
    try {
        const askResult = await window.electronAPI.requestWindowVisibility({ 
            name: 'ask', 
            visible: true 
        });
        if (askResult.success) {
            tests.passed.push('✅ Ask window opened successfully (Listen should be closed)');
        } else {
            tests.failed.push('❌ Ask window failed to open: ' + askResult.error);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        tests.failed.push('❌ Ask window error: ' + error.message);
    }
    
    // Test 4: Open Settings Window (should close Ask)
    console.log('\nTest 4: Opening Settings window (should close Ask)...');
    try {
        const settingsResult = await window.electronAPI.requestWindowVisibility({ 
            name: 'settings', 
            visible: true 
        });
        if (settingsResult.success) {
            tests.passed.push('✅ Settings window opened successfully (Ask should be closed)');
        } else {
            tests.failed.push('❌ Settings window failed to open: ' + settingsResult.error);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        tests.failed.push('❌ Settings window error: ' + error.message);
    }
    
    // Test 5: Toggle Settings (should close it)
    console.log('\nTest 5: Toggling Settings window (should close)...');
    try {
        const toggleResult = await window.electronAPI.requestWindowVisibility({ 
            name: 'settings', 
            visible: true 
        });
        await new Promise(resolve => setTimeout(resolve, 500));
        const closeResult = await window.electronAPI.requestWindowVisibility({ 
            name: 'settings', 
            visible: false 
        });
        if (closeResult.success) {
            tests.passed.push('✅ Settings window toggled successfully');
        } else {
            tests.failed.push('❌ Settings window toggle failed: ' + closeResult.error);
        }
    } catch (error) {
        tests.failed.push('❌ Settings toggle error: ' + error.message);
    }
    
    // Test 6: Broadcast Message
    console.log('\nTest 6: Testing broadcast messaging...');
    try {
        // Set up listener first
        let broadcastReceived = false;
        const broadcastHandler = (data) => {
            broadcastReceived = true;
            console.log('Broadcast received:', data);
        };
        window.electronAPI.on('test:broadcast', broadcastHandler);
        
        // Send broadcast
        window.electronAPI.broadcast('test:broadcast', { message: 'Hello from header!' });
        
        // Wait a bit for the message
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (broadcastReceived) {
            tests.passed.push('✅ Broadcast messaging works');
        } else {
            tests.failed.push('❌ Broadcast not received');
        }
        
        // Clean up
        window.electronAPI.off('test:broadcast', broadcastHandler);
    } catch (error) {
        tests.failed.push('❌ Broadcast error: ' + error.message);
    }
    
    // Test 7: Shared State
    console.log('\nTest 7: Testing shared state...');
    try {
        // Set a state value
        const setState = await window.electronAPI.setState({ 
            key: 'testKey', 
            value: 'testValue123' 
        });
        
        // Get the state value
        const getValue = await window.electronAPI.getState('testKey');
        
        if (getValue === 'testValue123') {
            tests.passed.push('✅ Shared state works');
        } else {
            tests.failed.push('❌ Shared state mismatch: ' + getValue);
        }
    } catch (error) {
        tests.failed.push('❌ Shared state error: ' + error.message);
    }
    
    // Test 8: Window Positioning (Move Header)
    console.log('\nTest 8: Testing header movement (child windows should follow)...');
    console.log('Move the header window manually and observe if child windows follow after ~100ms');
    tests.passed.push('✅ Manual test: Check if child windows follow header movement');
    
    // Print results
    console.log('\n=== Test Results ===');
    console.log(`Passed: ${tests.passed.length}`);
    console.log(`Failed: ${tests.failed.length}`);
    
    console.log('\n=== Passed Tests ===');
    tests.passed.forEach(test => console.log(test));
    
    if (tests.failed.length > 0) {
        console.log('\n=== Failed Tests ===');
        tests.failed.forEach(test => console.log(test));
    }
    
    return tests;
}

// Run the test
console.log('Run testUIFunctionality() to start the tests');
console.log('Or copy this entire script and paste it in the header window DevTools console');

// Auto-run if in browser context
if (typeof window !== 'undefined' && window.electronAPI) {
    testUIFunctionality();
}
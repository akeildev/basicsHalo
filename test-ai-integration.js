/**
 * Test script for AI integration
 * This tests the OpenAI API connection and screenshot + vision capabilities
 */

const settingsService = require('./src/features/settings/settingsService');
const askService = require('./src/features/ask/askService');

async function testAIIntegration() {
    console.log('===== AI Integration Test =====\n');
    
    try {
        // Step 1: Check settings
        console.log('1. Checking settings...');
        const settings = await settingsService.getSettings();
        
        if (!settings.openaiApiKey) {
            console.log('❌ No OpenAI API key found in settings');
            console.log('Please add your API key in the Settings window first');
            return;
        }
        
        console.log('✅ OpenAI API key found:', settings.openaiApiKey.substring(0, 7) + '...');
        
        // Step 2: Initialize Ask service
        console.log('\n2. Initializing Ask service...');
        await askService.initialize();
        console.log('✅ Ask service initialized');
        
        // Step 3: Test text-only query
        console.log('\n3. Testing text-only query...');
        const textResponse = await askService.askQuestion('What is 2 + 2?', {
            includeScreenshot: false
        });
        console.log('✅ Response received:', textResponse.answer.substring(0, 100) + '...');
        
        // Step 4: Test with screenshot (vision model)
        console.log('\n4. Testing with screenshot (vision model)...');
        const screenshotResponse = await askService.askQuestion('What do you see in this screenshot?', {
            includeScreenshot: true
        });
        
        if (screenshotResponse.hasScreenshot) {
            console.log('✅ Screenshot captured and sent to AI');
            console.log('✅ Vision response:', screenshotResponse.answer.substring(0, 100) + '...');
        } else {
            console.log('⚠️ Screenshot capture failed');
        }
        
        // Step 5: Test streaming
        console.log('\n5. Testing streaming response...');
        const streamResult = await askService.sendMessage('Tell me a short joke', {
            apiKey: settings.openaiApiKey
        });
        
        if (streamResult.success) {
            console.log('✅ Streaming response received:', streamResult.response.substring(0, 100) + '...');
        } else {
            console.log('❌ Streaming failed:', streamResult.error);
        }
        
        console.log('\n===== All tests completed! =====');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
if (require.main === module) {
    testAIIntegration().then(() => {
        console.log('\nTest complete. Press Ctrl+C to exit.');
    });
}

module.exports = testAIIntegration;
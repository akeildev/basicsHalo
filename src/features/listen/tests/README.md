# Clueless Screen Capture Test Suite

This comprehensive test suite validates all aspects of Clueless's screen capture and recording functionality across different platforms and scenarios.

## Overview

The test suite is designed to ensure that Clueless's screen capture system works reliably across:
- **macOS** (with SystemAudioDump)
- **Windows** (with loopback audio)
- **Linux** (with PulseAudio/ALSA)

## Test Suites

### 1. Permission Tests (`permissionTests.js`)
Tests all permission-related functionality:
- Permission checking across platforms
- Permission requests and callbacks
- Permission caching and cleanup
- Platform-specific permission handling

### 2. Capture Tests (`captureTests.js`)
Validates media capture functionality:
- Screen capture with `desktopCapturer`
- Microphone capture with `getUserMedia`
- System audio capture (platform-specific)
- Combined capture scenarios
- Error handling and performance

### 3. Audio Processing Tests (`audioProcessingTests.js`)
Tests the audio processing pipeline:
- Voice Activity Detection (VAD)
- Echo cancellation with WebAssembly
- Noise gate functionality
- Format conversion (Float32 ↔ Int16)
- Audio chunking and pipeline processing

### 4. Performance Tests (`performanceTests.js`)
Monitors performance and resource usage:
- Audio processing performance
- Echo cancellation performance
- Memory usage and cleanup
- CPU usage monitoring
- Latency measurements
- Throughput testing

### 5. Platform Tests (`platformTests.js`)
Validates platform-specific functionality:
- Platform detection and capabilities
- Platform-specific audio features
- Binary availability and execution
- Platform-specific permissions
- Compatibility testing

### 6. Error Handling Tests (`errorHandlingTests.js`)
Tests error scenarios and recovery:
- Service initialization errors
- Capture errors and recovery
- Audio processing errors
- Permission errors
- Resource errors
- Error propagation and recovery

### 7. Integration Tests (`integrationTests.js`)
Tests system integration:
- IPC handler registration
- IPC communication
- Event broadcasting
- Service integration
- State synchronization

## Running Tests

### Basic Usage
```bash
# Run all tests
node scripts/run-screen-capture-tests.js

# Run specific test suites
node scripts/run-screen-capture-tests.js --suites permissions,capture

# Enable verbose output
node scripts/run-screen-capture-tests.js --verbose

# Custom timeout and retries
node scripts/run-screen-capture-tests.js --timeout 60000 --retries 5
```

### Available Options
- `--suites <list>`: Comma-separated list of test suites
- `--verbose, -v`: Enable verbose output
- `--timeout <ms>`: Timeout for individual tests (default: 30000)
- `--retries <count>`: Number of retries for failed tests (default: 3)
- `--no-save`: Don't save test results to file
- `--help, -h`: Show help message

## Test Results

Test results are automatically saved to `test-results/` directory with timestamps:
```
test-results/screen-capture-test-darwin-2024-01-15T10-30-45-123Z.json
test-results/screen-capture-test-win32-2024-01-15T10-30-45-123Z.json
test-results/screen-capture-test-linux-2024-01-15T10-30-45-123Z.json
```

## Platform-Specific Requirements

### macOS
- SystemAudioDump binary in `bin/SystemAudioDump`
- Screen recording permission
- Microphone permission
- System audio permission

### Windows
- Windows audio loopback support
- Microphone permission
- Screen recording permission

### Linux
- PulseAudio or ALSA development packages
- Audio permissions for user
- Screen recording permission

## Performance Benchmarks

The test suite includes performance benchmarks:

| Metric | Target | Platform |
|--------|--------|----------|
| Audio Processing | < 50ms/frame | All |
| Echo Cancellation | < 20ms/frame | All |
| First Chunk Latency | < 200ms | All |
| Throughput | > 24kHz | All |
| Memory Increase | < 100MB | All |
| CPU Usage | < 50% | All |

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Grant screen recording and microphone permissions
   - Check system privacy settings

2. **Binary Not Found**
   - Ensure SystemAudioDump is in `bin/` directory
   - Check file permissions (should be executable)

3. **Audio Device Issues**
   - Verify audio devices are available
   - Check audio driver status

4. **Performance Issues**
   - Monitor system resources
   - Check for background processes
   - Verify audio processing settings

### Debug Mode
Run tests with verbose output to see detailed information:
```bash
node scripts/run-screen-capture-tests.js --verbose
```

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Include proper error handling
3. Add performance metrics where relevant
4. Test across all supported platforms
5. Update this documentation

## Test Architecture

The test suite uses a modular architecture:

```
tests/
├── screenCaptureTestRunner.js    # Main test runner
├── testSuites/                   # Individual test suites
│   ├── permissionTests.js
│   ├── captureTests.js
│   ├── audioProcessingTests.js
│   ├── performanceTests.js
│   ├── platformTests.js
│   ├── errorHandlingTests.js
│   └── integrationTests.js
└── README.md                     # This file
```

Each test suite extends a base class and implements:
- `run(options)`: Main test execution
- `getResults()`: Return test results
- Individual test methods for specific functionality

## Continuous Integration

The test suite is designed to run in CI environments:
- Exit codes indicate success/failure
- Results are saved in JSON format
- Performance metrics are collected
- Platform-specific tests are conditional

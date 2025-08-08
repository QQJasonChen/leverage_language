// Test timestamp functions
function formatVideoTimestamp(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return '';
  }
  
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  
  if (hours > 0) {
    return hours + ':' + minutes.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
  } else {
    return minutes + ':' + secs.toString().padStart(2, '0');
  }
}

function getVideoButtonText(videoTimestamp) {
  const hasTimestamp = videoTimestamp !== null && videoTimestamp !== undefined && !isNaN(videoTimestamp);
  return hasTimestamp ? '⏰ 返回片段' : '📹 返回影片';
}

// Test cases
const testCases = [
  { input: null, expectedFormat: '', expectedButton: '📹 返回影片' },
  { input: undefined, expectedFormat: '', expectedButton: '📹 返回影片' },
  { input: NaN, expectedFormat: '', expectedButton: '📹 返回影片' },
  { input: 0, expectedFormat: '0:00', expectedButton: '⏰ 返回片段' },
  { input: 45, expectedFormat: '0:45', expectedButton: '⏰ 返回片段' },
  { input: 125, expectedFormat: '2:05', expectedButton: '⏰ 返回片段' },
  { input: 3665, expectedFormat: '1:01:05', expectedButton: '⏰ 返回片段' }
];

console.log('🧪 Testing timestamp functions:');
let allPassed = true;

testCases.forEach((test, index) => {
  const formatResult = formatVideoTimestamp(test.input);
  const buttonResult = getVideoButtonText(test.input);
  
  const formatPassed = formatResult === test.expectedFormat;
  const buttonPassed = buttonResult === test.expectedButton;
  
  console.log('Test ' + (index + 1) + ': input=' + test.input);
  console.log('  Format: ' + (formatPassed ? '✅' : '❌') + ' "' + formatResult + '" (expected: "' + test.expectedFormat + '")');
  console.log('  Button: ' + (buttonPassed ? '✅' : '❌') + ' "' + buttonResult + '" (expected: "' + test.expectedButton + '")');
  
  if (!formatPassed || !buttonPassed) {
    allPassed = false;
  }
});

console.log();
console.log('🎯 All tests ' + (allPassed ? 'PASSED' : 'FAILED'));

// Test with some example cases that might be causing issues
console.log('\n🔍 Debug specific problem cases:');
const problemCases = [null, undefined, 0, 125];
problemCases.forEach(value => {
  console.log('Value:', value, 'Type:', typeof value, 'IsNaN:', isNaN(value));
  console.log('  Format:', '"' + formatVideoTimestamp(value) + '"');
  console.log('  Button:', '"' + getVideoButtonText(value) + '"');
});
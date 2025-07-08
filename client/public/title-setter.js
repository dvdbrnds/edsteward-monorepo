(function() {
  const hostname = window.location.hostname;
  console.log('🏷️ Hostname detected:', hostname);
  
  if (hostname.startsWith('admin.')) {
    document.title = 'EdSteward Admin Console';
    console.log('✅ Title updated to: EdSteward Admin Console');
  } else if (hostname.startsWith('moravian.')) {
    document.title = 'Moravian University Compliance Portal';
    console.log('✅ Title updated to: Moravian University Compliance Portal');
  } else if (hostname.startsWith('test.')) {
    document.title = 'Generic Compliance Portal';
    console.log('✅ Title updated to: Generic Compliance Portal');
  } else if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
    document.title = 'EdSteward Development';
    console.log('✅ Title updated to: EdSteward Development');
  } else {
    document.title = 'EdSteward Compliance Portal';
    console.log('✅ Title updated to: EdSteward Compliance Portal (default)');
  }
})(); 
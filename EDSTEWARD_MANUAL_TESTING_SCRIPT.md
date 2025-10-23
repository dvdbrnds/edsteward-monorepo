# 🧪 EdSteward Manual Testing Script
**Complete Functional Testing Guide**

*Version: 1.0*  
*Created: October 13, 2025*  
*Based on: PRD, Codebase Analysis, Git History, and Byterover Memories*

---

## 🎯 **Testing Overview**

This script covers **all major EdSteward functionality** including authentication, regulation management, compliance tracking, notifications, admin features, MCP Engine integration, and multi-factor authentication.

**Test Environment**: `http://localhost:3000`  
**Test Users**: 
- Regular User: `dvdbrnds` 
- Admin User: `emergency_admin`
- Test in **incognito mode** to avoid caching issues

---

## 🔐 **1. AUTHENTICATION & SECURITY TESTING**

### **1.1 Basic Authentication**
- [ ] **Login Page Access**: Navigate to `http://localhost:3000`
- [ ] **Valid Login**: Use `dvdbrnds` credentials
- [ ] **Invalid Login**: Test wrong password (should show error)
- [ ] **Session Persistence**: Refresh page (should stay logged in)
- [ ] **Logout**: Click logout button (should redirect to login)

### **1.2 Multi-Factor Authentication (MFA)**
- [ ] **Access Account Settings**: Click user dropdown → "Account Settings"
- [ ] **MFA Setup**: Click "Start MFA Setup" button
- [ ] **QR Code Generation**: Verify QR code appears for Google Authenticator
- [ ] **TOTP Verification**: Scan QR code, enter 6-digit code
- [ ] **Backup Codes**: Generate and save backup codes
- [ ] **MFA Login**: Logout and login with MFA code
- [ ] **Backup Code Login**: Use backup code instead of TOTP
- [ ] **MFA Disable**: Disable MFA in account settings

### **1.3 Emergency Admin Access**
- [ ] **Emergency Login**: Use `emergency_admin` credentials
- [ ] **Admin Dashboard Access**: Verify admin features available
- [ ] **Security Context**: Confirm emergency admin has appropriate permissions

---

## 📊 **2. DASHBOARD & NAVIGATION TESTING**

### **2.1 Main Dashboard**
- [ ] **Dashboard Load**: Verify dashboard loads with regulation count
- [ ] **Navigation Menu**: Test all menu items (Regulations, Reports, etc.)
- [ ] **User Dropdown**: Test Account Settings, Logout options
- [ ] **WebSocket Status**: Check MCP Engine connection indicator
- [ ] **Health Score**: Verify compliance health score displays
- [ ] **Upcoming Deadlines**: Check deadline widgets load

### **2.2 Responsive Design**
- [ ] **Desktop View**: Test on full screen (1920x1080)
- [ ] **Tablet View**: Resize to tablet dimensions
- [ ] **Mobile View**: Test mobile responsiveness
- [ ] **Navigation Collapse**: Verify mobile menu works

---

## 📋 **3. REGULATION MANAGEMENT TESTING**

### **3.1 Regulation Viewing**
- [ ] **Regulations List**: Navigate to "All Regulations" 
- [ ] **Search Functionality**: Test search bar with keywords
- [ ] **Filter by Category**: Test category filters (Campus Safety, etc.)
- [ ] **Filter by Institution**: Test "Applies To" filters
- [ ] **Sort Options**: Test sorting by name, date, category
- [ ] **Pagination**: Test navigation through regulation pages

### **3.2 Regulation Details**
- [ ] **Detail Page**: Click on "Clery Act" regulation
- [ ] **Full Content**: Verify complete regulation text displays
- [ ] **Metadata Display**: Check agency, statute, requirements
- [ ] **Related Regulations**: Verify related items show
- [ ] **Evidence Section**: Test evidence file viewing
- [ ] **Timeline View**: Check regulation change history

### **3.3 Regulation Search & Filtering**
- [ ] **Keyword Search**: Search for "campus", "safety", "financial"
- [ ] **Advanced Filters**: Test multiple filter combinations
- [ ] **Clear Filters**: Reset all filters and verify
- [ ] **Search Results Count**: Verify result counts are accurate
- [ ] **No Results**: Search for non-existent term

---

## 📝 **4. NOTES & COLLABORATION TESTING**

### **4.1 Note Management**
- [ ] **Add Note**: Add note to Clery Act regulation
- [ ] **Note Categories**: Test different note categories
- [ ] **Private Notes**: Create private vs. public notes
- [ ] **Edit Note**: Modify existing note
- [ ] **Delete Note**: Remove note and confirm deletion
- [ ] **Note History**: View note modification history

### **4.2 Collaboration Features**
- [ ] **Note Sharing**: Verify note visibility settings
- [ ] **User Attribution**: Check notes show correct author
- [ ] **Timestamps**: Verify note creation/modification times

---

## 📅 **5. DEADLINES & COMPLIANCE TESTING**

### **5.1 Deadline Management**
- [ ] **View Deadlines**: Navigate to upcoming deadlines
- [ ] **Add Deadline**: Create new compliance deadline
- [ ] **Edit Deadline**: Modify existing deadline
- [ ] **Delete Deadline**: Remove deadline
- [ ] **Deadline Notifications**: Check notification settings
- [ ] **Overdue Items**: Test overdue deadline display

### **5.2 Compliance Tracking**
- [ ] **Compliance Status**: Check regulation compliance status
- [ ] **Evidence Upload**: Test file upload for compliance evidence
- [ ] **Attestation Process**: Test compliance attestation workflow
- [ ] **Audit Trail**: Verify compliance actions are logged

---

## 🔔 **6. NOTIFICATIONS TESTING**

### **6.1 Notification System**
- [ ] **Notification Page**: Navigate to notifications
- [ ] **Mark as Read**: Test marking notifications read
- [ ] **Notification Types**: Verify different notification categories
- [ ] **Real-time Updates**: Test live notification updates
- [ ] **Notification History**: Check notification archive

### **6.2 WebSocket Integration**
- [ ] **Connection Status**: Verify WebSocket connection to MCP Engine
- [ ] **Real-time Updates**: Test regulation update notifications
- [ ] **Toast Notifications**: Check popup notifications appear
- [ ] **Connection Recovery**: Test reconnection after disconnect

---

## 🛠️ **7. ADMIN FEATURES TESTING**

### **7.1 Admin Dashboard**
- [ ] **Admin Access**: Login as admin user
- [ ] **System Stats**: Check user count, regulation count
- [ ] **Health Monitoring**: Verify system health indicators
- [ ] **Database Status**: Check database connection status

### **7.2 User Management**
- [ ] **User List**: View all system users
- [ ] **User Roles**: Verify role assignments
- [ ] **User Activity**: Check user activity logs
- [ ] **Permission Testing**: Test role-based access controls

### **7.3 System Configuration**
- [ ] **Feature Flags**: Test feature flag management
- [ ] **System Settings**: Modify system configurations
- [ ] **Branding Settings**: Test logo/branding uploads
- [ ] **Institution Config**: Configure institution settings

---

## 🔄 **8. MCP ENGINE INTEGRATION TESTING**

### **8.1 WebSocket Connection**
- [ ] **Connection Establishment**: Check browser console for "MCP Engine WebSocket connected"
- [ ] **Connection Status**: Verify WebSocket status indicator
- [ ] **Auto-Reconnection**: Test reconnection after network interruption
- [ ] **Error Handling**: Verify graceful error handling

### **8.2 Regulation Updates**
- [ ] **Bulk Import Health**: Test `/api/regulation-updates/bulk-import/health`
- [ ] **Update Reception**: Verify EdSteward receives MCP updates
- [ ] **Update Processing**: Check regulation updates are processed
- [ ] **Change Notifications**: Verify users get notified of changes

### **8.3 Real-time Features**
- [ ] **Live Updates**: Test real-time regulation updates
- [ ] **Toast Notifications**: Check update notifications appear
- [ ] **Data Synchronization**: Verify data stays synchronized
- [ ] **Conflict Resolution**: Test handling of update conflicts

---

## 📊 **9. REPORTING & ANALYTICS TESTING**

### **9.1 Reports Generation**
- [ ] **Compliance Reports**: Generate compliance status reports
- [ ] **PDF Export**: Test PDF report generation
- [ ] **CSV Export**: Test CSV data export
- [ ] **Custom Reports**: Create custom report filters

### **9.2 Analytics Dashboard**
- [ ] **Compliance Analytics**: View compliance trends
- [ ] **User Activity**: Check user engagement metrics
- [ ] **System Performance**: Monitor system performance metrics
- [ ] **Audit Reports**: Generate audit trail reports

---

## 🔍 **10. ADVANCED FEATURES TESTING**

### **10.1 Version Control**
- [ ] **Regulation Versions**: View regulation version history
- [ ] **Change Tracking**: Check change detection and tracking
- [ ] **Differential View**: Test regulation diff viewer
- [ ] **Version Comparison**: Compare different regulation versions

### **10.2 Federal Register Integration**
- [ ] **Enhanced Content**: Verify Federal Register data enrichment
- [ ] **Metadata Display**: Check enhanced regulation metadata
- [ ] **Source Attribution**: Verify proper source attribution
- [ ] **Update Synchronization**: Test Federal Register sync

### **10.3 Validation System**
- [ ] **Data Validation**: Test regulation data validation
- [ ] **Validation Levels**: Check A/B/C/D validation levels
- [ ] **Error Reporting**: Test validation error reporting
- [ ] **Validation Override**: Test admin validation overrides

---

## 🚨 **11. ERROR HANDLING & EDGE CASES**

### **11.1 Network Issues**
- [ ] **Offline Mode**: Test behavior when offline
- [ ] **Slow Connection**: Test with throttled network
- [ ] **Connection Recovery**: Test recovery from network errors
- [ ] **Timeout Handling**: Test request timeout scenarios

### **11.2 Data Issues**
- [ ] **Missing Data**: Test handling of missing regulations
- [ ] **Invalid Input**: Test form validation and error messages
- [ ] **Large Datasets**: Test performance with many regulations
- [ ] **Concurrent Users**: Test multi-user scenarios

### **11.3 Browser Compatibility**
- [ ] **Chrome**: Test all features in Chrome
- [ ] **Firefox**: Test critical paths in Firefox
- [ ] **Safari**: Test basic functionality in Safari
- [ ] **Edge**: Test core features in Edge

---

## 📱 **12. MOBILE & ACCESSIBILITY TESTING**

### **12.1 Mobile Functionality**
- [ ] **Touch Navigation**: Test touch-based navigation
- [ ] **Mobile Forms**: Test form input on mobile
- [ ] **Mobile Search**: Test search functionality on mobile
- [ ] **Mobile Performance**: Check loading times on mobile

### **12.2 Accessibility**
- [ ] **Keyboard Navigation**: Test tab navigation
- [ ] **Screen Reader**: Test with screen reader (if available)
- [ ] **Color Contrast**: Verify sufficient color contrast
- [ ] **Alt Text**: Check image alt text and labels

---

## 🔧 **13. PERFORMANCE TESTING**

### **13.1 Load Times**
- [ ] **Initial Load**: Measure dashboard load time
- [ ] **Navigation Speed**: Test page transition times
- [ ] **Search Performance**: Test search response times
- [ ] **Large Data Sets**: Test with 355+ regulations

### **13.2 Resource Usage**
- [ ] **Memory Usage**: Monitor browser memory consumption
- [ ] **Network Requests**: Check for excessive API calls
- [ ] **Caching**: Verify proper caching behavior
- [ ] **Bundle Size**: Check for reasonable JavaScript bundle size

---

## ✅ **14. FINAL INTEGRATION TEST**

### **14.1 End-to-End Workflow**
- [ ] **Complete User Journey**: 
  1. Login → Dashboard → Search Regulation → View Details → Add Note → Set Deadline → Logout
- [ ] **Admin Workflow**: 
  1. Admin Login → Check System Health → Review Users → Update Settings → Logout
- [ ] **MCP Integration**: 
  1. Verify WebSocket Connection → Test Regulation Update → Confirm Notification

### **14.2 Production Readiness**
- [ ] **Data Integrity**: Verify all data displays correctly
- [ ] **Security**: Confirm all security features work
- [ ] **Performance**: Acceptable load times across features
- [ ] **Stability**: No crashes or critical errors during testing

---

## 📋 **TESTING CHECKLIST SUMMARY**

**Core Functionality**: ✅ / ❌  
**Authentication & Security**: ✅ / ❌  
**Regulation Management**: ✅ / ❌  
**Admin Features**: ✅ / ❌  
**MCP Integration**: ✅ / ❌  
**Mobile Responsiveness**: ✅ / ❌  
**Performance**: ✅ / ❌  

---

## 🚨 **CRITICAL ISSUES TO REPORT**

**High Priority**:
- Authentication failures
- Data loss or corruption  
- Security vulnerabilities
- System crashes

**Medium Priority**:
- Performance issues
- UI/UX problems
- Feature malfunctions
- Integration issues

**Low Priority**:
- Minor UI inconsistencies
- Non-critical feature gaps
- Enhancement opportunities

---

## 📞 **SUPPORT INFORMATION**

**Test Environment**: `http://localhost:3000`  
**MCP Engine**: `http://localhost:3050`  
**WebSocket**: `ws://localhost:3051/regulation-updates`  
**Database**: 24 users, 355 regulations  
**Last Updated**: October 13, 2025

**Remember**: Always test in **incognito mode** to avoid caching issues!


